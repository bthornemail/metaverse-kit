#!/usr/bin/env node
/**
 * scripts/verify-bundle.js
 *
 * Bundle-level verifier that aggregates optional lane verifiers into one receipt:
 * - waveform render verifier (verify-waveform-render.js)
 * - narrative verifier (verify-narrative.js)
 *
 * Outputs:
 * - bundle.verify.json
 * - bundle-verify.ndjson
 *
 * Policy:
 * - optional by default
 * - can require each lane via flags
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { spawnSync } = require('child_process');

function parseArgs(argv) {
  const out = {};
  for (let i = 2; i < argv.length; i += 1) {
    const a = argv[i];
    if (!a.startsWith('--')) continue;
    const k = a.slice(2);
    const v = argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[++i] : true;
    out[k] = v;
  }
  return out;
}

function sha256Bytes(buf) {
  return `sha256:${crypto.createHash('sha256').update(buf).digest('hex')}`;
}

function sha256File(p) {
  return sha256Bytes(fs.readFileSync(p));
}

function sha256Text(s) {
  return sha256Bytes(Buffer.from(String(s), 'utf8'));
}

function deterministicIso(seq) {
  return `1970-01-01T00:00:${String(seq % 60).padStart(2, '0')}Z`;
}

function writeJson(p, obj) {
  fs.writeFileSync(p, `${JSON.stringify(obj, null, 2)}\n`, 'utf8');
}

function writeNdjson(p, rows) {
  fs.writeFileSync(p, `${rows.map((r) => JSON.stringify(r)).join('\n')}\n`, 'utf8');
}

function safeReadJson(p) {
  try {
    return JSON.parse(fs.readFileSync(p, 'utf8'));
  } catch {
    return null;
  }
}

function main() {
  const args = parseArgs(process.argv);
  const dir = path.resolve(String(args.dir || args['bundle-dir'] || args.bundle || '.'));
  const outDir = path.resolve(String(args.out || dir));
  fs.mkdirSync(outDir, { recursive: true });

  const requireWaveformRender = String(args['require-waveform-render'] || '').toLowerCase() === 'true';
  const requireNarrative = String(args['require-narrative'] || '').toLowerCase() === 'true';
  const requireDashboard = String(args['require-dashboard'] || '').toLowerCase() === 'true';

  const scriptsDir = path.resolve(__dirname);
  const wfVerify = path.join(scriptsDir, 'verify-waveform-render.js');
  const narrVerify = path.join(scriptsDir, 'verify-narrative.js');
  const dashVerify = path.join(scriptsDir, 'verify-dashboard.js');

  const events = [];
  let seq = 1;
  const emit = (event, payload) => {
    const s = seq++;
    events.push({ seq: s, timestamp: deterministicIso(s), lane: 'bundle', event, payload });
  };

  emit('bundle.verify.start', { dir, out_dir: outDir });

  // Run lane verifiers as subprocesses so they stay usable as standalone CLIs.
  const lane = {
    waveform_render: { invoked: false, pass: null, out: null },
    narrative: { invoked: false, pass: null, out: null },
    dashboard: { invoked: false, pass: null, out: null },
  };

  if (fs.existsSync(wfVerify)) {
    const r = spawnSync(process.execPath, [wfVerify, '--dir', dir, '--out', outDir, '--require', requireWaveformRender ? 'true' : 'false'], { encoding: 'utf8' });
    lane.waveform_render.invoked = true;
    lane.waveform_render.pass = r.status === 0;
    lane.waveform_render.out = path.join(outDir, 'waveform.render.verify.json');
    emit('bundle.verify.lane', { lane: 'waveform_render', status: r.status });
  } else {
    emit('bundle.verify.lane', { lane: 'waveform_render', missing: true });
  }

  if (fs.existsSync(narrVerify)) {
    const r = spawnSync(process.execPath, [narrVerify, '--dir', dir, '--out', outDir, '--require', requireNarrative ? 'true' : 'false'], { encoding: 'utf8' });
    lane.narrative.invoked = true;
    lane.narrative.pass = r.status === 0;
    lane.narrative.out = path.join(outDir, 'narrative.verify.json');
    emit('bundle.verify.lane', { lane: 'narrative', status: r.status });
  } else {
    emit('bundle.verify.lane', { lane: 'narrative', missing: true });
  }

  if (fs.existsSync(dashVerify)) {
    const r = spawnSync(process.execPath, [dashVerify, '--dir', dir, '--out', outDir, '--require', requireDashboard ? 'true' : 'false'], { encoding: 'utf8' });
    lane.dashboard.invoked = true;
    lane.dashboard.pass = r.status === 0;
    lane.dashboard.out = path.join(outDir, 'world.dashboard.verify.json');
    emit('bundle.verify.lane', { lane: 'dashboard', status: r.status });
  } else {
    emit('bundle.verify.lane', { lane: 'dashboard', missing: true });
  }

  const wfJson = lane.waveform_render.out && fs.existsSync(lane.waveform_render.out) ? safeReadJson(lane.waveform_render.out) : null;
  const narrJson = lane.narrative.out && fs.existsSync(lane.narrative.out) ? safeReadJson(lane.narrative.out) : null;
  const dashJson = lane.dashboard.out && fs.existsSync(lane.dashboard.out) ? safeReadJson(lane.dashboard.out) : null;

  const failures = [];
  if (requireWaveformRender && !(wfJson && wfJson.verified === true)) failures.push('required waveform render not verified');
  if (requireNarrative && !(narrJson && narrJson.verified === true)) failures.push('required narrative not verified');
  if (requireDashboard && !(dashJson && dashJson.verified === true)) failures.push('required dashboard not verified');

  // pass means: policies satisfied. Optional lanes may be missing/unverified without failing.
  const pass = failures.length === 0;

  const bundleVerify = {
    schema_version: 1,
    kind: 'bundle.verify',
    pass,
    generated_at: deterministicIso(0),
    bundle_dir: dir,
    policy: {
      require_waveform_render: requireWaveformRender,
      require_narrative: requireNarrative,
      require_dashboard: requireDashboard,
    },
    lanes: {
      waveform_render: wfJson ? { ...wfJson } : { attached: false, verified: false },
      narrative: narrJson ? { ...narrJson } : { attached: false, verified: false },
      dashboard: dashJson ? { ...dashJson } : { attached: false, verified: false },
    },
    failures,
    run_id: sha256Text(
      [
        'bundle.verify.v1',
        `policy=${JSON.stringify({ requireWaveformRender, requireNarrative, requireDashboard })}`,
        `wf=${wfJson ? sha256File(lane.waveform_render.out) : ''}`,
        `narr=${narrJson ? sha256File(lane.narrative.out) : ''}`,
        `dash=${dashJson ? sha256File(lane.dashboard.out) : ''}`,
      ].join('\n')
    ),
  };

  const outJson = path.join(outDir, String(args['json-out'] || 'bundle.verify.json'));
  const outNdjson = path.join(outDir, String(args['ndjson-out'] || 'bundle-verify.ndjson'));
  writeJson(outJson, bundleVerify);
  emit('bundle.verify.end', { pass, failures: failures.length });
  writeNdjson(outNdjson, events);

  process.stdout.write(`${JSON.stringify({ pass, out: outJson })}\n`);
  if (!pass) process.exit(2);
}

try {
  main();
} catch (err) {
  process.stderr.write(String(err && err.message ? err.message : err) + '\n');
  process.exit(2);
}

#!/usr/bin/env node
/**
 * scripts/verify-dashboard.js
 *
 * Node-side verifier for world.dashboard.check.json.
 * Verifies output sha256 matches, and paths are bundle-safe.
 *
 * Outputs:
 * - world.dashboard.verify.json
 * - world-dashboard-verify.ndjson
 *
 * Policy:
 * - optional by default; fail-closed only when --require true
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

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

function sha256File(p) {
  return `sha256:${crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex')}`;
}

function sha256Text(s) {
  return `sha256:${crypto.createHash('sha256').update(Buffer.from(String(s), 'utf8')).digest('hex')}`;
}

function deterministicIso(seq) {
  return `1970-01-01T00:00:${String(seq % 60).padStart(2, '0')}Z`;
}

function isUnsafeRelativePath(p) {
  if (typeof p !== 'string' || !p) return true;
  if (path.isAbsolute(p)) return true;
  const norm = path.posix.normalize(p.replace(/\\/g, '/'));
  return norm.startsWith('../') || norm.includes('/../') || norm === '..';
}

function writeJson(p, obj) {
  fs.writeFileSync(p, `${JSON.stringify(obj, null, 2)}\n`, 'utf8');
}

function writeNdjson(p, rows) {
  fs.writeFileSync(p, `${rows.map((r) => JSON.stringify(r)).join('\n')}\n`, 'utf8');
}

function main() {
  const args = parseArgs(process.argv);
  const dir = path.resolve(String(args.dir || args['bundle-dir'] || args.bundle || '.'));
  const outDir = path.resolve(String(args.out || dir));
  fs.mkdirSync(outDir, { recursive: true });
  const requireOk = String(args.require || '').toLowerCase() === 'true';
  const checkRel = String(args.check || 'world.dashboard.check.json');
  const checkPath = path.join(dir, checkRel);

  const events = [];
  let seq = 1;
  const emit = (event, payload) => {
    const s = seq++;
    events.push({ seq: s, timestamp: deterministicIso(s), lane: 'dashboard', event, payload });
  };

  emit('dashboard.verify.start', { dir, out_dir: outDir, require: requireOk, check: checkRel });

  const failures = [];
  const issues = [];
  const verifiedOutputs = [];
  let attached = false;
  let verified = false;
  let check = null;

  if (!fs.existsSync(checkPath)) {
    issues.push(`missing check file: ${checkRel}`);
  } else {
    attached = true;
    try {
      check = JSON.parse(fs.readFileSync(checkPath, 'utf8'));
    } catch {
      issues.push(`invalid json: ${checkRel}`);
    }
  }

  if (check) {
    if (!(check.kind === 'world.dashboard.check' && check.schema_version === 1 && check.lane_id === 'dashboard')) {
      issues.push('unsupported check format');
    }
    if (check.pass !== true) {
      issues.push('check pass=false');
    }
    const outputs = check.outputs && typeof check.outputs === 'object' ? check.outputs : null;
    if (!outputs) {
      issues.push('check missing outputs');
    } else {
      for (const [name, meta] of Object.entries(outputs)) {
        const rel = meta && typeof meta.path === 'string' ? meta.path : null;
        const expected = meta && typeof meta.sha256 === 'string' ? meta.sha256 : null;
        if (!rel || !expected) {
          issues.push(`outputs[${name}] missing path/sha256`);
          continue;
        }
        if (isUnsafeRelativePath(rel)) {
          issues.push(`unsafe output path: ${rel}`);
          continue;
        }
        const abs = path.join(dir, rel);
        if (!fs.existsSync(abs)) {
          issues.push(`missing output file: ${rel}`);
          continue;
        }
        const actual = sha256File(abs);
        if (actual !== expected) {
          issues.push(`digest mismatch: ${rel}`);
          continue;
        }
        verifiedOutputs.push({ name, path: rel, sha256: actual });
      }
    }
    verified = issues.length === 0;
  }

  if (requireOk && !verified) failures.push('dashboard verification failed (require=true)');

  const out = {
    schema_version: 1,
    kind: 'world.dashboard.verify',
    lane_id: 'dashboard',
    pass: failures.length === 0,
    attached,
    verified,
    require: requireOk,
    issues,
    failures,
    inputs: {
      check: fs.existsSync(checkPath) ? { path: checkRel, sha256: sha256File(checkPath) } : null,
    },
    outputs: {
      verified_count: verifiedOutputs.length,
      files: verifiedOutputs,
    },
    run_id: sha256Text(
      [
        'world.dashboard.verify.v1',
        `require=${requireOk}`,
        `check_sha256=${fs.existsSync(checkPath) ? sha256File(checkPath) : ''}`,
        `issues=${issues.join('|')}`,
      ].join('\n')
    ),
  };

  const outJson = path.join(outDir, String(args['json-out'] || 'world.dashboard.verify.json'));
  const outNdjson = path.join(outDir, String(args['ndjson-out'] || 'world-dashboard-verify.ndjson'));
  writeJson(outJson, out);
  emit('dashboard.verify.end', { pass: out.pass, attached, verified, issues: issues.length, failures: failures.length });
  writeNdjson(outNdjson, events);

  process.stdout.write(`${JSON.stringify({ pass: out.pass, attached, verified, out: outJson })}\n`);
  if (!out.pass) process.exit(2);
}

try {
  main();
} catch (err) {
  process.stderr.write(String(err && err.message ? err.message : err) + '\n');
  process.exit(2);
}


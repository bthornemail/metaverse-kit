#!/usr/bin/env node
/**
 * scripts/verify-waveform-render.js
 *
 * Node-side verifier for waveform render artifacts.
 * This is CI truth (not browser-best-effort):
 * - verifies waveform.render.check.json structure
 * - verifies output sha256 digests match files on disk
 * - verifies referenced paths are bundle-safe relative paths
 *
 * Exits non-zero only when:
 * - --require true, and verification fails (fail-closed)
 * - OR a fatal error occurs (malformed args, etc)
 *
 * Outputs (in out-dir):
 * - waveform.render.verify.json
 * - waveform-render-verify.ndjson
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
  const dir = path.resolve(String(args.dir || args['bundle-dir'] || args['out-dir'] || args.bundle || '.'));
  const outDir = path.resolve(String(args.out || dir));
  fs.mkdirSync(outDir, { recursive: true });
  const requireOk = String(args.require || '').toLowerCase() === 'true';
  const checkRel = String(args.check || 'waveform.render.check.json');
  const checkPath = path.join(dir, checkRel);

  const events = [];
  let seq = 1;
  const emit = (event, payload) => {
    const s = seq++;
    events.push({ seq: s, timestamp: deterministicIso(s), lane: 'waveform', event, payload });
  };

  emit('waveform.render.verify.start', { dir, out_dir: outDir, require: requireOk, check: checkRel });

  const failures = [];
  const issues = [];
  let attached = false;
  let verified = false;
  let check = null;

  if (!fs.existsSync(checkPath)) {
    issues.push(`missing check file: ${checkRel}`);
  } else {
    attached = true;
    try {
      check = JSON.parse(fs.readFileSync(checkPath, 'utf8'));
    } catch (err) {
      issues.push(`invalid json: ${checkRel}`);
    }
  }
  emit('waveform.render.verify.check', { attached, issues: issues.slice() });

  if (check) {
    if (!(check.kind === 'waveform.render.check' && check.schema_version === 1 && check.lane_id === 'waveform')) {
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
        if (!meta || typeof meta !== 'object') {
          issues.push(`outputs[${name}] invalid`);
          continue;
        }
        const rel = meta.path;
        const expected = meta.sha256;
        if (typeof rel !== 'string' || typeof expected !== 'string') {
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
        }
      }
    }

    verified = issues.length === 0;
  }

  if (requireOk && !verified) {
    failures.push('waveform render verification failed (require=true)');
  }

  const out = {
    schema_version: 1,
    kind: 'waveform.render.verify',
    lane_id: 'waveform',
    pass: failures.length === 0,
    attached,
    verified,
    require: requireOk,
    issues,
    failures,
    inputs: {
      check: fs.existsSync(checkPath) ? { path: checkRel, sha256: sha256File(checkPath) } : null,
    },
    outputs: {},
    run_id: sha256Text(
      [
        'waveform.render.verify.v1',
        `require=${requireOk}`,
        `check_sha256=${fs.existsSync(checkPath) ? sha256File(checkPath) : ''}`,
        `issues=${issues.join('|')}`,
      ].join('\n')
    ),
  };

  const outJson = path.join(outDir, String(args['json-out'] || 'waveform.render.verify.json'));
  const outNdjson = path.join(outDir, String(args['ndjson-out'] || 'waveform-render-verify.ndjson'));
  writeJson(outJson, out);
  emit('waveform.render.verify.end', { pass: out.pass, attached, verified, issues: issues.length, failures: failures.length });
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


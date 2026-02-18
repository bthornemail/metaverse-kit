#!/usr/bin/env node
/**
 * Contract test for scripts/verify-narrative.js
 * - passes on intact artifacts
 * - fails in require mode when artifacts are tampered
 */

const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');
const { spawnSync } = require('child_process');

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

function sha256File(p) {
  return `sha256:${crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex')}`;
}

function readJson(p) {
  return JSON.parse(fs.readFileSync(p, 'utf8'));
}

function main() {
  const repoRoot = path.resolve(__dirname, '..');
  const render = path.join(repoRoot, 'scripts', 'render-narrative.js');
  const verify = path.join(repoRoot, 'scripts', 'verify-narrative.js');
  assert(fs.existsSync(render), `missing render: ${render}`);
  assert(fs.existsSync(verify), `missing verify: ${verify}`);

  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'mvk-narrative-verify-test-'));

  fs.writeFileSync(
    path.join(tmp, 'canon-manifest.ndjson'),
    JSON.stringify({ kind: 'series', path: 'canon-prelude.ndjson' }) + '\n',
    'utf8'
  );
  fs.writeFileSync(
    path.join(tmp, 'canon-prelude.ndjson'),
    [JSON.stringify({ event: 'paragraph', text: 'Hello' }), ''].join('\n'),
    'utf8'
  );

  const r = spawnSync(process.execPath, [render, '--out-dir', tmp, '--manifest', 'canon-manifest.ndjson', '--max-nodes', '10'], { encoding: 'utf8' });
  assert(r.status === 0, `render failed: ${r.status}\n${r.stderr || ''}`);

  const v1 = spawnSync(process.execPath, [verify, '--dir', tmp, '--out', tmp, '--require', 'false'], { encoding: 'utf8' });
  assert(v1.status === 0, `verify optional failed: ${v1.status}\n${v1.stderr || ''}`);
  const out1 = readJson(path.join(tmp, 'narrative.verify.json'));
  assert(out1.kind === 'narrative.verify', 'verify kind mismatch');
  assert(out1.pass === true, 'verify pass should be true');
  assert(out1.verified === true, 'verify verified should be true');

  // Tamper with timeline
  const tl = path.join(tmp, 'narrative.timeline.ndjson');
  fs.writeFileSync(tl, fs.readFileSync(tl, 'utf8') + JSON.stringify({ tamper: true }) + '\n', 'utf8');

  const v2 = spawnSync(process.execPath, [verify, '--dir', tmp, '--out', tmp, '--require', 'true'], { encoding: 'utf8' });
  assert(v2.status !== 0, 'verify require=true should fail after tamper');
  const out2 = readJson(path.join(tmp, 'narrative.verify.json'));
  assert(out2.pass === false, 'verify pass should be false after tamper');
  assert(out2.issues.some((s) => String(s).includes('digest mismatch')), 'expected digest mismatch issue');

  // Deterministic verify output across identical reruns
  const sha1 = sha256File(path.join(tmp, 'narrative.verify.json'));
  const v3 = spawnSync(process.execPath, [verify, '--dir', tmp, '--out', tmp, '--require', 'true'], { encoding: 'utf8' });
  assert(v3.status !== 0, 'verify require=true should still fail after tamper');
  const sha2 = sha256File(path.join(tmp, 'narrative.verify.json'));
  assert(sha1 === sha2, 'verify json digest changed across identical runs');

  process.stdout.write(JSON.stringify({ ok: true, tmp }) + '\n');
}

try {
  main();
} catch (err) {
  process.stderr.write(String(err && err.message ? err.message : err) + '\n');
  process.exit(1);
}


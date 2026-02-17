#!/usr/bin/env node
/**
 * Contract test for scripts/verify-waveform-render.js
 * - passes on intact artifacts
 * - fails in require mode when artifacts are tampered
 * - deterministic output shape
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
  const render = path.join(repoRoot, 'scripts', 'render-waveform.js');
  const verify = path.join(repoRoot, 'scripts', 'verify-waveform-render.js');
  assert(fs.existsSync(render), `missing render: ${render}`);
  assert(fs.existsSync(verify), `missing verify: ${verify}`);

  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'mvk-waveform-verify-test-'));
  fs.writeFileSync(path.join(tmp, 'waveform-points.txt'), '0.00000000 0.00000000 0.00000000\n1.00000000 1.00000000 1.00000000\n', 'utf8');
  fs.writeFileSync(path.join(tmp, 'waveform-analysis.ndjson'), JSON.stringify({ seq: 1, lane: 'waveform', run_id: 'sha256:dummy', event: 'waveform.analysis.start', payload: {} }) + '\n', 'utf8');

  // Render first
  const r = spawnSync(process.execPath, [render, '--out-dir', tmp], { encoding: 'utf8' });
  assert(r.status === 0, `render failed: ${r.status}\n${r.stderr || ''}`);

  // Verify optional (should pass)
  const v1 = spawnSync(process.execPath, [verify, '--dir', tmp, '--out', tmp, '--require', 'false'], { encoding: 'utf8' });
  assert(v1.status === 0, `verify optional failed: ${v1.status}\n${v1.stderr || ''}`);
  const out1 = readJson(path.join(tmp, 'waveform.render.verify.json'));
  assert(out1.kind === 'waveform.render.verify', 'verify kind mismatch');
  assert(out1.pass === true, 'verify pass should be true');
  assert(out1.verified === true, 'verify verified should be true');

  // Tamper with SVG
  const svgPath = path.join(tmp, 'waveform.canvas.svg');
  assert(fs.existsSync(svgPath), 'missing svg');
  fs.writeFileSync(svgPath, fs.readFileSync(svgPath, 'utf8') + '<!--tamper-->\n', 'utf8');

  // Verify require=true should fail
  const v2 = spawnSync(process.execPath, [verify, '--dir', tmp, '--out', tmp, '--require', 'true'], { encoding: 'utf8' });
  assert(v2.status !== 0, 'verify require=true should fail after tamper');
  const out2 = readJson(path.join(tmp, 'waveform.render.verify.json'));
  assert(out2.pass === false, 'verify pass should be false after tamper');
  assert(out2.issues.some((s) => String(s).includes('digest mismatch')), 'expected digest mismatch issue');

  // Deterministic output: rerun verify require=true and ensure verify json digest is stable (same inputs/outputs)
  const out2sha1 = sha256File(path.join(tmp, 'waveform.render.verify.json'));
  const v3 = spawnSync(process.execPath, [verify, '--dir', tmp, '--out', tmp, '--require', 'true'], { encoding: 'utf8' });
  assert(v3.status !== 0, 'verify require=true should still fail after tamper');
  const out2sha2 = sha256File(path.join(tmp, 'waveform.render.verify.json'));
  assert(out2sha1 === out2sha2, 'verify json digest changed across identical runs');

  process.stdout.write(JSON.stringify({ ok: true, tmp }) + '\n');
}

try {
  main();
} catch (err) {
  process.stderr.write(String(err && err.message ? err.message : err) + '\n');
  process.exit(1);
}


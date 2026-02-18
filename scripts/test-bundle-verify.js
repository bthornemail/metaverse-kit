#!/usr/bin/env node
/**
 * Contract test for scripts/verify-bundle.js
 * - optional policy passes even if lanes missing
 * - required policy fails if lanes missing
 * - passes when required lanes are present and verified
 */

const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');
const { spawnSync } = require('child_process');

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

function write(p, s) {
  fs.writeFileSync(p, s, 'utf8');
}

function main() {
  const repoRoot = path.resolve(__dirname, '..');
  const verifyBundle = path.join(repoRoot, 'scripts', 'verify-bundle.js');
  const renderWf = path.join(repoRoot, 'scripts', 'render-waveform.js');
  const renderNarr = path.join(repoRoot, 'scripts', 'render-narrative.js');
  const renderDash = path.join(repoRoot, 'scripts', 'render-dashboard.js');

  assert(fs.existsSync(verifyBundle), 'missing verify-bundle.js');
  assert(fs.existsSync(renderWf), 'missing render-waveform.js');
  assert(fs.existsSync(renderNarr), 'missing render-narrative.js');
  assert(fs.existsSync(renderDash), 'missing render-dashboard.js');

  // Case 1: empty dir, optional -> pass
  const tmp1 = fs.mkdtempSync(path.join(os.tmpdir(), 'mvk-bundle-verify-empty-'));
  const a1 = spawnSync(process.execPath, [verifyBundle, '--dir', tmp1, '--out', tmp1], { encoding: 'utf8' });
  assert(a1.status === 0, 'optional verify should pass on empty dir');

  // Case 2: empty dir, required narrative -> fail
  const a2 = spawnSync(process.execPath, [verifyBundle, '--dir', tmp1, '--out', tmp1, '--require-narrative', 'true'], { encoding: 'utf8' });
  assert(a2.status !== 0, 'required narrative should fail on empty dir');

  // Case 3: minimal narrative present, required narrative -> pass
  const tmp2 = fs.mkdtempSync(path.join(os.tmpdir(), 'mvk-bundle-verify-narr-'));
  write(path.join(tmp2, 'canon-manifest.ndjson'), JSON.stringify({ kind: 'series', path: 'canon-prelude.ndjson' }) + '\n');
  write(path.join(tmp2, 'canon-prelude.ndjson'), JSON.stringify({ event: 'paragraph', text: 'Hello' }) + '\n');
  const rN = spawnSync(process.execPath, [renderNarr, '--out-dir', tmp2, '--manifest', 'canon-manifest.ndjson', '--max-nodes', '10'], { encoding: 'utf8' });
  assert(rN.status === 0, 'render narrative failed');
  const b1 = spawnSync(process.execPath, [verifyBundle, '--dir', tmp2, '--out', tmp2, '--require-narrative', 'true'], { encoding: 'utf8' });
  assert(b1.status === 0, 'required narrative should pass when artifacts present');

  // Case 4: waveform render present, required waveform render -> pass
  const tmp3 = fs.mkdtempSync(path.join(os.tmpdir(), 'mvk-bundle-verify-wf-'));
  write(path.join(tmp3, 'waveform-points.txt'), '0.0 0.0 0.0\n1.0 1.0 1.0\n');
  const rW = spawnSync(process.execPath, [renderWf, '--out-dir', tmp3], { encoding: 'utf8' });
  assert(rW.status === 0, 'render waveform failed');
  const b2 = spawnSync(process.execPath, [verifyBundle, '--dir', tmp3, '--out', tmp3, '--require-waveform-render', 'true'], { encoding: 'utf8' });
  assert(b2.status === 0, 'required waveform render should pass when artifacts present');

  // Case 5: dashboard present, required dashboard -> pass
  const tmp4 = fs.mkdtempSync(path.join(os.tmpdir(), 'mvk-bundle-verify-dash-'));
  write(path.join(tmp4, 'floorplan.svg'), '<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100"></svg>\n');
  const rD = spawnSync(process.execPath, [renderDash, '--out-dir', tmp4, '--floorplan', 'floorplan.svg'], { encoding: 'utf8' });
  assert(rD.status === 0, 'render dashboard failed');
  const b3 = spawnSync(process.execPath, [verifyBundle, '--dir', tmp4, '--out', tmp4, '--require-dashboard', 'true'], { encoding: 'utf8' });
  assert(b3.status === 0, 'required dashboard should pass when artifacts present');

  process.stdout.write(JSON.stringify({ ok: true }) + '\n');
}

try {
  main();
} catch (err) {
  process.stderr.write(String(err && err.message ? err.message : err) + '\n');
  process.exit(1);
}

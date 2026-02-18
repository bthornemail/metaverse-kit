#!/usr/bin/env node
/**
 * Contract test for dashboard renderer + verifier:
 * - deterministic outputs across two runs
 * - verifier passes for intact artifacts
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

function main() {
  const repoRoot = path.resolve(__dirname, '..');
  const render = path.join(repoRoot, 'scripts', 'render-dashboard.js');
  const verify = path.join(repoRoot, 'scripts', 'verify-dashboard.js');
  assert(fs.existsSync(render), 'missing render-dashboard.js');
  assert(fs.existsSync(verify), 'missing verify-dashboard.js');

  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'mvk-dashboard-test-'));

  // Minimal floorplan SVG.
  fs.writeFileSync(
    path.join(tmp, 'floorplan.svg'),
    [
      '<?xml version="1.0" encoding="UTF-8"?>',
      '<svg xmlns="http://www.w3.org/2000/svg" width="800" height="500" viewBox="0 0 800 500">',
      '<rect x="0" y="0" width="800" height="500" fill="#111827"/>',
      '<rect x="60" y="60" width="680" height="380" fill="#0f172a" stroke="#334155"/>',
      '</svg>',
      '',
    ].join('\n'),
    'utf8'
  );

  // Minimal narrative scene patch.
  fs.writeFileSync(
    path.join(tmp, 'narrative.scene.patch.json'),
    JSON.stringify(
      {
        schema_version: 1,
        kind: 'narrative.scene.patch',
        lane_id: 'narrative',
        run_id: 'sha256:dummy',
        entities: [
          { id: 'canon:test#L1', label: 'Start', position: { x: 0.1, y: 0.2, z: 0.0 }, meta: { event: 'chapter', spawn: true } },
          { id: 'canon:test#L2', label: 'Next', position: { x: 0.7, y: 0.6, z: 0.0 }, meta: { event: 'paragraph', spawn: false } },
        ],
      },
      null,
      2
    ) + '\n',
    'utf8'
  );

  function runOnce() {
    return spawnSync(process.execPath, [render, '--out-dir', tmp, '--floorplan', 'floorplan.svg'], { encoding: 'utf8' });
  }

  const r1 = runOnce();
  assert(r1.status === 0, `render failed: ${r1.status}\n${r1.stderr || ''}`);
  const svg = path.join(tmp, 'world.dashboard.svg');
  const check = path.join(tmp, 'world.dashboard.check.json');
  assert(fs.existsSync(svg), 'missing world.dashboard.svg');
  assert(fs.existsSync(check), 'missing world.dashboard.check.json');
  const sha1 = { svg: sha256File(svg), check: sha256File(check) };

  const r2 = runOnce();
  assert(r2.status === 0, `render failed second run: ${r2.status}\n${r2.stderr || ''}`);
  const sha2 = { svg: sha256File(svg), check: sha256File(check) };
  assert(sha1.svg === sha2.svg, 'dashboard svg sha changed');
  assert(sha1.check === sha2.check, 'dashboard check sha changed');

  const v = spawnSync(process.execPath, [verify, '--dir', tmp, '--out', tmp, '--require', 'true'], { encoding: 'utf8' });
  assert(v.status === 0, `verify failed: ${v.status}\n${v.stderr || ''}`);

  process.stdout.write(JSON.stringify({ ok: true, tmp }) + '\n');
}

try {
  main();
} catch (err) {
  process.stderr.write(String(err && err.message ? err.message : err) + '\n');
  process.exit(1);
}


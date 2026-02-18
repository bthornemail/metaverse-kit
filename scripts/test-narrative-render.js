#!/usr/bin/env node
/**
 * Determinism contract test for scripts/render-narrative.js
 * - renders twice from minimal fixtures -> identical sha256 outputs
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
  const renderer = path.join(repoRoot, 'scripts', 'render-narrative.js');
  assert(fs.existsSync(renderer), `missing renderer: ${renderer}`);

  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'mvk-narrative-render-test-'));

  // Minimal manifest + series
  fs.writeFileSync(
    path.join(tmp, 'canon-manifest.ndjson'),
    JSON.stringify({ kind: 'series', path: 'canon-prelude.ndjson' }) + '\n',
    'utf8'
  );
  fs.writeFileSync(
    path.join(tmp, 'canon-prelude.ndjson'),
    [
      JSON.stringify({ event: 'series_start', text: 'Prelude start' }),
      JSON.stringify({ event: 'paragraph', text: 'First paragraph', matrix: [1, 2, 3], angle: 0.25 }),
      JSON.stringify({ event: 'verse', text: 'First verse' }),
      '',
    ].join('\n'),
    'utf8'
  );

  function runOnce() {
    return spawnSync(process.execPath, [renderer, '--out-dir', tmp, '--manifest', 'canon-manifest.ndjson', '--max-nodes', '10'], { encoding: 'utf8' });
  }

  const r1 = runOnce();
  assert(r1.status === 0, `renderer failed: ${r1.status}\n${r1.stderr || ''}`);

  const outTimeline = path.join(tmp, 'narrative.timeline.ndjson');
  const outScene = path.join(tmp, 'narrative.scene.patch.json');
  const outCheck = path.join(tmp, 'narrative.check.json');
  const outSave = path.join(tmp, 'narrative.save.template.json');
  assert(fs.existsSync(outTimeline), 'missing narrative.timeline.ndjson');
  assert(fs.existsSync(outScene), 'missing narrative.scene.patch.json');
  assert(fs.existsSync(outCheck), 'missing narrative.check.json');
  assert(fs.existsSync(outSave), 'missing narrative.save.template.json');

  const sha1 = { tl: sha256File(outTimeline), sc: sha256File(outScene), ck: sha256File(outCheck), sv: sha256File(outSave) };

  const r2 = runOnce();
  assert(r2.status === 0, `renderer failed second run: ${r2.status}\n${r2.stderr || ''}`);
  const sha2 = { tl: sha256File(outTimeline), sc: sha256File(outScene), ck: sha256File(outCheck), sv: sha256File(outSave) };

  assert(sha1.tl === sha2.tl, 'timeline sha changed across runs');
  assert(sha1.sc === sha2.sc, 'scene sha changed across runs');
  assert(sha1.ck === sha2.ck, 'check sha changed across runs');
  assert(sha1.sv === sha2.sv, 'save sha changed across runs');

  process.stdout.write(JSON.stringify({ ok: true, tmp }) + '\n');
}

try {
  main();
} catch (err) {
  process.stderr.write(String(err && err.message ? err.message : err) + '\n');
  process.exit(1);
}


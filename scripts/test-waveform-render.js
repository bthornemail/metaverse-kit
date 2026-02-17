#!/usr/bin/env node
/**
 * Determinism contract test for scripts/render-waveform.js
 * - render twice from same fixtures -> identical sha256 outputs
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
  const renderer = path.join(repoRoot, 'scripts', 'render-waveform.js');
  assert(fs.existsSync(renderer), `missing renderer: ${renderer}`);

  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'mvk-waveform-render-test-'));

  fs.writeFileSync(path.join(tmp, 'waveform-points.txt'), '0.00000000 0.00000000 0.00000000\n1.00000000 1.00000000 1.00000000\n', 'utf8');
  fs.writeFileSync(path.join(tmp, 'waveform-analysis.ndjson'), JSON.stringify({ seq: 1, lane: 'waveform', run_id: 'sha256:dummy', event: 'waveform.analysis.start', payload: {} }) + '\n', 'utf8');
  fs.writeFileSync(
    path.join(tmp, 'waveform.check.json'),
    JSON.stringify(
      {
        schema_version: 1,
        kind: 'waveform.check',
        lane_id: 'waveform',
        run_id: 'sha256:dummy',
        pass: true,
        config: { max_points: 2, timeout_ms: 1, allow_cabal: false },
        inputs: { ndjson_sha256: 'sha256:dummy', points_sha256: sha256File(path.join(tmp, 'waveform-points.txt')) },
        outputs: {
          'waveform-summary.json': { path: 'waveform-summary.json', sha256: 'sha256:dummy' },
          'waveform-points.txt': { path: 'waveform-points.txt', sha256: sha256File(path.join(tmp, 'waveform-points.txt')) },
          'waveform-analysis.ndjson': { path: 'waveform-analysis.ndjson', sha256: sha256File(path.join(tmp, 'waveform-analysis.ndjson')) }
        }
      },
      null,
      2
    ) + '\n',
    'utf8'
  );

  function runOnce() {
    return spawnSync(process.execPath, [renderer, '--out-dir', tmp], { encoding: 'utf8' });
  }

  const r1 = runOnce();
  assert(r1.status === 0, `renderer failed: ${r1.status}\n${r1.stderr || ''}`);

  const svg = path.join(tmp, 'waveform.canvas.svg');
  const scene = path.join(tmp, 'waveform.canisa.scene.json');
  const check = path.join(tmp, 'waveform.render.check.json');
  const ndjson = path.join(tmp, 'waveform-render.ndjson');
  assert(fs.existsSync(svg), 'missing waveform.canvas.svg');
  assert(fs.existsSync(scene), 'missing waveform.canisa.scene.json');
  assert(fs.existsSync(check), 'missing waveform.render.check.json');
  assert(fs.existsSync(ndjson), 'missing waveform-render.ndjson');

  const sha1 = { svg: sha256File(svg), scene: sha256File(scene), check: sha256File(check), ndjson: sha256File(ndjson) };

  const r2 = runOnce();
  assert(r2.status === 0, `renderer failed second run: ${r2.status}\n${r2.stderr || ''}`);
  const sha2 = { svg: sha256File(svg), scene: sha256File(scene), check: sha256File(check), ndjson: sha256File(ndjson) };

  assert(sha1.svg === sha2.svg, 'svg sha changed across runs');
  assert(sha1.scene === sha2.scene, 'scene sha changed across runs');
  assert(sha1.check === sha2.check, 'render.check sha changed across runs');
  assert(sha1.ndjson === sha2.ndjson, 'render ndjson sha changed across runs');

  const checkJson = readJson(check);
  assert(checkJson.kind === 'waveform.render.check', 'render.check kind mismatch');
  assert(checkJson.run_id && String(checkJson.run_id).startsWith('sha256:'), 'render.check run_id missing');
  assert(checkJson.inputs && checkJson.inputs.waveform_analysis_sha256, 'render.check missing inputs.waveform_analysis_sha256');
  assert(checkJson.inputs.waveform_analysis_sha256 === sha256File(path.join(tmp, 'waveform-analysis.ndjson')), 'analysis sha mismatch');

  process.stdout.write(JSON.stringify({ ok: true, tmp }) + '\n');
}

try {
  main();
} catch (err) {
  process.stderr.write(String(err && err.message ? err.message : err) + '\n');
  process.exit(1);
}


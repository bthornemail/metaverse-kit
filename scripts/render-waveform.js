#!/usr/bin/env node
/**
 * scripts/render-waveform.js
 *
 * Deterministic renderer for waveform lane artifacts.
 *
 * Inputs (in out-dir):
 * - waveform-points.txt (required)
 * - waveform-analysis.ndjson (optional but included in run_id + check if present)
 * - waveform.check.json (optional; used for max_points + provenance fields)
 *
 * Outputs (projection-only, written into out-dir):
 * - waveform.canvas.svg (required)
 * - waveform.canisa.scene.json (required)
 * - waveform.render.check.json (required)
 * - waveform-render.ndjson (required)
 *
 * Notes:
 * - Deterministic float formatting via toFixed(8)
 * - Stable entity ordering (file order / index order)
 * - No real timestamps in digested outputs (deterministicIso)
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

function ensureDir(p) {
  fs.mkdirSync(p, { recursive: true });
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

function stableFloat(x) {
  if (!Number.isFinite(x)) return '0.00000000';
  return Number(x).toFixed(8);
}

function clamp01(x) {
  if (!Number.isFinite(x)) return 0;
  return Math.max(0, Math.min(1, x));
}

function deterministicIso(seq) {
  return `1970-01-01T00:00:${String(seq % 60).padStart(2, '0')}Z`;
}

function readJsonSafe(p) {
  try {
    return JSON.parse(fs.readFileSync(p, 'utf8'));
  } catch {
    return null;
  }
}

function readPoints(pointsPath) {
  const rows = [];
  const lines = fs.readFileSync(pointsPath, 'utf8').split('\n').map((l) => l.trim()).filter(Boolean);
  for (const line of lines) {
    const parts = line.split(/\s+/);
    if (parts.length < 2) continue;
    const x = Number(parts[0]);
    const y = Number(parts[1]);
    const z = parts.length >= 3 ? Number(parts[2]) : 0;
    rows.push([clamp01(x), clamp01(y), clamp01(z)]);
  }
  return rows;
}

function rgbFromUnit(u) {
  const t = clamp01(u);
  const r = Math.round(255 * Math.min(1, Math.max(0, (t - 0.5) * 2)));
  const g = Math.round(255 * Math.min(1, Math.max(0, 1 - Math.abs(t - 0.5) * 2)));
  const b = Math.round(255 * Math.min(1, Math.max(0, (0.5 - t) * 2)));
  return `rgb(${r},${g},${b})`;
}

function buildSvg(points, cfg) {
  const width = cfg.width;
  const height = cfg.height;
  const pad = cfg.pad;
  const r = cfg.radius;
  const x0 = pad;
  const y0 = pad;
  const w = Math.max(1, width - pad * 2);
  const h = Math.max(1, height - pad * 2);

  const circles = points
    .map((p) => {
      const x = x0 + p[0] * w;
      const y = y0 + (1 - p[2]) * h;
      const fill = rgbFromUnit(p[1]);
      return `<circle cx="${stableFloat(x)}" cy="${stableFloat(y)}" r="${stableFloat(r)}" fill="${fill}" fill-opacity="0.85" />`;
    })
    .join('');

  return [
    `<?xml version="1.0" encoding="UTF-8"?>`,
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">`,
    `<rect x="0" y="0" width="${width}" height="${height}" fill="white" />`,
    `<g>${circles}</g>`,
    `</svg>`,
    ``
  ].join('\n');
}

function writeNdjson(filePath, events) {
  fs.writeFileSync(filePath, `${events.map((e) => JSON.stringify(e)).join('\n')}\n`, 'utf8');
}

function writeJson(filePath, obj) {
  fs.writeFileSync(filePath, `${JSON.stringify(obj, null, 2)}\n`, 'utf8');
}

function main() {
  const args = parseArgs(process.argv);
  const outDir = path.resolve(String(args['out-dir'] || args.out || '.'));
  ensureDir(outDir);

  const wfPointsRel = String(args.points || 'waveform-points.txt');
  const wfAnalysisRel = String(args.analysis || 'waveform-analysis.ndjson');
  const wfCheckRel = String(args.check || 'waveform.check.json');

  const wfPointsPath = path.join(outDir, wfPointsRel);
  const wfAnalysisPath = path.join(outDir, wfAnalysisRel);
  const wfCheckPath = path.join(outDir, wfCheckRel);

  if (!fs.existsSync(wfPointsPath)) throw new Error(`missing_points:${wfPointsPath}`);

  const wfCheck = fs.existsSync(wfCheckPath) ? readJsonSafe(wfCheckPath) : null;
  const maxPointsFromCheck =
    wfCheck && wfCheck.config && Number.isFinite(Number(wfCheck.config.max_points))
      ? Number(wfCheck.config.max_points)
      : null;

  const events = [];
  let seq = 1;
  function emit(event, payload) {
    const s = seq++;
    events.push({ seq: s, timestamp: deterministicIso(s), lane: 'waveform', event, payload });
  }

  const pointsSha = sha256File(wfPointsPath);
  const analysisExists = fs.existsSync(wfAnalysisPath);
  const analysisSha = analysisExists ? sha256File(wfAnalysisPath) : null;
  const checkSha = fs.existsSync(wfCheckPath) ? sha256File(wfCheckPath) : null;

  emit('waveform.render.start', { out_dir: path.basename(outDir) || '.', points: wfPointsRel, analysis: wfAnalysisRel, check: wfCheckRel });
  emit('waveform.render.inputs', { points_sha256: pointsSha, analysis_sha256: analysisSha, check_sha256: checkSha });

  let points = readPoints(wfPointsPath);
  if (maxPointsFromCheck && points.length > maxPointsFromCheck) {
    points = points.slice(0, maxPointsFromCheck);
  }
  emit('waveform.render.points.read', { path: wfPointsRel, points: points.length });

  const renderCfg = {
    width: Number(args.width || 1200),
    height: Number(args.height || 680),
    pad: Number(args.pad || 24),
    radius: Number(args.radius || 2.0),
    max_points: maxPointsFromCheck,
  };

  const renderRunId = sha256Text(
    [
      'waveform.render.v1',
      `points_sha256=${pointsSha}`,
      `analysis_sha256=${analysisSha || ''}`,
      `check_sha256=${checkSha || ''}`,
      `cfg=${JSON.stringify(renderCfg)}`
    ].join('\n')
  );

  const svgText = buildSvg(points, renderCfg);
  const svgRel = String(args.svg || 'waveform.canvas.svg');
  const svgPath = path.join(outDir, svgRel);
  fs.writeFileSync(svgPath, svgText, 'utf8');
  emit('waveform.render.svg', { path: svgRel, sha256: sha256Text(svgText) });

  const sceneRel = String(args.scene || 'waveform.canisa.scene.json');
  const scenePath = path.join(outDir, sceneRel);
  const scene = {
    schema_version: 1,
    kind: 'waveform.canisa.scene',
    generated_at: deterministicIso(0),
    lane_id: 'waveform',
    run_id: renderRunId,
    waveform_run_id: wfCheck && typeof wfCheck.run_id === 'string' ? wfCheck.run_id : null,
    inputs: {
      'waveform-points.txt': { path: wfPointsRel, sha256: pointsSha },
      'waveform-analysis.ndjson': analysisExists ? { path: wfAnalysisRel, sha256: analysisSha } : null,
      'waveform.check.json': fs.existsSync(wfCheckPath) ? { path: wfCheckRel, sha256: checkSha } : null
    },
    config: renderCfg,
    entities: points.map((p, i) => ({
      id: `wf:${i + 1}`,
      kind: 'waveform.point',
      position: { x: p[0], y: p[2], z: p[1] },
      color: rgbFromUnit(p[1])
    }))
  };
  writeJson(scenePath, scene);
  emit('waveform.render.scene', { path: sceneRel, sha256: sha256File(scenePath), entities: points.length });

  const renderCheckRel = String(args['render-check'] || 'waveform.render.check.json');
  const renderCheckPath = path.join(outDir, renderCheckRel);
  const renderCheck = {
    schema_version: 1,
    kind: 'waveform.render.check',
    lane_id: 'waveform',
    run_id: renderRunId,
    pass: true,
    generated_at: deterministicIso(0),
    inputs: {
      points_sha256: pointsSha,
      waveform_analysis_sha256: analysisSha,
      waveform_check_sha256: checkSha,
      config_sha256: sha256Text(JSON.stringify(renderCfg)),
    },
    outputs: {
      'waveform.canvas.svg': { path: svgRel, sha256: sha256File(svgPath) },
      'waveform.canisa.scene.json': { path: sceneRel, sha256: sha256File(scenePath) }
    },
    config: renderCfg
  };
  writeJson(renderCheckPath, renderCheck);
  emit('waveform.render.check', { path: renderCheckRel, sha256: sha256File(renderCheckPath) });

  const ndjsonRel = String(args['ndjson-out'] || 'waveform-render.ndjson');
  const ndjsonPath = path.join(outDir, ndjsonRel);
  writeNdjson(ndjsonPath, events);
  emit('waveform.render.end', { ok: true, run_id: renderRunId });

  process.stdout.write(
    `${JSON.stringify({ ok: true, out_dir: outDir, run_id: renderRunId, svg: svgRel, scene: sceneRel, check: renderCheckRel, ndjson: ndjsonRel })}\n`
  );
}

try {
  main();
} catch (err) {
  process.stderr.write(String(err && err.message ? err.message : err) + '\n');
  process.exit(2);
}


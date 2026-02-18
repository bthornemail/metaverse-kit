#!/usr/bin/env node
/**
 * scripts/render-dashboard.js
 *
 * Deterministic SVG dashboard snapshot:
 *   floorplan SVG + narrative artifacts + receipts -> world.dashboard.svg (+ check + ndjson)
 *
 * Inputs (bundle-local):
 * - --floorplan <svg> (required)
 * - narrative.scene.patch.json (optional, for node/spawn overlays)
 * - narrative.verify.json / bundle.verify.json (optional, for proof badges)
 *
 * Outputs (in out-dir):
 * - world.dashboard.svg
 * - world.dashboard.check.json
 * - dashboard-render.ndjson
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

function deterministicIso(seq) {
  return `1970-01-01T00:00:${String(seq % 60).padStart(2, '0')}Z`;
}

function stableFloat(x) {
  if (!Number.isFinite(x)) return '0.00000000';
  return Number(x).toFixed(8);
}

function safeReadJson(p) {
  try {
    return JSON.parse(fs.readFileSync(p, 'utf8'));
  } catch {
    return null;
  }
}

function stableStringify(value) {
  if (Array.isArray(value)) return `[${value.map((v) => stableStringify(v)).join(',')}]`;
  if (value && typeof value === 'object') {
    const keys = Object.keys(value).sort();
    return `{${keys.map((k) => `${JSON.stringify(k)}:${stableStringify(value[k])}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

function writeJson(p, obj) {
  fs.writeFileSync(p, `${stableStringify(obj)}\n`, 'utf8');
}

function writeNdjson(p, rows) {
  fs.writeFileSync(p, `${rows.map((r) => JSON.stringify(r)).join('\n')}\n`, 'utf8');
}

function extractSvgViewport(svgText) {
  const viewBox = (svgText.match(/\bviewBox\s*=\s*"([^"]+)"/i) || [])[1] || null;
  if (viewBox) {
    const parts = viewBox.trim().split(/\s+/).map(Number);
    if (parts.length === 4 && parts.every((n) => Number.isFinite(n))) {
      return { x: parts[0], y: parts[1], w: parts[2], h: parts[3] };
    }
  }
  const width = (svgText.match(/\bwidth\s*=\s*"([^"]+)"/i) || [])[1] || null;
  const height = (svgText.match(/\bheight\s*=\s*"([^"]+)"/i) || [])[1] || null;
  const w = width ? Number(String(width).replace(/px$/i, '')) : NaN;
  const h = height ? Number(String(height).replace(/px$/i, '')) : NaN;
  if (Number.isFinite(w) && Number.isFinite(h)) return { x: 0, y: 0, w, h };
  return { x: 0, y: 0, w: 1200, h: 680 };
}

function escapeXml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function colorFor(kind, spawn) {
  if (spawn) return '#ffd166';
  const k = String(kind || '').toLowerCase();
  if (k.includes('warning')) return '#fb7185';
  if (k.includes('covenant')) return '#60a5fa';
  if (k.includes('revelation')) return '#a78bfa';
  if (k.includes('chapter')) return '#34d399';
  return '#93c5fd';
}

function main() {
  const args = parseArgs(process.argv);
  const outDir = path.resolve(String(args['out-dir'] || args.out || '.'));
  ensureDir(outDir);

  function relOut(absPath) {
    const rel = path.relative(outDir, absPath).replace(/\\/g, '/');
    if (rel.startsWith('../') || rel === '..' || path.isAbsolute(rel)) throw new Error(`unsafe_output_path:${absPath}`);
    return rel;
  }

  const floorplanRel = args.floorplan || args['floorplan-svg'] || args.svg || null;
  if (!floorplanRel) throw new Error('missing --floorplan');
  const floorplanInputPath = path.isAbsolute(String(floorplanRel)) ? String(floorplanRel) : path.join(outDir, String(floorplanRel));
  if (!fs.existsSync(floorplanInputPath)) throw new Error(`missing_floorplan:${floorplanInputPath}`);

  // Bundle-local rule: outputs must be in outDir; inputs may come from outside outDir, but if so we
  // copy them in so the bundle is self-contained and reproducible.
  let floorplanPath = floorplanInputPath;
  let floorplanCopiedFrom = null;
  const relIn = path.relative(outDir, floorplanInputPath).replace(/\\/g, '/');
  const inputOutside = relIn.startsWith('../') || relIn === '..';
  if (inputOutside) {
    const dst = path.join(outDir, String(args['floorplan-copy-name'] || 'world.floorplan.svg'));
    fs.copyFileSync(floorplanInputPath, dst);
    floorplanPath = dst;
    floorplanCopiedFrom = path.basename(floorplanInputPath);
  }

  const narrativeSceneRel = String(args['narrative-scene'] || 'narrative.scene.patch.json');
  const narrativeVerifyRel = String(args['narrative-verify'] || 'narrative.verify.json');
  const bundleVerifyRel = String(args['bundle-verify'] || 'bundle.verify.json');

  const narrativeScenePath = path.isAbsolute(narrativeSceneRel) ? narrativeSceneRel : path.join(outDir, narrativeSceneRel);
  const narrativeVerifyPath = path.isAbsolute(narrativeVerifyRel) ? narrativeVerifyRel : path.join(outDir, narrativeVerifyRel);
  const bundleVerifyPath = path.isAbsolute(bundleVerifyRel) ? bundleVerifyRel : path.join(outDir, bundleVerifyRel);

  const floorplanText = fs.readFileSync(floorplanPath, 'utf8');
  const vp = extractSvgViewport(floorplanText);

  const narrativeScene = fs.existsSync(narrativeScenePath) ? safeReadJson(narrativeScenePath) : null;
  const narrativeVerify = fs.existsSync(narrativeVerifyPath) ? safeReadJson(narrativeVerifyPath) : null;
  const bundleVerify = fs.existsSync(bundleVerifyPath) ? safeReadJson(bundleVerifyPath) : null;

  const maxMarkers = Number(args['max-markers'] || 2000);
  const entities = Array.isArray(narrativeScene?.entities) ? narrativeScene.entities.slice(0, maxMarkers) : [];

  // Deterministic run_id from input digests + config.
  const inputs = {
    floorplan_svg: {
      path: relOut(floorplanPath),
      sha256: sha256File(floorplanPath),
      copied_from: floorplanCopiedFrom,
    },
    narrative_scene: fs.existsSync(narrativeScenePath) ? { path: relOut(narrativeScenePath), sha256: sha256File(narrativeScenePath) } : null,
    narrative_verify: fs.existsSync(narrativeVerifyPath) ? { path: relOut(narrativeVerifyPath), sha256: sha256File(narrativeVerifyPath) } : null,
    bundle_verify: fs.existsSync(bundleVerifyPath) ? { path: relOut(bundleVerifyPath), sha256: sha256File(bundleVerifyPath) } : null,
  };

  const cfg = { max_markers: maxMarkers };
  const runId = sha256Text(
    [
      'world.dashboard.v1',
      `floorplan=${inputs.floorplan_svg.sha256}`,
      `narrative_scene=${inputs.narrative_scene ? inputs.narrative_scene.sha256 : ''}`,
      `narrative_verify=${inputs.narrative_verify ? inputs.narrative_verify.sha256 : ''}`,
      `bundle_verify=${inputs.bundle_verify ? inputs.bundle_verify.sha256 : ''}`,
      `cfg=${JSON.stringify(cfg)}`,
    ].join('\n')
  );

  const events = [];
  let seq = 1;
  const emit = (event, payload) => {
    const s = seq++;
    events.push({ seq: s, timestamp: deterministicIso(s), lane: 'dashboard', run_id: runId, event, payload });
  };

  emit('dashboard.render.start', { out_dir: outDir, floorplan: path.basename(floorplanPath), entities: entities.length });

  // Overlay group: narrative markers + proof badge.
  const markers = entities
    .map((e, i) => {
      const id = e?.id ? String(e.id) : `n:${i + 1}`;
      const pos = e?.position || {};
      const ux = typeof pos.x === 'number' ? pos.x : 0;
      const uy = typeof pos.y === 'number' ? pos.y : 0;
      const spawn = Boolean(e?.meta?.spawn);
      // Map normalized 0..1 to viewBox coords.
      const x = vp.x + ux * vp.w;
      const y = vp.y + uy * vp.h;
      const r = spawn ? 8 : 5;
      const fill = colorFor(String(e?.meta?.event || e?.kind || ''), spawn);
      const label = e?.label ? String(e.label) : id;
      return [
        `<g id="${escapeXml(id)}" data-kind="narrative.node" data-spawn="${spawn ? 'true' : 'false'}">`,
        `<circle cx="${stableFloat(x)}" cy="${stableFloat(y)}" r="${stableFloat(r)}" fill="${fill}" fill-opacity="0.92" stroke="#0b1022" stroke-width="1.2" />`,
        `<text x="${stableFloat(x + r + 3)}" y="${stableFloat(y + 4)}" font-family="ui-monospace, Menlo, Consolas, monospace" font-size="12" fill="#e5e7eb" opacity="0.90">${escapeXml(label.slice(0, 64))}</text>`,
        `</g>`,
      ].join('');
    })
    .join('');

  const badgeLines = [];
  if (bundleVerify) badgeLines.push(`bundle.verify: ${bundleVerify.pass === true ? 'OK' : 'FAIL'}`);
  if (narrativeVerify) badgeLines.push(`narrative.verify: ${narrativeVerify.verified === true ? 'OK' : 'FAIL'}`);
  badgeLines.push(`markers: ${entities.length}`);

  const badge = [
    `<g id="proof" data-kind="proof">`,
    `<rect x="${stableFloat(vp.x + 12)}" y="${stableFloat(vp.y + 12)}" width="260" height="${stableFloat(22 + badgeLines.length * 16)}" rx="10" ry="10" fill="rgba(17,24,39,0.78)" stroke="rgba(148,163,184,0.35)" />`,
    `<text x="${stableFloat(vp.x + 24)}" y="${stableFloat(vp.y + 34)}" font-family="ui-monospace, Menlo, Consolas, monospace" font-size="12" fill="#e5e7eb">world.dashboard</text>`,
    ...badgeLines.map((t, i) => `<text x="${stableFloat(vp.x + 24)}" y="${stableFloat(vp.y + 52 + i * 16)}" font-family="ui-monospace, Menlo, Consolas, monospace" font-size="12" fill="#cbd5e1">${escapeXml(t)}</text>`),
    `</g>`,
  ].join('');

  const meta = {
    schema_version: 1,
    kind: 'world.dashboard',
    lane_id: 'dashboard',
    run_id: runId,
    generated_at: deterministicIso(0),
    inputs,
    config: cfg,
  };

  const overlay = [
    `<metadata id="mvk-dashboard-meta">${escapeXml(stableStringify(meta))}</metadata>`,
    `<g id="mvk-dashboard-overlay" data-run-id="${escapeXml(runId)}">`,
    badge,
    `<g id="narrative-markers" data-kind="narrative.markers">`,
    markers,
    `</g>`,
    `</g>`,
  ].join('\n');

  // Inject overlay before closing </svg>
  const idx = floorplanText.lastIndexOf('</svg>');
  if (idx < 0) throw new Error('invalid_svg:missing </svg>');
  const outSvgText = `${floorplanText.slice(0, idx)}\n${overlay}\n${floorplanText.slice(idx)}`;

  const outSvg = path.join(outDir, String(args.outSvg || args.svgOut || 'world.dashboard.svg'));
  fs.writeFileSync(outSvg, outSvgText, 'utf8');
  emit('dashboard.render.svg', { path: relOut(outSvg), sha256: sha256Text(outSvgText) });

  const outNdjson = path.join(outDir, String(args.ndjsonOut || 'dashboard-render.ndjson'));
  writeNdjson(outNdjson, events);

  const check = {
    schema_version: 1,
    kind: 'world.dashboard.check',
    lane_id: 'dashboard',
    run_id: runId,
    pass: true,
    generated_at: deterministicIso(0),
    inputs,
    outputs: {
      'world.dashboard.svg': { path: relOut(outSvg), sha256: sha256File(outSvg) },
      'dashboard-render.ndjson': { path: relOut(outNdjson), sha256: sha256File(outNdjson) },
    },
    config: cfg,
  };

  const outCheck = path.join(outDir, String(args.checkOut || 'world.dashboard.check.json'));
  writeJson(outCheck, check);
  emit('dashboard.render.check', { path: relOut(outCheck), sha256: sha256File(outCheck) });

  process.stdout.write(`${JSON.stringify({ ok: true, out_dir: outDir, run_id: runId, svg: relOut(outSvg) })}\n`);
}

try {
  main();
} catch (err) {
  process.stderr.write(String(err && err.message ? err.message : err) + '\n');
  process.exit(2);
}

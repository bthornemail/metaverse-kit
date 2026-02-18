#!/usr/bin/env node
/**
 * scripts/render-narrative.js
 *
 * Projection-only deterministic renderer:
 *   canon-manifest.ndjson + canon-*.ndjson -> narrative artifacts (timeline + scene patch + check).
 *
 * Inputs (in out-dir unless overridden):
 * - canon-manifest.ndjson (required)
 * - referenced canon-*.ndjson (required if present in manifest)
 *
 * Outputs (written into out-dir):
 * - narrative.timeline.ndjson (required)
 * - narrative.scene.patch.json (required)
 * - narrative.check.json (required)
 * - narrative.save.template.json (required)
 *
 * Determinism:
 * - stable ordering: manifest file order, then line order
 * - stable float formatting in scene: toFixed(8)
 * - no wall-clock timestamps in artifacts (deterministicIso)
 * - run_id = sha256(inputs digests + config)
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

function clamp01(x) {
  if (!Number.isFinite(x)) return 0;
  return Math.max(0, Math.min(1, x));
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

function safeJsonParse(line, src, lineNo) {
  try {
    return JSON.parse(line);
  } catch (err) {
    throw new Error(`ndjson_parse_error:${src}:line=${lineNo}:${String(err && err.message ? err.message : err)}`);
  }
}

function extractText(obj) {
  if (!obj || typeof obj !== 'object') return null;
  const directKeys = ['text', 'paragraph', 'verse', 'content', 'line', 'message', 'body'];
  for (const k of directKeys) {
    if (typeof obj[k] === 'string' && obj[k].trim()) return obj[k].trim();
  }
  if (obj.payload && typeof obj.payload === 'object' && obj.payload !== null) {
    for (const k of directKeys) {
      if (typeof obj.payload[k] === 'string' && obj.payload[k].trim()) return obj.payload[k].trim();
    }
  }
  return null;
}

function isContentEvent(obj) {
  const e = String(obj.event || obj.kind || obj.type || '').toLowerCase();
  if (!e) return false;
  const allow = new Set([
    'paragraph',
    'verse',
    'chapter',
    'character',
    'covenant',
    'insight',
    'warning',
    'confession',
    'closing',
    'revelation',
    'dialogue',
    'teaching',
    'series_start',
    'series_end',
  ]);
  if (allow.has(e)) return true;
  // fallback: if it has text, treat as content-bearing
  return Boolean(extractText(obj));
}

function detectSeriesPathsFromManifest(manifestLines) {
  const paths = [];
  for (const row of manifestLines) {
    if (!row || typeof row !== 'object') continue;
    const p = row.path || (row.payload && row.payload.path) || null;
    if (typeof p === 'string' && p.endsWith('.ndjson')) {
      paths.push(p);
      continue;
    }
    // sometimes: {series:{path:"canon-prelude.ndjson"}}
    if (row.series && typeof row.series === 'object' && typeof row.series.path === 'string') {
      const sp = row.series.path;
      if (sp.endsWith('.ndjson')) paths.push(sp);
    }
  }
  // stable dedupe
  return [...new Set(paths)];
}

function hashToUnitFloats(id) {
  const h = crypto.createHash('sha256').update(String(id)).digest();
  // Use 6 bytes -> 3 uint16 -> 0..1
  const u0 = h.readUInt16BE(0);
  const u1 = h.readUInt16BE(2);
  const u2 = h.readUInt16BE(4);
  return [u0 / 65535, u1 / 65535, u2 / 65535];
}

function tryExtractMatrixAngle(obj) {
  const candidate = (o) => {
    if (!o || typeof o !== 'object') return { matrix: null, angle: null };
    const matrix = Array.isArray(o.matrix) ? o.matrix : null;
    const angle = typeof o.angle === 'number' ? o.angle : (typeof o.angle === 'string' ? Number(o.angle) : null);
    return { matrix, angle: Number.isFinite(angle) ? angle : null };
  };
  const a = candidate(obj);
  if (a.matrix || a.angle !== null) return a;
  if (obj.payload && typeof obj.payload === 'object') return candidate(obj.payload);
  return { matrix: null, angle: null };
}

function main() {
  const args = parseArgs(process.argv);
  const outDir = path.resolve(String(args['out-dir'] || args.out || '.'));
  ensureDir(outDir);

  function relOut(absPath) {
    const rel = path.relative(outDir, absPath).replace(/\\/g, '/');
    if (rel.startsWith('../') || rel === '..' || path.isAbsolute(rel)) {
      throw new Error(`unsafe_output_path:${absPath}`);
    }
    return rel;
  }

  const manifestRel = String(args.manifest || 'canon-manifest.ndjson');
  const manifestPath = path.isAbsolute(manifestRel) ? manifestRel : path.join(outDir, manifestRel);
  if (!fs.existsSync(manifestPath)) throw new Error(`missing_manifest:${manifestPath}`);

  const maxNodes = Number(args['max-nodes'] || 2000);
  const maxText = Number(args['max-text'] || 240);

  const manifestLinesRaw = fs.readFileSync(manifestPath, 'utf8').split('\n').map((l) => l.trim()).filter(Boolean);
  const manifestLines = manifestLinesRaw.map((line, i) => safeJsonParse(line, path.basename(manifestPath), i + 1));
  const seriesPaths = detectSeriesPathsFromManifest(manifestLines);

  const inputFiles = [{ path: path.basename(manifestPath), abs: manifestPath, sha256: sha256File(manifestPath) }];
  const seriesAbs = seriesPaths.map((p) => (path.isAbsolute(p) ? p : path.join(path.dirname(manifestPath), p)));
  for (let i = 0; i < seriesPaths.length; i += 1) {
    const abs = seriesAbs[i];
    if (!fs.existsSync(abs)) throw new Error(`missing_series:${seriesPaths[i]}`);
    inputFiles.push({ path: seriesPaths[i], abs, sha256: sha256File(abs) });
  }

  const cfg = { max_nodes: maxNodes, max_text: maxText };
  const runId = sha256Text(
    [
      'narrative.render.v1',
      ...inputFiles.map((f) => `${f.path}=${f.sha256}`),
      `cfg=${JSON.stringify(cfg)}`
    ].join('\n')
  );

  // Build timeline nodes
  const timeline = [];
  const placementHints = new Map(); // node_id -> {matrix, angle}
  let globalSeq = 1;
  function pushNode(node) {
    if (timeline.length >= maxNodes) return;
    timeline.push(node);
  }

  for (let s = 0; s < seriesPaths.length; s += 1) {
    const rel = seriesPaths[s];
    const abs = seriesAbs[s];
    // Cache series lines once (avoid O(n^2) rereads during entity placement).
    const lines = fs.readFileSync(abs, 'utf8').split('\n').map((l) => l.trim()).filter(Boolean);
    for (let i = 0; i < lines.length; i += 1) {
      const obj = safeJsonParse(lines[i], rel, i + 1);
      if (!isContentEvent(obj)) continue;
      const text = extractText(obj) || '';
      const event = String(obj.event || obj.kind || obj.type || 'content');
      const nodeId = `canon:${rel}#L${i + 1}`;
      placementHints.set(nodeId, tryExtractMatrixAngle(obj));
      const tags = [];
      if (event) tags.push(event);
      if (obj.series) tags.push(`series:${String(obj.series)}`);
      pushNode({
        schema_version: 1,
        kind: 'narrative.node',
        lane: 'narrative',
        run_id: runId,
        seq: globalSeq++,
        node_id: nodeId,
        series_path: rel,
        source_line: i + 1,
        event,
        text: text.length > maxText ? `${text.slice(0, maxText)}…` : text,
        tags,
      });
      if (timeline.length >= maxNodes) break;
    }
    if (timeline.length >= maxNodes) break;
  }

  // Deterministic placement: prefer matrix/angle, else hash->grid.
  const entities = timeline.map((n, idx) => {
    const hint = placementHints.get(n.node_id) || { matrix: null, angle: null };
    const { matrix, angle } = hint;

    let ux = 0, uy = 0, uz = 0;
    if (Array.isArray(matrix) && matrix.length >= 2) {
      const mx = Number(matrix[0]);
      const my = Number(matrix[1]);
      const mz = Number(matrix[2] ?? 0);
      // Normalize from unknown scale deterministically by clamping into [-1e6..1e6] then mapping to 0..1.
      const nx = clamp01((Math.max(-1e6, Math.min(1e6, mx)) + 1e6) / 2e6);
      const ny = clamp01((Math.max(-1e6, Math.min(1e6, my)) + 1e6) / 2e6);
      const nz = clamp01((Math.max(-1e6, Math.min(1e6, mz)) + 1e6) / 2e6);
      ux = nx; uy = ny; uz = nz;
    } else {
      const [a, b, c] = hashToUnitFloats(n.node_id);
      // Make it look nicer as a grid strip:
      const cols = 60;
      const gx = (idx % cols) / Math.max(1, cols - 1);
      const gy = Math.floor(idx / cols) / Math.max(1, Math.ceil(timeline.length / cols) - 1);
      ux = clamp01(0.65 * gx + 0.35 * a);
      uy = clamp01(0.65 * gy + 0.35 * b);
      uz = clamp01(c);
    }
    if (Number.isFinite(angle)) {
      // fold angle into z slightly to avoid flatness
      uz = clamp01(0.85 * uz + 0.15 * (Math.abs(angle) % (Math.PI * 2)) / (Math.PI * 2));
    }

    return {
      id: n.node_id,
      kind: 'narrative.node',
      label: n.text ? n.text.slice(0, 64) : n.node_id,
      position: { x: Number(stableFloat(ux)), y: Number(stableFloat(uy)), z: Number(stableFloat(uz)) },
      meta: {
        event: n.event,
        series_path: n.series_path,
        source_line: n.source_line,
      }
    };
  });

  const outTimeline = path.join(outDir, String(args.timeline || 'narrative.timeline.ndjson'));
  const outScene = path.join(outDir, String(args.scene || 'narrative.scene.patch.json'));
  const outCheck = path.join(outDir, String(args.check || 'narrative.check.json'));
  const outSave = path.join(outDir, String(args.save || 'narrative.save.template.json'));

  // Strip internal-only fields if any were added later; keep the output schema stable.
  writeNdjson(outTimeline, timeline);
  const scenePatch = {
    schema_version: 1,
    kind: 'narrative.scene.patch',
    lane_id: 'narrative',
    run_id: runId,
    generated_at: deterministicIso(0),
    entities,
    layout: {
      bounds: { min: { x: 0, y: 0, z: 0 }, max: { x: 1, y: 1, z: 1 } },
      note: 'positions are normalized 0..1 (viewer chooses world scale)'
    }
  };
  writeJson(outScene, scenePatch);

  const saveTemplate = {
    schema_version: 1,
    kind: 'narrative.save',
    lane_id: 'narrative',
    run_id: runId,
    generated_at: deterministicIso(0),
    last_node_id: null,
    visited: [],
    facts: {},
    inventory: {},
  };
  writeJson(outSave, saveTemplate);

  const outTimelineRel = relOut(outTimeline);
  const outSceneRel = relOut(outScene);
  const outSaveRel = relOut(outSave);

  const checkObj = {
    schema_version: 1,
    kind: 'narrative.check',
    lane_id: 'narrative',
    run_id: runId,
    pass: true,
    generated_at: deterministicIso(0),
    config: cfg,
    inputs: Object.fromEntries(inputFiles.map((f) => [f.path, { path: f.path, sha256: f.sha256 }])),
    outputs: {
      'narrative.timeline.ndjson': { path: outTimelineRel, sha256: sha256File(outTimeline) },
      'narrative.scene.patch.json': { path: outSceneRel, sha256: sha256File(outScene) },
      'narrative.save.template.json': { path: outSaveRel, sha256: sha256File(outSave) },
    },
  };
  writeJson(outCheck, checkObj);

  process.stdout.write(
    `${JSON.stringify({ ok: true, out_dir: outDir, run_id: runId, nodes: timeline.length })}\n`
  );
}

try {
  main();
} catch (err) {
  process.stderr.write(String(err && err.message ? err.message : err) + '\n');
  process.exit(2);
}

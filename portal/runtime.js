import { verifyBundle } from "./verify.js";
import { renderGraph, renderHarmonic, renderStory } from "./render.js";
import { renderNarrativeStates } from "./narrative-mode.js";
import { renderEntityScene } from "./entity-scene-adapter.js";
import { renderWorldRelations } from "./world-relations-adapter.js";
import { renderWorldBehavior } from "./world-behavior-adapter.js";

const PROPOSAL_VERSION = "wave16.proposal_bundle.v0";

async function fetchJson(path) {
  const res = await fetch(path, { cache: "no-store" });
  if (!res.ok) throw new Error(`fetch failed: ${path}`);
  return res.json();
}

async function fetchNdjson(path) {
  const res = await fetch(path, { cache: "no-store" });
  if (!res.ok) throw new Error(`fetch failed: ${path}`);
  const txt = await res.text();
  return txt.split("\n").filter(Boolean).map((line) => JSON.parse(line));
}

async function tryFetchText(path) {
  const res = await fetch(path, { cache: "no-store" });
  if (!res.ok) return null;
  return await res.text();
}

async function tryFetchJson(path) {
  const res = await fetch(path, { cache: "no-store" });
  if (!res.ok) return null;
  return await res.json();
}

async function tryFetchNdjson(path) {
  const res = await fetch(path, { cache: "no-store" });
  if (!res.ok) return null;
  const txt = await res.text();
  return txt
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean)
    .map((line) => JSON.parse(line));
}

function drawWaveform3D(canvas, scene) {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  const entities = Array.isArray(scene?.entities) ? scene.entities : [];
  if (entities.length === 0) {
    ctx.fillStyle = "rgba(158,183,186,0.8)";
    ctx.font = "12px ui-monospace, Menlo, Consolas, monospace";
    ctx.fillText("no waveform entities", 12, 18);
    return;
  }

  const w = canvas.width;
  const h = canvas.height;
  const cx = w / 2;
  const cy = h / 2;
  const scale = Math.min(w, h) * 0.42;
  const yaw = Math.PI / 5;
  const pitch = Math.PI / 10;

  function rotY([x, y, z]) {
    const c = Math.cos(yaw);
    const s = Math.sin(yaw);
    return [c * x + s * z, y, -s * x + c * z];
  }
  function rotX([x, y, z]) {
    const c = Math.cos(pitch);
    const s = Math.sin(pitch);
    return [x, c * y - s * z, s * y + c * z];
  }
  function project([x, y, z]) {
    const d = 2.4;
    const k = 1 / (d - z);
    return [cx + x * scale * k, cy - y * scale * k, k];
  }

  const pts = entities
    .slice(0, 2000)
    .map((e, i) => {
      const p = e?.position || {};
      const x = typeof p.x === "number" ? p.x * 2 - 1 : 0;
      const y = typeof p.y === "number" ? p.y * 2 - 1 : 0;
      const z = typeof p.z === "number" ? p.z * 2 - 1 : 0;
      let v = rotY([x, y, z]);
      v = rotX(v);
      const [sx, sy, k] = project(v);
      return { id: e?.id || `wf:${i}`, sx, sy, k, color: e?.color || "rgb(34,197,94)" };
    })
    .sort((a, b) => a.k - b.k);

  ctx.fillStyle = "rgba(15,20,22,0.4)";
  ctx.fillRect(0, 0, w, h);
  ctx.strokeStyle = "rgba(79,195,247,0.18)";
  ctx.strokeRect(0.5, 0.5, w - 1, h - 1);

  for (const p of pts) {
    const r = Math.max(0.6, Math.min(3.2, 2.2 * p.k));
    ctx.beginPath();
    ctx.fillStyle = p.color;
    ctx.globalAlpha = 0.78;
    ctx.arc(p.sx, p.sy, r, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
  ctx.fillStyle = "rgba(158,183,186,0.85)";
  ctx.font = "12px ui-monospace, Menlo, Consolas, monospace";
  ctx.fillText(`points: ${pts.length}`, 12, h - 12);
}

function stableStringify(value) {
  if (Array.isArray(value)) {
    return `[${value.map((v) => stableStringify(v)).join(",")}]`;
  }
  if (value && typeof value === "object") {
    const keys = Object.keys(value).sort();
    return `{${keys.map((k) => `${JSON.stringify(k)}:${stableStringify(value[k])}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

function canonicalJson(obj) {
  return `${stableStringify(obj)}\n`;
}

async function sha256PrefFromText(txt) {
  const bytes = new TextEncoder().encode(txt);
  const hash = await crypto.subtle.digest("SHA-256", bytes);
  const hex = [...new Uint8Array(hash)].map((b) => b.toString(16).padStart(2, "0")).join("");
  return `sha256:${hex}`;
}

async function sha256PrefFromBytes(bytes) {
  const hash = await crypto.subtle.digest("SHA-256", bytes);
  const hex = [...new Uint8Array(hash)].map((b) => b.toString(16).padStart(2, "0")).join("");
  return `sha256:${hex}`;
}

function buildActions(selectedNodeIds) {
  return [...selectedNodeIds]
    .sort((a, b) => a.localeCompare(b))
    .map((nodeId) => ({
      kind: "annotate_node",
      target: nodeId,
      payload: {
        source: "portal",
        tag: "selected",
        value: "1",
      },
    }));
}

async function buildProposal(baseBundleDigest, actions) {
  const payload = {
    actions,
    author: "portal:local",
    base_bundle_digest: baseBundleDigest,
    summary: {
      action_count: String(actions.length),
      authority: "advisory",
    },
    v: PROPOSAL_VERSION,
  };
  const digest = await sha256PrefFromText(canonicalJson(payload));
  return {
    ...payload,
    digest,
  };
}

function downloadText(filename, text) {
  const blob = new Blob([text], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

async function main() {
  const status = document.getElementById("status");
  const proposalStatus = document.getElementById("proposalStatus");
  const exportBtn = document.getElementById("exportProposal");
  const waveformToggle = document.getElementById("waveformToggle");
  const waveformStatus = document.getElementById("waveformStatus");
  const waveform2d = document.getElementById("waveform2d");
  const waveform3d = document.getElementById("waveform3d");
  const narrativeToggle = document.getElementById("narrativeToggle");
  const narrativeStatus = document.getElementById("narrativeStatus");
  const narrativeNow = document.getElementById("narrativeNow");
  const narrativeList = document.getElementById("narrativeList");

  const selectedNodeIds = new Set();
  let baseBundleDigest = "";
  let graph = null;

  const rerenderGraph = () => {
    if (!graph) return;
    renderGraph(
      document.getElementById("graph"),
      graph,
      selectedNodeIds,
      (nodeId) => {
        if (selectedNodeIds.has(nodeId)) selectedNodeIds.delete(nodeId);
        else selectedNodeIds.add(nodeId);
        proposalStatus.textContent = `${selectedNodeIds.size} selected`;
        rerenderGraph();
      }
    );
  };

  exportBtn.addEventListener("click", async () => {
    try {
      if (!baseBundleDigest) throw new Error("bundle not loaded");
      const actions = buildActions(selectedNodeIds);
      const proposal = await buildProposal(baseBundleDigest, actions);
      const text = canonicalJson(proposal);
      downloadText("proposal_bundle.json", text);
      proposalStatus.textContent = `exported ${proposal.summary.action_count} actions`;
      proposalStatus.className = "small good";
    } catch (err) {
      proposalStatus.textContent = `export failed: ${err.message || err}`;
      proposalStatus.className = "small bad";
    }
  });

  // Waveform view is intentionally independent of the metaverse-kit bundle roles.
  // If a directory contains only waveform artifacts, this portal should still be able to show them.
  async function setWaveformEnabled(enabled) {
    if (!waveformStatus || !waveform2d || !waveform3d) return;
    if (!enabled) {
      waveformStatus.textContent = "";
      waveform2d.innerHTML = "";
      const ctx = waveform3d.getContext("2d");
      if (ctx) ctx.clearRect(0, 0, waveform3d.width, waveform3d.height);
      return;
    }
    waveformStatus.textContent = "loading…";
    waveformStatus.className = "small";

    const svgText = await tryFetchText("../waveform.canvas.svg");
    const sceneJson = await tryFetchJson("../waveform.canisa.scene.json");
    if (!svgText && !sceneJson) {
      waveformStatus.textContent = "No waveform artifacts in this bundle.";
      waveformStatus.className = "small bad";
      waveform2d.innerHTML = "";
      const ctx = waveform3d.getContext("2d");
      if (ctx) ctx.clearRect(0, 0, waveform3d.width, waveform3d.height);
      return;
    }

    const requireWaveformRender = new URL(window.location.href).searchParams.get("require_waveform_render") === "true";
    if (requireWaveformRender) {
      const check = await tryFetchJson("../waveform.render.check.json");
      if (!check) {
        waveformStatus.textContent = "missing waveform.render.check.json (required)";
        waveformStatus.className = "small bad";
        return;
      }
      if (check.pass !== true) {
        waveformStatus.textContent = "waveform.render.check.json pass=false (required)";
        waveformStatus.className = "small bad";
        return;
      }
      if (svgText) {
        const svgBytes = new TextEncoder().encode(svgText);
        const svgSha = await sha256PrefFromBytes(svgBytes);
        const expectedSvg = check.outputs && check.outputs["waveform.canvas.svg"] ? check.outputs["waveform.canvas.svg"].sha256 : null;
        if (expectedSvg && expectedSvg !== svgSha) {
          waveformStatus.textContent = "waveform.canvas.svg digest mismatch (required)";
          waveformStatus.className = "small bad";
          return;
        }
      }
    }

    if (svgText) {
      const blob = new Blob([svgText], { type: "image/svg+xml" });
      const url = URL.createObjectURL(blob);
      waveform2d.innerHTML = "";
      const img = document.createElement("img");
      img.alt = "waveform.canvas.svg";
      img.src = url;
      waveform2d.appendChild(img);
    } else {
      waveform2d.innerHTML = `<div class="small">missing waveform.canvas.svg</div>`;
    }

    if (sceneJson) {
      drawWaveform3D(waveform3d, sceneJson);
    } else {
      const ctx = waveform3d.getContext("2d");
      if (ctx) {
        ctx.clearRect(0, 0, waveform3d.width, waveform3d.height);
        ctx.fillStyle = "rgba(158,183,186,0.8)";
        ctx.font = "12px ui-monospace, Menlo, Consolas, monospace";
        ctx.fillText("missing waveform.canisa.scene.json", 12, 18);
      }
    }

    waveformStatus.textContent = "waveform loaded";
    waveformStatus.className = "small good";
  }

  if (waveformToggle) {
    waveformToggle.addEventListener("change", () => {
      void setWaveformEnabled(Boolean(waveformToggle.checked));
    });
    const auto = new URL(window.location.href).searchParams.get("mode") === "waveform";
    if (auto) {
      waveformToggle.checked = true;
      void setWaveformEnabled(true);
    }
  }

  // Narrative loop: bundle-local, optional, deterministic, non-gating.
  // Files:
  // - narrative.timeline.ndjson: ordered nodes
  // - narrative.scene.patch.json: spawnables (not used by this portal yet)
  // - narrative.save.template.json: save scaffold (optional)
  const NARR_SAVE_KEY = "mvk:narrative.save";
  async function setNarrativeEnabled(enabled) {
    if (!narrativeStatus || !narrativeNow || !narrativeList) return;
    if (!enabled) {
      narrativeStatus.textContent = "";
      narrativeNow.textContent = "";
      narrativeList.innerHTML = "";
      return;
    }
    narrativeStatus.textContent = "loading…";
    narrativeStatus.className = "small";

    const timeline = await tryFetchNdjson("../narrative.timeline.ndjson");
    if (!timeline || timeline.length === 0) {
      narrativeStatus.textContent = "No narrative artifacts in this bundle.";
      narrativeStatus.className = "small bad";
      narrativeNow.textContent = "";
      narrativeList.innerHTML = "";
      return;
    }

    // Load/save minimal state from localStorage (client-side only).
    let save = null;
    try {
      save = JSON.parse(localStorage.getItem(NARR_SAVE_KEY) || "null");
    } catch {
      save = null;
    }
    if (!save || typeof save !== "object") {
      save = { last_node_id: null, visited: [] };
    }
    const visited = new Set(Array.isArray(save.visited) ? save.visited : []);
    const last = typeof save.last_node_id === "string" ? save.last_node_id : null;

    // Progression: linear next node in timeline order.
    let currentIdx = -1;
    if (last) {
      currentIdx = timeline.findIndex((n) => n && n.node_id === last);
    }
    const nextIdx = Math.max(0, currentIdx + 1);
    const nextNode = timeline[nextIdx] || null;

    narrativeNow.textContent = nextNode
      ? `Next: ${nextNode.node_id} (${String(nextNode.event || "node")})`
      : "Complete.";

    narrativeList.innerHTML = "";
    const maxShow = 120;
    timeline.slice(0, maxShow).forEach((n, i) => {
      const row = document.createElement("div");
      row.className = "row";
      row.style.cursor = "pointer";
      const id = String(n.node_id || `node:${i}`);
      const done = visited.has(id);
      row.style.background = done ? "rgba(86,211,100,0.10)" : i === nextIdx ? "rgba(79,195,247,0.10)" : "transparent";

      const left = document.createElement("div");
      left.textContent = `${done ? "✓" : i === nextIdx ? "▶" : "·"} ${String(n.event || "node")} ${id}`;
      const right = document.createElement("code");
      right.className = "small";
      right.textContent = (String(n.text || "")).slice(0, 80);
      row.appendChild(left);
      row.appendChild(right);

      row.addEventListener("click", () => {
        visited.add(id);
        save.last_node_id = id;
        save.visited = [...visited].sort((a, b) => String(a).localeCompare(String(b)));
        localStorage.setItem(NARR_SAVE_KEY, JSON.stringify(save));
        void setNarrativeEnabled(true); // rerender
      });
      narrativeList.appendChild(row);
    });

    narrativeStatus.textContent = `narrative loaded (${timeline.length} nodes)`;
    narrativeStatus.className = "small good";
  }

  if (narrativeToggle) {
    narrativeToggle.addEventListener("change", () => {
      void setNarrativeEnabled(Boolean(narrativeToggle.checked));
    });
    const auto = new URL(window.location.href).searchParams.get("mode") === "narrative";
    if (auto) {
      narrativeToggle.checked = true;
      void setNarrativeEnabled(true);
    }
  }

  try {
    const verified = await verifyBundle("../");
    const manifest = verified.manifest;
    baseBundleDigest = verified.manifestDigest;
    status.textContent = `verified ${manifest.files.length} files`;
    status.className = "good";

    const storyFile = manifest.files.find((f) => f.role === "story")?.path;
    const graphFile = manifest.files.find((f) => f.role === "world")?.path;
    const harmonicFile = manifest.files.find((f) => f.role === "harmonic")?.path;
    const narrativeStateFile = manifest.files.find((f) => f.role === "narrative_state")?.path;

    if (!storyFile || !graphFile || !harmonicFile) {
      throw new Error("required bundle roles missing (story/world/harmonic)");
    }

    const [story, graphObj, harmonic] = await Promise.all([
      fetchJson(`../${storyFile}`),
      fetchJson(`../${graphFile}`),
      fetchNdjson(`../${harmonicFile}`),
    ]);

    graph = graphObj;
    renderHarmonic(document.getElementById("harmonic"), harmonic);
    rerenderGraph();
    renderStory(document.getElementById("story"), story);

    const worldEntitiesFile = manifest.files.find((f) => f.role === "world_entities")?.path;
    const worldGraphFile = manifest.files.find((f) => f.role === "world_graph")?.path;
    const behaviorGrammarFile = manifest.files.find((f) => f.role === "behavior_grammar")?.path;
    const entityModelFiles = manifest.files.filter((f) => f.role === "entity_model").map((f) => f.path);
    if (worldEntitiesFile) {
      const [worldEntities, entityModels] = await Promise.all([
        fetchJson(`../${worldEntitiesFile}`),
        Promise.all(entityModelFiles.map((p) => fetchJson(`../${p}`))),
      ]);
      renderEntityScene(document.getElementById("entityScene"), worldEntities, entityModels);
    } else {
      renderEntityScene(document.getElementById("entityScene"), null, []);
    }
    if (worldGraphFile) {
      const worldGraph = await fetchJson(`../${worldGraphFile}`);
      renderWorldRelations(document.getElementById("worldRelations"), worldGraph);
    } else {
      renderWorldRelations(document.getElementById("worldRelations"), null);
    }
    if (behaviorGrammarFile) {
      const behaviorGrammar = await fetchJson(`../${behaviorGrammarFile}`);
      renderWorldBehavior(document.getElementById("worldBehavior"), behaviorGrammar);
    } else {
      renderWorldBehavior(document.getElementById("worldBehavior"), null);
    }

    if (narrativeStateFile) {
      const narrativeState = await fetchJson(`../${narrativeStateFile}`);
      renderNarrativeStates(document.getElementById("narrativeState"), narrativeState);
    }
    proposalStatus.textContent = "0 selected";
  } catch (err) {
    status.textContent = `FAILED: ${err.message || err}`;
    status.className = "bad";
    exportBtn.disabled = true;
  }
}

main();

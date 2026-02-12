import { verifyBundle } from "./verify.js";
import { renderGraph, renderHarmonic, renderStory } from "./render.js";

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

  try {
    const verified = await verifyBundle("../");
    const manifest = verified.manifest;
    baseBundleDigest = verified.manifestDigest;
    status.textContent = `verified ${manifest.files.length} files`;
    status.className = "good";

    const storyFile = manifest.files.find((f) => f.role === "story")?.path;
    const graphFile = manifest.files.find((f) => f.role === "world")?.path;
    const harmonicFile = manifest.files.find((f) => f.role === "harmonic")?.path;

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
    proposalStatus.textContent = "0 selected";
  } catch (err) {
    status.textContent = `FAILED: ${err.message || err}`;
    status.className = "bad";
    exportBtn.disabled = true;
  }
}

main();

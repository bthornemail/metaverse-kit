function el(tag, cls, text) {
  const node = document.createElement(tag);
  if (cls) node.className = cls;
  if (text !== undefined) node.textContent = text;
  return node;
}

export function renderHarmonic(container, harmonicLines) {
  container.innerHTML = "";
  const info = el("div", "small", `events: ${harmonicLines.length}`);
  container.appendChild(info);
  harmonicLines.slice(0, 200).forEach((line) => {
    const row = el("div", "row");
    row.appendChild(el("div", "", `t=${line.t} pc=${line.h?.pc} oct=${line.h?.oct} rc=${line.h?.rc} dyn=${line.h?.dyn}`));
    row.appendChild(el("code", "small", line.digest || ""));
    container.appendChild(row);
  });
}

export function renderGraph(container, graph, selectedNodeIds = new Set(), onNodeToggle = null) {
  container.innerHTML = "";
  const nodes = graph.nodes || [];
  const edges = graph.edges || [];
  container.appendChild(el("div", "small", `nodes: ${nodes.length} edges: ${edges.length}`));
  nodes.slice(0, 120).forEach((n) => {
    const row = el("div", "row");
    row.style.cursor = "pointer";
    if (selectedNodeIds.has(n.id || "")) {
      row.style.background = "rgba(79,195,247,0.12)";
    }
    row.appendChild(el("div", "", `${n.label || "(no-label)"} [${n.kind || "?"}]`));
    row.appendChild(el("code", "small", n.id || ""));
    if (onNodeToggle && n.id) {
      row.addEventListener("click", () => onNodeToggle(n.id));
    }
    container.appendChild(row);
  });
}

export function renderStory(container, story) {
  container.innerHTML = "";
  const chapters = story.chapters || [];
  container.appendChild(el("div", "small", `series: ${story.series || ""}`));
  container.appendChild(el("div", "small", `chapters: ${chapters.length}`));
  chapters.forEach((c) => {
    const row = el("div", "row");
    row.appendChild(el("div", "", `${c.title || c.slug || c.path || "chapter"} (${c.section || "?"})`));
    row.appendChild(el("code", "small", c.text_digest || c.source_digest || ""));
    container.appendChild(row);
  });
}

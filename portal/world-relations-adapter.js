function el(tag, cls, text) {
  const node = document.createElement(tag);
  if (cls) node.className = cls;
  if (text !== undefined) node.textContent = text;
  return node;
}

export function renderWorldRelations(container, worldGraph) {
  container.innerHTML = "";
  if (!worldGraph || !Array.isArray(worldGraph.relations)) {
    container.appendChild(el("div", "small", "no world_graph artifact"));
    return;
  }

  const groups = new Map();
  for (const rel of worldGraph.relations) {
    const key = `${rel.stance}:${rel.relation_type}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(rel);
  }

  container.appendChild(el("div", "small", `relations: ${worldGraph.relations.length}`));
  const keys = [...groups.keys()].sort((a, b) => a.localeCompare(b));
  for (const k of keys) {
    const header = el("div", "small", k);
    header.style.marginTop = "6px";
    container.appendChild(header);
    const rows = groups.get(k).slice().sort((a, b) => a.relation_id.localeCompare(b.relation_id));
    for (const rel of rows) {
      const row = el("div", "row");
      row.appendChild(el("div", "", `${rel.source_node.slice(0, 14)}... -> ${rel.relation_type} -> ${rel.target_node.slice(0, 14)}...`));
      row.appendChild(el("div", "small", `weight=${rel.weight} stance=${rel.stance}`));
      row.appendChild(el("code", "small", rel.relation_id));
      container.appendChild(row);
    }
  }
}

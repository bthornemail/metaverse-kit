function el(tag, cls, text) {
  const node = document.createElement(tag);
  if (cls) node.className = cls;
  if (text !== undefined) node.textContent = text;
  return node;
}

function assetBadge(kind) {
  if (kind === "gltf") return "3D";
  if (kind === "wav" || kind === "mp3") return "A";
  if (kind === "json") return "L";
  return "*";
}

export function renderEntityScene(container, worldEntities, entityModels) {
  container.innerHTML = "";
  if (!worldEntities || !Array.isArray(worldEntities.entities)) {
    container.appendChild(el("div", "small", "no world_entities artifact"));
    return;
  }

  const modelMap = new Map();
  for (const m of entityModels || []) {
    if (m && typeof m === "object" && typeof m.entity_id === "string") {
      modelMap.set(m.entity_id, m);
    }
  }

  const rows = [...worldEntities.entities].sort((a, b) => a.node_id.localeCompare(b.node_id));
  container.appendChild(el("div", "small", `entities: ${rows.length}`));

  rows.forEach((row) => {
    const model = modelMap.get(row.entity_digest);
    const line = el("div", "row");
    line.appendChild(el("div", "", `${model?.ontology_role || "unknown"} @ (${row.x}, ${row.y}, ${row.z}) [${row.scene_layer}]`));
    const badges = (model?.assets || []).map((a) => assetBadge(a.kind)).join(" ");
    line.appendChild(el("div", "small", badges.length > 0 ? `assets: ${badges}` : "assets: none"));
    line.appendChild(el("code", "small", row.node_id));
    container.appendChild(line);
  });
}

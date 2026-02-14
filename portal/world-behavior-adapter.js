function el(tag, cls, text) {
  const node = document.createElement(tag);
  if (cls) node.className = cls;
  if (text !== undefined) node.textContent = text;
  return node;
}

export function renderWorldBehavior(container, behaviorGrammar) {
  container.innerHTML = "";
  if (!behaviorGrammar || !Array.isArray(behaviorGrammar.rules)) {
    container.appendChild(el("div", "small", "no behavior_grammar artifact"));
    return;
  }

  container.appendChild(el("div", "small", `rules: ${behaviorGrammar.rules.length}`));
  const rules = [...behaviorGrammar.rules].sort((a, b) => a.rule_id.localeCompare(b.rule_id));
  for (const rule of rules) {
    const row = el("div", "row");
    row.appendChild(el("div", "", `${rule.verb} (${rule.condition}) -> ${rule.effect}`));
    row.appendChild(el("div", "small", `stance=${rule.stance}`));
    row.appendChild(el("div", "small", `${rule.source_node.slice(0, 14)}... -> ${rule.target_node.slice(0, 14)}...`));
    row.appendChild(el("code", "small", rule.rule_id));
    container.appendChild(row);
  }
}

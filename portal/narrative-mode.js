export function renderNarrativeStates(container, model) {
  container.innerHTML = "";
  const title = document.createElement("h3");
  title.textContent = `${model.title} (${model.v})`;
  container.appendChild(title);

  const meta = document.createElement("div");
  meta.className = "small";
  meta.textContent = `states=${model.summary?.state_count || "0"} authority=${model.authority}`;
  container.appendChild(meta);

  const list = document.createElement("ul");
  list.style.listStyle = "none";
  list.style.padding = "0";

  for (const state of model.states || []) {
    const li = document.createElement("li");
    li.style.margin = "8px 0";
    li.style.padding = "8px";
    li.style.border = "1px solid #2e3340";
    li.style.borderRadius = "6px";
    li.innerHTML = `
      <div><strong>${state.title}</strong></div>
      <div class="small">section=${state.section} stance=${state.stance} topology=${state.topology}</div>
      <div class="small">path=${state.source_path}</div>
    `;
    list.appendChild(li);
  }

  container.appendChild(list);
}

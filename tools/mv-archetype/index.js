#!/usr/bin/env node
import fs from "fs/promises";
import path from "path";
import crypto from "crypto";

const VERSION = "wave23.archetype_signature.v0";
const SHA_RE = /^sha256:[0-9a-f]{64}$/;
const ARCHETYPES = new Set(["isolated", "dyadic", "civic_mesh", "institutional", "observer_web"]);

function die(msg) { console.error(`ERROR: ${msg}`); process.exit(2); }
function stableStringify(v){ if(Array.isArray(v)) return `[${v.map(stableStringify).join(",")}]`; if(v&&typeof v==="object"){ const ks=Object.keys(v).sort(); return `{${ks.map((k)=>`${JSON.stringify(k)}:${stableStringify(v[k])}`).join(",")}}`; } return JSON.stringify(v); }
function canonicalJson(o){ return `${stableStringify(o)}\n`; }
function shaPref(bytes){ return `sha256:${crypto.createHash("sha256").update(bytes).digest("hex")}`; }
function keyset(o,e,c){ const g=Object.keys(o).sort().join(","); const w=[...e].sort().join(","); if(g!==w) die(`${c} keyset mismatch`); }
function requireSha(v,c){ if(typeof v!=="string"||!SHA_RE.test(v)) die(`${c} invalid sha256`); }
function requireMem(v,c){ if(Array.isArray(v)){v.forEach((x,i)=>requireMem(x,`${c}[${i}]`)); return;} if(v&&typeof v==="object"){for(const[k,x]of Object.entries(v)) requireMem(x,`${c}.${k}`); return;} if(typeof v!=="string") die(`${c} violates string membrane`); }
function parseArgs(argv){ const out={}; for(let i=0;i<argv.length;i++){ const a=argv[i]; if(a==="emit") out.mode="emit"; else if(a==="validate") out.mode="validate"; else if(a==="--world-graph"&&argv[i+1]) out.worldGraph=argv[++i]; else if(a==="--archetype"&&argv[i+1]) out.archetype=argv[++i]; else if(a==="--out"&&argv[i+1]) out.out=argv[++i]; else if(a==="--help"||a==="-h") out.help="1"; else die(`unknown arg: ${a}`);} return out; }
async function readJson(p){ return JSON.parse(await fs.readFile(path.resolve(process.cwd(),p),"utf8")); }

function validateGraph(g){
  keyset(g,["authority","base_world_entities_digest","digest","relations","summary","v"],"world_graph");
  if(g.v!=="wave19.world_graph.v0") die("world_graph version mismatch");
  if(g.authority!=="advisory") die("world_graph authority must be advisory");
  requireSha(g.base_world_entities_digest,"base_world_entities_digest");
  requireSha(g.digest,"world_graph.digest");
  if(!Array.isArray(g.relations)) die("world_graph.relations must be array");
  const sorted=[...g.relations].sort((a,b)=>a.relation_id.localeCompare(b.relation_id));
  if(stableStringify(sorted)!==stableStringify(g.relations)) die("world_graph.relations must be sorted by relation_id");
}

function undirectedComponents(edges,nodes){
  const adj = new Map();
  for(const n of nodes) adj.set(n,[]);
  for(const [a,b] of edges){ adj.get(a).push(b); adj.get(b).push(a); }
  const seen=new Set(); let comps=0;
  for(const n of nodes){
    if(seen.has(n)) continue;
    comps += 1;
    const stack=[n];
    while(stack.length){ const cur=stack.pop(); if(seen.has(cur)) continue; seen.add(cur); for(const nx of adj.get(cur)||[]){ if(!seen.has(nx)) stack.push(nx); } }
  }
  return comps;
}

function featuresFromGraph(g){
  const nodes = new Set();
  const typeCounts = new Map();
  for(const rel of g.relations){
    nodes.add(rel.source_node);
    nodes.add(rel.target_node);
    typeCounts.set(rel.relation_type, (typeCounts.get(rel.relation_type)||0)+1);
  }
  const relationTypes = [...typeCounts.entries()].sort((a,b)=>a[0].localeCompare(b[0])).map(([k,v])=>`${k}:${v}`);
  const components = undirectedComponents(g.relations.map((r)=>[r.source_node,r.target_node]), nodes);
  return {
    node_count: String(nodes.size),
    relation_count: String(g.relations.length),
    component_count: String(components),
    relation_type_hist: relationTypes,
  };
}

function classify(f){
  const n = Number(f.node_count);
  const r = Number(f.relation_count);
  const types = f.relation_type_hist;
  if(r===0) return "isolated";
  if(n<=2) return "dyadic";
  if(types.every((x)=>x.startsWith("observes:"))) return "observer_web";
  if(types.some((x)=>x.startsWith("delegates:")) || types.some((x)=>x.startsWith("contains:"))) return "institutional";
  return "civic_mesh";
}

function buildArchetype(g){
  const f = featuresFromGraph(g);
  const archetypeId = classify(f);
  if(!ARCHETYPES.has(archetypeId)) die("archetype classification out of finite set");
  const structuralFeatures = [
    `node_count=${f.node_count}`,
    `relation_count=${f.relation_count}`,
    `component_count=${f.component_count}`,
    ...f.relation_type_hist.map((x)=>`relation_type:${x}`),
  ];
  const invariantSignatureHash = shaPref(Buffer.from(canonicalJson({features:structuralFeatures}),"utf8"));
  const body = {
    archetype_id: archetypeId,
    authority: "advisory",
    invariant_signature_hash: invariantSignatureHash,
    structural_features: structuralFeatures,
    world_graph_digest: g.digest,
    v: VERSION,
  };
  return { ...body, digest: shaPref(Buffer.from(canonicalJson(body),"utf8")) };
}

function validateArchetype(a,g){
  keyset(a,["archetype_id","authority","digest","invariant_signature_hash","structural_features","v","world_graph_digest"],"archetype_signature");
  if(a.v!==VERSION) die("archetype_signature version mismatch");
  if(a.authority!=="advisory") die("archetype_signature authority must be advisory");
  if(!ARCHETYPES.has(a.archetype_id)) die("archetype_id invalid");
  requireSha(a.world_graph_digest,"world_graph_digest");
  requireSha(a.invariant_signature_hash,"invariant_signature_hash");
  requireSha(a.digest,"digest");
  if(!Array.isArray(a.structural_features)) die("structural_features must be array");
  if(!a.structural_features.every((x)=>typeof x === "string")) die("structural_features must be string[]");
  if(a.world_graph_digest!==g.digest) die("world_graph_digest mismatch");

  const rebuilt = buildArchetype(g);
  if(stableStringify(rebuilt.structural_features)!==stableStringify(a.structural_features)) die("structural_features mismatch");
  if(rebuilt.invariant_signature_hash!==a.invariant_signature_hash) die("invariant_signature_hash mismatch");
  if(rebuilt.archetype_id!==a.archetype_id) die("archetype_id mismatch");
  requireMem(a,"archetype_signature");

  const body={
    archetype_id:a.archetype_id,
    authority:a.authority,
    invariant_signature_hash:a.invariant_signature_hash,
    structural_features:a.structural_features,
    world_graph_digest:a.world_graph_digest,
    v:a.v,
  };
  const want=shaPref(Buffer.from(canonicalJson(body),"utf8"));
  if(want!==a.digest) die("archetype_signature digest mismatch");
}

async function main(){
  const args = parseArgs(process.argv.slice(2));
  if(args.help==="1"||!args.mode){
    console.log("mv-archetype emit --world-graph <world_graph.v0.json> --out <archetype_signature.v0.json>");
    console.log("mv-archetype validate --world-graph <world_graph.v0.json> --archetype <archetype_signature.v0.json>");
    return;
  }
  if(!args.worldGraph) die("--world-graph is required");
  const graph=await readJson(args.worldGraph);
  validateGraph(graph);

  if(args.mode==="emit"){
    if(!args.out) die("emit requires --out");
    const out = buildArchetype(graph);
    validateArchetype(out, graph);
    await fs.writeFile(path.resolve(process.cwd(), args.out), canonicalJson(out), "utf8");
    console.log(`ok mv-archetype emit digest=${out.digest}`);
    return;
  }
  if(args.mode==="validate"){
    if(!args.archetype) die("validate requires --archetype");
    const a=await readJson(args.archetype);
    validateArchetype(a, graph);
    console.log(`ok mv-archetype validate digest=${a.digest}`);
    return;
  }
  die("mode must be emit|validate");
}

main().catch((e)=>die(e.message || String(e)));

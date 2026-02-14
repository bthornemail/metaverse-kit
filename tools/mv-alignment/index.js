#!/usr/bin/env node
import fs from "fs/promises";
import path from "path";
import crypto from "crypto";

const VERSION = "wave21.alignment_report.v0";
const SHA_RE = /^sha256:[0-9a-f]{64}$/;
const ROLES = new Set(["solon", "solomon", "asabiyyah", "metatron", "witness"]);
const ORDER = ["behavior_grammar", "narrative_state", "world_entities", "world_graph"];

function die(msg){ console.error(`ERROR: ${msg}`); process.exit(2); }
function stableStringify(v){ if(Array.isArray(v)) return `[${v.map(stableStringify).join(",")}]`; if(v&&typeof v==="object"){const ks=Object.keys(v).sort(); return `{${ks.map(k=>`${JSON.stringify(k)}:${stableStringify(v[k])}`).join(",")}}`; } return JSON.stringify(v); }
function canonicalJson(o){ return `${stableStringify(o)}\n`; }
function shaPref(bytes){ return `sha256:${crypto.createHash("sha256").update(bytes).digest("hex")}`; }
function keyset(o,e,c){ const g=Object.keys(o).sort().join(","); const w=[...e].sort().join(","); if(g!==w) die(`${c} keyset mismatch`); }
function requireSha(v,c){ if(typeof v!=="string"||!SHA_RE.test(v)) die(`${c} invalid sha256`); }
function requireMem(v,c){ if(Array.isArray(v)){v.forEach((x,i)=>requireMem(x,`${c}[${i}]`)); return;} if(v&&typeof v==="object"){for(const[k,x] of Object.entries(v)) requireMem(x,`${c}.${k}`); return;} if(typeof v!=="string") die(`${c} violates string membrane`); }
function parseArgs(argv){ const out={}; for(let i=0;i<argv.length;i++){const a=argv[i]; if(a==="emit") out.mode="emit"; else if(a==="validate") out.mode="validate"; else if(a==="--narrative-state"&&argv[i+1]) out.n=argv[++i]; else if(a==="--world-entities"&&argv[i+1]) out.e=argv[++i]; else if(a==="--world-graph"&&argv[i+1]) out.g=argv[++i]; else if(a==="--behavior-grammar"&&argv[i+1]) out.b=argv[++i]; else if(a==="--alignment"&&argv[i+1]) out.a=argv[++i]; else if(a==="--out"&&argv[i+1]) out.o=argv[++i]; else if(a==="--help"||a==="-h") out.h="1"; else die(`unknown arg: ${a}`);} return out; }
async function readJson(p){ return JSON.parse(await fs.readFile(path.resolve(process.cwd(), p),"utf8")); }
async function readBytes(p){ return fs.readFile(path.resolve(process.cwd(), p)); }

function behaviorTargetsResolve(behavior, entityNodes, graphNodes){
  for(const r of behavior.rules||[]){ if(!entityNodes.has(r.source_node)||!entityNodes.has(r.target_node)||!graphNodes.has(r.source_node)||!graphNodes.has(r.target_node)) return false; }
  return true;
}
function behaviorEffectsSupported(behavior){
  for(const r of behavior.rules||[]){
    if(r.verb==="RELATE"&&r.effect!=="propose_relation") return false;
    if(r.verb==="UNRELATE"&&r.effect!=="propose_unrelation") return false;
  }
  return true;
}
function narrativeRolesResolve(narrative){
  for(const s of narrative.states||[]){ for(const role of s.dialogue_roles||[]){ if(!ROLES.has(role)) return false; } }
  return true;
}
function isAcyclic(behavior){
  const adj=new Map(); const nodes=new Set();
  for(const r of behavior.rules||[]){ nodes.add(r.source_node); nodes.add(r.target_node); if(!adj.has(r.source_node)) adj.set(r.source_node,[]); adj.get(r.source_node).push(r.target_node); }
  const seen=new Set(), stack=new Set();
  function dfs(n){ if(stack.has(n)) return false; if(seen.has(n)) return true; seen.add(n); stack.add(n); for(const m of (adj.get(n)||[])){ if(!dfs(m)) return false; } stack.delete(n); return true; }
  for(const n of nodes){ if(!dfs(n)) return false; }
  return true;
}
function projectionCommutes(digests){
  const sorted=[...digests].sort((a,b)=>a.localeCompare(b));
  const d1=shaPref(Buffer.from(canonicalJson({digests:sorted}),"utf8"));
  const d2=shaPref(Buffer.from(canonicalJson({digests:[...sorted].reverse().sort((a,b)=>a.localeCompare(b))}),"utf8"));
  return d1===d2;
}

function makeReport(nd,ed,gd,bd,checks){
  const report={
    authority:"advisory",
    behavior_grammar_digest:bd,
    checks,
    narrative_state_digest:nd,
    projection_order:ORDER,
    status:"valid",
    v:VERSION,
    world_entities_digest:ed,
    world_graph_digest:gd,
  };
  return {...report,digest:shaPref(Buffer.from(canonicalJson(report),"utf8"))};
}

function validateReport(r){
  keyset(r,["authority","behavior_grammar_digest","checks","digest","narrative_state_digest","projection_order","status","v","world_entities_digest","world_graph_digest"],"alignment");
  if(r.v!==VERSION) die("alignment version mismatch");
  if(r.authority!=="advisory") die("alignment authority must be advisory");
  if(r.status!=="valid") die("alignment status must be valid");
  requireSha(r.narrative_state_digest,"narrative_state_digest"); requireSha(r.world_entities_digest,"world_entities_digest"); requireSha(r.world_graph_digest,"world_graph_digest"); requireSha(r.behavior_grammar_digest,"behavior_grammar_digest"); requireSha(r.digest,"digest");
  keyset(r.checks,["acyclic_behavior_graph","behavior_effects_supported","behavior_targets_resolve","narrative_roles_resolve","projection_order_commutes"],"checks");
  for(const v of Object.values(r.checks)) if(!["0","1"].includes(v)) die("checks must be 0|1");
  if(Object.values(r.checks).some(v=>v!=="1")) die("alignment contains failed checks");
  if(stableStringify(r.projection_order)!==stableStringify(ORDER)) die("projection_order mismatch");
  requireMem(r,"alignment");
  const body={authority:r.authority,behavior_grammar_digest:r.behavior_grammar_digest,checks:r.checks,narrative_state_digest:r.narrative_state_digest,projection_order:r.projection_order,status:r.status,v:r.v,world_entities_digest:r.world_entities_digest,world_graph_digest:r.world_graph_digest};
  const want=shaPref(Buffer.from(canonicalJson(body),"utf8"));
  if(want!==r.digest) die("alignment digest mismatch");
}

async function main(){
  const a=parseArgs(process.argv.slice(2));
  if(a.h==="1"||!a.mode){
    console.log("mv-alignment emit --narrative-state <...> --world-entities <...> --world-graph <...> --behavior-grammar <...> --out <alignment.json>");
    console.log("mv-alignment validate --alignment <alignment.json>");
    return;
  }
  if(a.mode==="emit"){
    if(!a.n||!a.e||!a.g||!a.b||!a.o) die("emit requires --narrative-state --world-entities --world-graph --behavior-grammar --out");
    const [nB,eB,gB,bB,n,e,g,b]=await Promise.all([readBytes(a.n),readBytes(a.e),readBytes(a.g),readBytes(a.b),readJson(a.n),readJson(a.e),readJson(a.g),readJson(a.b)]);
    if(n.v!=="wave16.narrative_state.v0") die("narrative_state version mismatch");
    if(e.v!=="wave19.world_entities.v0") die("world_entities version mismatch");
    if(g.v!=="wave19.world_graph.v0") die("world_graph version mismatch");
    if(b.v!=="wave20.behavior_grammar.v0") die("behavior_grammar version mismatch");
    const entityNodes=new Set((e.entities||[]).map(x=>x.node_id));
    const graphNodes=new Set(); for(const r of (g.relations||[])){ graphNodes.add(r.source_node); graphNodes.add(r.target_node); }
    const checks={
      behavior_targets_resolve: behaviorTargetsResolve(b,entityNodes,graphNodes)?"1":"0",
      behavior_effects_supported: behaviorEffectsSupported(b)?"1":"0",
      narrative_roles_resolve: narrativeRolesResolve(n)?"1":"0",
      acyclic_behavior_graph: isAcyclic(b)?"1":"0",
      projection_order_commutes: projectionCommutes([shaPref(nB),shaPref(eB),shaPref(gB),shaPref(bB)])?"1":"0",
    };
    if(Object.values(checks).some(v=>v!=="1")) die(`alignment failed checks: ${JSON.stringify(checks)}`);
    const report=makeReport(shaPref(nB),shaPref(eB),shaPref(gB),shaPref(bB),checks);
    validateReport(report);
    await fs.writeFile(path.resolve(process.cwd(),a.o),canonicalJson(report),"utf8");
    console.log(`ok mv-alignment emit digest=${report.digest}`);
    return;
  }
  if(a.mode==="validate"){
    if(!a.a) die("validate requires --alignment");
    const r=await readJson(a.a);
    validateReport(r);
    console.log(`ok mv-alignment validate digest=${r.digest}`);
    return;
  }
  die("mode must be emit|validate");
}

main().catch((e)=>die(e.message||String(e)));

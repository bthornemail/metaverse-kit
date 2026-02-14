#!/usr/bin/env node
import fs from "fs/promises";
import path from "path";
import crypto from "crypto";

const VERSION = "wave24.federation_merge_result.v0";
const SHA_RE = /^sha256:[0-9a-f]{64}$/;
const STRATEGIES = new Set(["lexicographic", "left_preferred", "right_preferred"]);
const RES = new Set(["left", "right", "lexicographic"]);

function die(msg){ console.error(`ERROR: ${msg}`); process.exit(2); }
function stableStringify(v){ if(Array.isArray(v)) return `[${v.map(stableStringify).join(",")}]`; if(v&&typeof v==="object"){const ks=Object.keys(v).sort(); return `{${ks.map(k=>`${JSON.stringify(k)}:${stableStringify(v[k])}`).join(",")}}`; } return JSON.stringify(v); }
function canonicalJson(o){ return `${stableStringify(o)}\n`; }
function shaPref(bytes){ return `sha256:${crypto.createHash("sha256").update(bytes).digest("hex")}`; }
function keyset(o,e,c){ const g=Object.keys(o).sort().join(","); const w=[...e].sort().join(","); if(g!==w) die(`${c} keyset mismatch`); }
function requireSha(v,c){ if(typeof v!=="string"||!SHA_RE.test(v)) die(`${c} invalid sha256`); }
function requireMem(v,c){ if(Array.isArray(v)){v.forEach((x,i)=>requireMem(x,`${c}[${i}]`)); return;} if(v&&typeof v==="object"){for(const[k,x] of Object.entries(v)) requireMem(x,`${c}.${k}`); return;} if(typeof v!=="string") die(`${c} violates string membrane`); }
function parseArgs(argv){ const out={strategy:"lexicographic"}; for(let i=0;i<argv.length;i++){const a=argv[i]; if(a==="emit") out.mode="emit"; else if(a==="validate") out.mode="validate"; else if(a==="--left"&&argv[i+1]) out.left=argv[++i]; else if(a==="--right"&&argv[i+1]) out.right=argv[++i]; else if(a==="--merge"&&argv[i+1]) out.merge=argv[++i]; else if(a==="--strategy"&&argv[i+1]) out.strategy=argv[++i]; else if(a==="--out"&&argv[i+1]) out.out=argv[++i]; else if(a==="--help"||a==="-h") out.help="1"; else die(`unknown arg: ${a}`);} return out; }
async function readJson(p){ return JSON.parse(await fs.readFile(path.resolve(process.cwd(),p),"utf8")); }

function validateRel(r,c){ keyset(r,["relation_id","relation_type","source_node","stance","target_node","weight"],c); requireSha(r.relation_id,`${c}.relation_id`); requireSha(r.source_node,`${c}.source_node`); requireSha(r.target_node,`${c}.target_node`); }
function validateGraph(g,c){ keyset(g,["authority","base_world_entities_digest","digest","relations","summary","v"],c); if(g.v!=="wave19.world_graph.v0") die(`${c} version mismatch`); if(g.authority!=="advisory") die(`${c} authority mismatch`); requireSha(g.base_world_entities_digest,`${c}.base_world_entities_digest`); requireSha(g.digest,`${c}.digest`); if(!Array.isArray(g.relations)) die(`${c}.relations must be array`); g.relations.forEach((r,i)=>validateRel(r,`${c}.relations[${i}]`)); const sorted=[...g.relations].sort((a,b)=>a.relation_id.localeCompare(b.relation_id)); if(stableStringify(sorted)!==stableStringify(g.relations)) die(`${c}.relations must be sorted`); }

function choose(l,r,strategy){
  if(strategy==="left_preferred") return {chosen:l,resolution:"left"};
  if(strategy==="right_preferred") return {chosen:r,resolution:"right"};
  const lc=canonicalJson(l), rc=canonicalJson(r);
  return lc<=rc?{chosen:l,resolution:"lexicographic"}:{chosen:r,resolution:"lexicographic"};
}

function mergeRels(left,right,strategy){
  const L=new Map(left.map(r=>[r.relation_id,r]));
  const R=new Map(right.map(r=>[r.relation_id,r]));
  const ids=[...new Set([...L.keys(),...R.keys()])].sort((a,b)=>a.localeCompare(b));
  const merged=[]; const conflicts=[];
  for(const id of ids){
    const l=L.get(id), r=R.get(id);
    if(l&&!r){ merged.push(l); continue; }
    if(!l&&r){ merged.push(r); continue; }
    if(stableStringify(l)===stableStringify(r)){ merged.push(l); continue; }
    const {chosen,resolution}=choose(l,r,strategy);
    merged.push(chosen);
    conflicts.push({
      relation_id:id,
      left_relation_digest:shaPref(Buffer.from(canonicalJson(l),"utf8")),
      right_relation_digest:shaPref(Buffer.from(canonicalJson(r),"utf8")),
      resolution,
    });
  }
  return {merged,conflicts};
}

function make(left,right,strategy){
  const {merged,conflicts}=mergeRels(left.relations,right.relations,strategy);
  const mergedDigest=shaPref(Buffer.from(canonicalJson({relations:merged}),"utf8"));
  const body={
    authority:"advisory",
    conflict_summary:conflicts,
    left_digest:left.digest,
    merged_digest:mergedDigest,
    merged_relations:merged,
    rejected_components:[],
    right_digest:right.digest,
    strategy,
    v:VERSION,
  };
  return {...body,digest:shaPref(Buffer.from(canonicalJson(body),"utf8"))};
}

function validateMerge(m,left,right){
  keyset(m,["authority","conflict_summary","digest","left_digest","merged_digest","merged_relations","rejected_components","right_digest","strategy","v"],"federation_merge");
  if(m.v!==VERSION) die("federation merge version mismatch");
  if(m.authority!=="advisory") die("federation merge authority must be advisory");
  if(!STRATEGIES.has(m.strategy)) die("strategy invalid");
  requireSha(m.left_digest,"left_digest"); requireSha(m.right_digest,"right_digest"); requireSha(m.merged_digest,"merged_digest"); requireSha(m.digest,"digest");
  if(!Array.isArray(m.merged_relations)||!Array.isArray(m.conflict_summary)||!Array.isArray(m.rejected_components)) die("merge arrays invalid");
  m.merged_relations.forEach((r,i)=>validateRel(r,`merged_relations[${i}]`));
  const sorted=[...m.merged_relations].sort((a,b)=>a.relation_id.localeCompare(b.relation_id)); if(stableStringify(sorted)!==stableStringify(m.merged_relations)) die("merged_relations must be sorted");
  for(const [i,c] of m.conflict_summary.entries()){ keyset(c,["left_relation_digest","relation_id","resolution","right_relation_digest"],`conflict_summary[${i}]`); requireSha(c.relation_id,`conflict_summary[${i}].relation_id`); requireSha(c.left_relation_digest,`conflict_summary[${i}].left_relation_digest`); requireSha(c.right_relation_digest,`conflict_summary[${i}].right_relation_digest`); if(!RES.has(c.resolution)) die(`conflict_summary[${i}].resolution invalid`); }
  if(stableStringify(m.rejected_components)!=="[]") die("rejected_components must be empty in v0");

  const recomputed=make(left,right,m.strategy);
  if(recomputed.left_digest!==m.left_digest||recomputed.right_digest!==m.right_digest) die("input digest mismatch");
  if(stableStringify(recomputed.merged_relations)!==stableStringify(m.merged_relations)) die("merged_relations mismatch");
  if(stableStringify(recomputed.conflict_summary)!==stableStringify(m.conflict_summary)) die("conflict_summary mismatch");
  if(recomputed.merged_digest!==m.merged_digest) die("merged_digest mismatch");
  requireMem(m,"federation_merge");
  const body={authority:m.authority,conflict_summary:m.conflict_summary,left_digest:m.left_digest,merged_digest:m.merged_digest,merged_relations:m.merged_relations,rejected_components:m.rejected_components,right_digest:m.right_digest,strategy:m.strategy,v:m.v};
  const want=shaPref(Buffer.from(canonicalJson(body),"utf8"));
  if(want!==m.digest) die("federation merge digest mismatch");
}

async function main(){
  const a=parseArgs(process.argv.slice(2));
  if(a.help==="1"||!a.mode){
    console.log("mv-federate emit --left <world_graph_a.json> --right <world_graph_b.json> [--strategy lexicographic] --out <federation_merge.v0.json>");
    console.log("mv-federate validate --left <world_graph_a.json> --right <world_graph_b.json> --merge <federation_merge.v0.json>");
    return;
  }
  if(!a.left||!a.right) die("--left and --right are required");
  if(!STRATEGIES.has(a.strategy)) die("strategy invalid");
  const left=await readJson(a.left), right=await readJson(a.right);
  validateGraph(left,"left_world_graph"); validateGraph(right,"right_world_graph");
  if(left.base_world_entities_digest!==right.base_world_entities_digest) die("compatibility reject: base_world_entities_digest mismatch");

  if(a.mode==="emit"){
    if(!a.out) die("emit requires --out");
    const m=make(left,right,a.strategy);
    validateMerge(m,left,right);
    await fs.writeFile(path.resolve(process.cwd(),a.out),canonicalJson(m),"utf8");
    console.log(`ok mv-federate emit digest=${m.digest}`);
    return;
  }
  if(a.mode==="validate"){
    if(!a.merge) die("validate requires --merge");
    const m=await readJson(a.merge);
    validateMerge(m,left,right);
    console.log(`ok mv-federate validate digest=${m.digest}`);
    return;
  }
  die("mode must be emit|validate");
}

main().catch((e)=>die(e.message||String(e)));

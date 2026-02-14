#!/usr/bin/env node
import fs from "fs/promises";
import path from "path";
import crypto from "crypto";

const VERSION = "wave26.consumer_trace.v0";
const SHA_RE = /^sha256:[0-9a-f]{64}$/;

function die(msg){ console.error(`ERROR: ${msg}`); process.exit(2); }
function stableStringify(v){ if(Array.isArray(v)) return `[${v.map(stableStringify).join(",")}]`; if(v&&typeof v==="object"){ const ks=Object.keys(v).sort(); return `{${ks.map((k)=>`${JSON.stringify(k)}:${stableStringify(v[k])}`).join(",")}}`; } return JSON.stringify(v); }
function canonicalJson(o){ return `${stableStringify(o)}\n`; }
function shaPref(bytes){ return `sha256:${crypto.createHash("sha256").update(bytes).digest("hex")}`; }
function keyset(o,e,c){ const g=Object.keys(o).sort().join(","); const w=[...e].sort().join(","); if(g!==w) die(`${c} keyset mismatch`); }
function requireSha(v,c){ if(typeof v!=="string"||!SHA_RE.test(v)) die(`${c} invalid sha256`); }
function requireMem(v,c){ if(Array.isArray(v)){v.forEach((x,i)=>requireMem(x,`${c}[${i}]`));return;} if(v&&typeof v==="object"){for(const[k,x]of Object.entries(v)) requireMem(x,`${c}.${k}`);return;} if(typeof v!=="string") die(`${c} violates string membrane`); }
function parseIntStr(s,c){ if(typeof s!=="string"||!/^-?[0-9]+$/.test(s)) die(`${c} must be integer string`); return Number(s); }
function parseUIntStr(s,c){ if(typeof s!=="string"||!/^[0-9]+$/.test(s)) die(`${c} must be unsigned decimal string`); return Number(s); }
function parseArgs(argv){ const out={}; for(let i=0;i<argv.length;i++){ const a=argv[i]; if(a==="emit") out.mode="emit"; else if(a==="validate") out.mode="validate"; else if(a==="--seed"&&argv[i+1]) out.seed=argv[++i]; else if(a==="--world-graph"&&argv[i+1]) out.worldGraph=argv[++i]; else if(a==="--provider-extension"&&argv[i+1]) out.provider=argv[++i]; else if(a==="--consumer-trace"&&argv[i+1]) out.trace=argv[++i]; else if(a==="--out"&&argv[i+1]) out.out=argv[++i]; else if(a==="--help"||a==="-h") out.help="1"; else die(`unknown arg: ${a}`);} return out; }
async function readJson(p){ return JSON.parse(await fs.readFile(path.resolve(process.cwd(), p),"utf8")); }

function validateWorldGraph(g){ keyset(g,["authority","base_world_entities_digest","digest","relations","summary","v"],"world_graph"); if(g.v!=="wave19.world_graph.v0") die("world_graph version mismatch"); requireSha(g.digest,"world_graph.digest"); }
function validateProvider(p, worldDigest){ keyset(p,["authority","behavior_extension_count","canonical_world_digest","digest","extension_artifact_count","extension_digest","extension_scope","magnitude_m","projection_delta_size","provider_id","v"],"provider_extension"); if(p.v!=="wave25.provider_extension.v0") die("provider_extension version mismatch"); requireSha(p.canonical_world_digest,"provider_extension.canonical_world_digest"); if(p.canonical_world_digest!==worldDigest) die("provider canonical_world_digest mismatch"); parseUIntStr(p.magnitude_m,"provider_extension.magnitude_m"); }
function validateSeed(seed){ keyset(seed,["behavior_invocations","interaction_count","invariant_axis_count","max_projection_depth"],"seed"); parseUIntStr(seed.interaction_count,"seed.interaction_count"); parseUIntStr(seed.max_projection_depth,"seed.max_projection_depth"); parseUIntStr(seed.behavior_invocations,"seed.behavior_invocations"); parseUIntStr(seed.invariant_axis_count,"seed.invariant_axis_count"); }

function buildTrace(seed, worldDigest, providerMagnitude){
  validateSeed(seed);
  const lambda = parseUIntStr(seed.invariant_axis_count,"seed.invariant_axis_count");
  const m = parseUIntStr(providerMagnitude,"provider_magnitude_m");
  const n = parseUIntStr(seed.interaction_count,"seed.interaction_count");
  const q = (lambda * lambda) - (2 * m * n);
  const body = {
    authority: "advisory",
    behavior_invocations: seed.behavior_invocations,
    interaction_count: seed.interaction_count,
    invariant_axis_count: seed.invariant_axis_count,
    max_projection_depth: seed.max_projection_depth,
    provider_magnitude_m: providerMagnitude,
    q_value: String(q),
    v: VERSION,
    world_digest: worldDigest,
  };
  return { ...body, digest: shaPref(Buffer.from(canonicalJson(body),"utf8")) };
}

function validateTrace(t, worldDigest, providerMagnitude){
  keyset(t,["authority","behavior_invocations","digest","interaction_count","invariant_axis_count","max_projection_depth","provider_magnitude_m","q_value","v","world_digest"],"consumer_trace");
  if(t.v!==VERSION) die("consumer_trace version mismatch");
  if(t.authority!=="advisory") die("consumer_trace authority must be advisory");
  requireSha(t.world_digest,"world_digest");
  requireSha(t.digest,"digest");
  parseUIntStr(t.interaction_count,"interaction_count");
  parseUIntStr(t.max_projection_depth,"max_projection_depth");
  parseUIntStr(t.behavior_invocations,"behavior_invocations");
  parseUIntStr(t.invariant_axis_count,"invariant_axis_count");
  parseUIntStr(t.provider_magnitude_m,"provider_magnitude_m");
  parseIntStr(t.q_value,"q_value");
  if(t.world_digest!==worldDigest) die("world_digest mismatch");
  if(t.provider_magnitude_m!==providerMagnitude) die("provider_magnitude_m mismatch");

  const rebuilt = buildTrace({
    behavior_invocations:t.behavior_invocations,
    interaction_count:t.interaction_count,
    invariant_axis_count:t.invariant_axis_count,
    max_projection_depth:t.max_projection_depth,
  }, worldDigest, providerMagnitude);
  if(rebuilt.q_value!==t.q_value) die("q_value mismatch");
  requireMem(t,"consumer_trace");
  const body = {
    authority:t.authority,
    behavior_invocations:t.behavior_invocations,
    interaction_count:t.interaction_count,
    invariant_axis_count:t.invariant_axis_count,
    max_projection_depth:t.max_projection_depth,
    provider_magnitude_m:t.provider_magnitude_m,
    q_value:t.q_value,
    v:t.v,
    world_digest:t.world_digest,
  };
  const want = shaPref(Buffer.from(canonicalJson(body),"utf8"));
  if(want!==t.digest) die("consumer_trace digest mismatch");
}

async function main(){
  const args=parseArgs(process.argv.slice(2));
  if(args.help==="1"||!args.mode){
    console.log("mv-consumer-metric emit --seed <consumer.seed.json> --world-graph <world_graph.v0.json> --provider-extension <wave25.provider_extension.v0.json> --out <wave26.consumer_trace.v0.json>");
    console.log("mv-consumer-metric validate --consumer-trace <wave26.consumer_trace.v0.json> --world-graph <world_graph.v0.json> --provider-extension <wave25.provider_extension.v0.json>");
    return;
  }
  if(!args.worldGraph || !args.provider) die("--world-graph and --provider-extension are required");
  const world=await readJson(args.worldGraph);
  const provider=await readJson(args.provider);
  validateWorldGraph(world);
  validateProvider(provider, world.digest);

  if(args.mode==="emit"){
    if(!args.seed || !args.out) die("emit requires --seed --out");
    const seed=await readJson(args.seed);
    const out=buildTrace(seed, world.digest, provider.magnitude_m);
    if(Number(out.q_value) < 0) console.error(`warn wave26 q_value<0 q=${out.q_value}`);
    validateTrace(out, world.digest, provider.magnitude_m);
    await fs.writeFile(path.resolve(process.cwd(), args.out), canonicalJson(out), "utf8");
    console.log(`ok mv-consumer-metric emit digest=${out.digest}`);
    return;
  }
  if(args.mode==="validate"){
    if(!args.trace) die("validate requires --consumer-trace");
    const t=await readJson(args.trace);
    validateTrace(t, world.digest, provider.magnitude_m);
    if(Number(t.q_value) < 0) console.error(`warn wave26 q_value<0 q=${t.q_value}`);
    console.log(`ok mv-consumer-metric validate digest=${t.digest}`);
    return;
  }
  die("mode must be emit|validate");
}

main().catch((e)=>die(e.message || String(e)));

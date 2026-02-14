#!/usr/bin/env node
import fs from "fs/promises";
import path from "path";
import crypto from "crypto";

const VERSION = "wave25.provider_extension.v0";
const SHA_RE = /^sha256:[0-9a-f]{64}$/;
const SCOPES = new Set(["renderer", "adapter", "projection", "tooling", "hybrid"]);

function die(msg){ console.error(`ERROR: ${msg}`); process.exit(2); }
function stableStringify(v){ if(Array.isArray(v)) return `[${v.map(stableStringify).join(",")}]`; if(v&&typeof v==="object"){ const ks=Object.keys(v).sort(); return `{${ks.map((k)=>`${JSON.stringify(k)}:${stableStringify(v[k])}`).join(",")}}`; } return JSON.stringify(v); }
function canonicalJson(o){ return `${stableStringify(o)}\n`; }
function shaPref(bytes){ return `sha256:${crypto.createHash("sha256").update(bytes).digest("hex")}`; }
function keyset(o,e,c){ const g=Object.keys(o).sort().join(","); const w=[...e].sort().join(","); if(g!==w) die(`${c} keyset mismatch`); }
function requireSha(v,c){ if(typeof v!=="string"||!SHA_RE.test(v)) die(`${c} invalid sha256`); }
function requireMem(v,c){ if(Array.isArray(v)){v.forEach((x,i)=>requireMem(x,`${c}[${i}]`));return;} if(v&&typeof v==="object"){for(const[k,x] of Object.entries(v)) requireMem(x,`${c}.${k}`);return;} if(typeof v!=="string") die(`${c} violates string membrane`); }
function parseDec(s,c){ if(typeof s!=="string"||!/^[0-9]+$/.test(s)) die(`${c} must be unsigned decimal string`); return Number(s); }
function parseArgs(argv){ const out={}; for(let i=0;i<argv.length;i++){ const a=argv[i]; if(a==="emit") out.mode="emit"; else if(a==="validate") out.mode="validate"; else if(a==="--seed"&&argv[i+1]) out.seed=argv[++i]; else if(a==="--world-graph"&&argv[i+1]) out.worldGraph=argv[++i]; else if(a==="--provider-extension"&&argv[i+1]) out.provider=argv[++i]; else if(a==="--out"&&argv[i+1]) out.out=argv[++i]; else if(a==="--help"||a==="-h") out.help="1"; else die(`unknown arg: ${a}`);} return out; }
async function readJson(p){ return JSON.parse(await fs.readFile(path.resolve(process.cwd(), p),"utf8")); }

function validateWorldGraph(g){ keyset(g,["authority","base_world_entities_digest","digest","relations","summary","v"],"world_graph"); if(g.v!=="wave19.world_graph.v0") die("world_graph version mismatch"); requireSha(g.digest,"world_graph.digest"); }

function validateSeed(seed){
  keyset(seed,["behavior_extension_count","extension_artifact_count","extension_scope","projection_delta_size","provider_id"],"seed");
  if(typeof seed.provider_id!=="string"||seed.provider_id.length===0) die("seed.provider_id required");
  if(!SCOPES.has(seed.extension_scope)) die("seed.extension_scope invalid");
  parseDec(seed.projection_delta_size,"seed.projection_delta_size");
  parseDec(seed.extension_artifact_count,"seed.extension_artifact_count");
  parseDec(seed.behavior_extension_count,"seed.behavior_extension_count");
}

function buildProvider(seed, worldDigest){
  validateSeed(seed);
  const p = parseDec(seed.projection_delta_size, "seed.projection_delta_size");
  const a = parseDec(seed.extension_artifact_count, "seed.extension_artifact_count");
  const b = parseDec(seed.behavior_extension_count, "seed.behavior_extension_count");
  const extensionBody = {
    behavior_extension_count: seed.behavior_extension_count,
    extension_artifact_count: seed.extension_artifact_count,
    extension_scope: seed.extension_scope,
    projection_delta_size: seed.projection_delta_size,
    provider_id: seed.provider_id,
  };
  const extensionDigest = shaPref(Buffer.from(canonicalJson(extensionBody),"utf8"));
  const body = {
    authority: "advisory",
    behavior_extension_count: seed.behavior_extension_count,
    canonical_world_digest: worldDigest,
    extension_artifact_count: seed.extension_artifact_count,
    extension_digest: extensionDigest,
    extension_scope: seed.extension_scope,
    magnitude_m: String(p + a + b),
    projection_delta_size: seed.projection_delta_size,
    provider_id: seed.provider_id,
    v: VERSION,
  };
  return { ...body, digest: shaPref(Buffer.from(canonicalJson(body),"utf8")) };
}

function validateProvider(x, worldDigest){
  keyset(x,["authority","behavior_extension_count","canonical_world_digest","digest","extension_artifact_count","extension_digest","extension_scope","magnitude_m","projection_delta_size","provider_id","v"],"provider_extension");
  if(x.v!==VERSION) die("provider_extension version mismatch");
  if(x.authority!=="advisory") die("provider_extension authority must be advisory");
  requireSha(x.canonical_world_digest,"canonical_world_digest");
  requireSha(x.extension_digest,"extension_digest");
  requireSha(x.digest,"digest");
  if(!SCOPES.has(x.extension_scope)) die("extension_scope invalid");
  parseDec(x.projection_delta_size,"projection_delta_size");
  parseDec(x.extension_artifact_count,"extension_artifact_count");
  parseDec(x.behavior_extension_count,"behavior_extension_count");
  parseDec(x.magnitude_m,"magnitude_m");
  if(x.canonical_world_digest!==worldDigest) die("canonical_world_digest mismatch");
  const rebuilt = buildProvider({
    behavior_extension_count:x.behavior_extension_count,
    extension_artifact_count:x.extension_artifact_count,
    extension_scope:x.extension_scope,
    projection_delta_size:x.projection_delta_size,
    provider_id:x.provider_id,
  }, worldDigest);
  if(rebuilt.extension_digest!==x.extension_digest) die("extension_digest mismatch");
  if(rebuilt.magnitude_m!==x.magnitude_m) die("magnitude_m mismatch");
  requireMem(x,"provider_extension");
  const body = {
    authority:x.authority,
    behavior_extension_count:x.behavior_extension_count,
    canonical_world_digest:x.canonical_world_digest,
    extension_artifact_count:x.extension_artifact_count,
    extension_digest:x.extension_digest,
    extension_scope:x.extension_scope,
    magnitude_m:x.magnitude_m,
    projection_delta_size:x.projection_delta_size,
    provider_id:x.provider_id,
    v:x.v,
  };
  const want=shaPref(Buffer.from(canonicalJson(body),"utf8"));
  if(want!==x.digest) die("provider_extension digest mismatch");
}

async function main(){
  const args = parseArgs(process.argv.slice(2));
  if(args.help==="1"||!args.mode){
    console.log("mv-provider-metric emit --seed <provider.seed.json> --world-graph <world_graph.v0.json> --out <provider_extension.v0.json>");
    console.log("mv-provider-metric validate --provider-extension <provider_extension.v0.json> --world-graph <world_graph.v0.json>");
    return;
  }
  if(!args.worldGraph) die("--world-graph is required");
  const world = await readJson(args.worldGraph);
  validateWorldGraph(world);

  if(args.mode==="emit"){
    if(!args.seed || !args.out) die("emit requires --seed --out");
    const seed = await readJson(args.seed);
    const out = buildProvider(seed, world.digest);
    validateProvider(out, world.digest);
    await fs.writeFile(path.resolve(process.cwd(), args.out), canonicalJson(out), "utf8");
    console.log(`ok mv-provider-metric emit digest=${out.digest}`);
    return;
  }
  if(args.mode==="validate"){
    if(!args.provider) die("validate requires --provider-extension");
    const p = await readJson(args.provider);
    validateProvider(p, world.digest);
    console.log(`ok mv-provider-metric validate digest=${p.digest}`);
    return;
  }
  die("mode must be emit|validate");
}

main().catch((e)=>die(e.message || String(e)));

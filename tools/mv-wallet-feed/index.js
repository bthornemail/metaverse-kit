#!/usr/bin/env node
import fs from "fs/promises";
import path from "path";
import crypto from "crypto";
import http from "http";

const VERSION = "wallet_feed.v1";
const FEED_TYPE = "WalletEvent";
const ADDRESS_RE = /^0x[a-fA-F0-9]{40}$/;
const DIR_RE = /^(in|out)$/;

function die(msg) {
  console.error(`ERROR: ${msg}`);
  process.exit(2);
}

function parseArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "ingest" || a === "verify" || a === "project" || a === "serve") out.mode = a;
    else if (a === "--input" && argv[i + 1]) out.input = argv[++i];
    else if (a === "--out" && argv[i + 1]) out.out = argv[++i];
    else if (a === "--port" && argv[i + 1]) out.port = argv[++i];
    else if (a === "--address" && argv[i + 1]) out.address = argv[++i].toLowerCase();
    else if (a === "--help" || a === "-h") out.help = "1";
    else die(`unknown arg: ${a}`);
  }
  return out;
}

function stableStringify(value) {
  if (Array.isArray(value)) return `[${value.map((v) => stableStringify(v)).join(",")}]`;
  if (value && typeof value === "object") {
    const keys = Object.keys(value).sort();
    return `{${keys.map((k) => `${JSON.stringify(k)}:${stableStringify(value[k])}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

function canonicalJson(value) {
  return `${stableStringify(value)}\n`;
}

function sha256Pref(bytes) {
  return `sha256:${crypto.createHash("sha256").update(bytes).digest("hex")}`;
}

function parseNdjson(text) {
  const lines = text.split(/\r?\n/).filter((line) => line.trim().length > 0);
  const out = [];
  for (const [i, line] of lines.entries()) {
    try {
      out.push(JSON.parse(line));
    } catch (err) {
      die(`input parse error line=${i + 1}: ${err.message || err}`);
    }
  }
  return out;
}

function requireString(v, ctx) {
  if (typeof v !== "string" || v.length === 0) die(`${ctx} must be non-empty string`);
}

function requireUIntString(v, ctx) {
  if (typeof v !== "string" || !/^[0-9]+$/.test(v)) die(`${ctx} must be unsigned decimal string`);
}

function validateEvent(e, i) {
  const ctx = `event[${i}]`;
  requireString(e.type, `${ctx}.type`);
  requireString(e.chain, `${ctx}.chain`);
  requireString(e.address, `${ctx}.address`);
  requireString(e.tx, `${ctx}.tx`);
  requireString(e.event, `${ctx}.event`);
  requireString(e.asset, `${ctx}.asset`);
  requireString(e.amount, `${ctx}.amount`);
  requireString(e.direction, `${ctx}.direction`);
  requireString(e.source, `${ctx}.source`);
  requireUIntString(String(e.block), `${ctx}.block`);
  requireUIntString(String(e.timestamp), `${ctx}.timestamp`);
  if (!ADDRESS_RE.test(e.address)) die(`${ctx}.address invalid`);
  if (!DIR_RE.test(e.direction)) die(`${ctx}.direction invalid`);
}

function signEnvelope(payload) {
  const body = {
    chain: payload.chain,
    entity_id: payload.entity_id,
    entity_type: payload.entity_type,
    payload: payload.payload,
    source: payload.source,
    timestamp: payload.timestamp,
    v: VERSION,
  };
  const digest = sha256Pref(Buffer.from(canonicalJson(body), "utf8"));
  const keyId = process.env.MV_WALLET_FEED_KEY_ID || "dev-builder";
  const sigBody = `${keyId}:${digest}`;
  const signature = `sha256:${crypto.createHash("sha256").update(sigBody).digest("hex")}`;
  return { ...body, digest, proof: { key_id: keyId, signature } };
}

function toEnvelope(e) {
  const payload = {
    type: FEED_TYPE,
    address: e.address.toLowerCase(),
    tx: e.tx.toLowerCase(),
    block: String(e.block),
    event: e.event,
    asset: e.asset,
    amount: String(e.amount),
    direction: e.direction,
  };
  return signEnvelope({
    chain: e.chain,
    entity_id: `${e.chain}:${payload.address}:${payload.tx}:${payload.event}`,
    entity_type: FEED_TYPE,
    payload,
    source: e.source,
    timestamp: String(e.timestamp),
  });
}

async function readText(filePath) {
  return fs.readFile(path.resolve(process.cwd(), filePath), "utf8");
}

async function writeText(filePath, text) {
  const abs = path.resolve(process.cwd(), filePath);
  await fs.mkdir(path.dirname(abs), { recursive: true });
  await fs.writeFile(abs, text, "utf8");
}

async function loadEnvelopes(filePath) {
  const text = await readText(filePath);
  return parseNdjson(text);
}

function validateEnvelope(env, i) {
  const ctx = `envelope[${i}]`;
  const requiredTop = ["chain", "digest", "entity_id", "entity_type", "payload", "proof", "source", "timestamp", "v"];
  for (const k of requiredTop) {
    if (!(k in env)) die(`${ctx}.${k} missing`);
  }
  if (env.v !== VERSION) die(`${ctx}.v mismatch`);
  if (env.entity_type !== FEED_TYPE) die(`${ctx}.entity_type mismatch`);
  requireString(env.chain, `${ctx}.chain`);
  requireString(env.entity_id, `${ctx}.entity_id`);
  requireString(env.source, `${ctx}.source`);
  requireUIntString(String(env.timestamp), `${ctx}.timestamp`);
  if (!env.proof || typeof env.proof !== "object") die(`${ctx}.proof missing`);
  requireString(env.proof.key_id, `${ctx}.proof.key_id`);
  requireString(env.proof.signature, `${ctx}.proof.signature`);
  if (typeof env.payload !== "object" || !env.payload) die(`${ctx}.payload missing`);
  requireString(env.payload.address, `${ctx}.payload.address`);
  requireUIntString(String(env.payload.block), `${ctx}.payload.block`);
  requireString(env.payload.tx, `${ctx}.payload.tx`);
  requireString(env.payload.event, `${ctx}.payload.event`);
  requireString(env.payload.asset, `${ctx}.payload.asset`);
  requireString(env.payload.amount, `${ctx}.payload.amount`);
  requireString(env.payload.direction, `${ctx}.payload.direction`);
  if (!ADDRESS_RE.test(env.payload.address)) die(`${ctx}.payload.address invalid`);
  if (!DIR_RE.test(env.payload.direction)) die(`${ctx}.payload.direction invalid`);
  if (!/^sha256:[0-9a-f]{64}$/.test(env.digest)) die(`${ctx}.digest invalid`);
  if (!/^sha256:[0-9a-f]{64}$/.test(env.proof.signature)) die(`${ctx}.proof.signature invalid`);

  const body = {
    chain: env.chain,
    entity_id: env.entity_id,
    entity_type: env.entity_type,
    payload: env.payload,
    source: env.source,
    timestamp: env.timestamp,
    v: env.v,
  };
  const gotDigest = sha256Pref(Buffer.from(canonicalJson(body), "utf8"));
  if (gotDigest !== env.digest) die(`${ctx}.digest mismatch`);
}

function project(address, envelopes) {
  const addr = address.toLowerCase();
  const filtered = envelopes
    .filter((e) => e.payload?.address?.toLowerCase() === addr)
    .sort((a, b) => {
      const bA = Number(a.payload.block);
      const bB = Number(b.payload.block);
      if (bA !== bB) return bA - bB;
      return a.payload.tx.localeCompare(b.payload.tx);
    });

  const balances = {};
  for (const e of filtered) {
    const key = `${e.chain}:${e.payload.asset}`;
    const val = Number(e.payload.amount);
    const cur = Number(balances[key] || 0);
    const next = e.payload.direction === "in" ? cur + val : cur - val;
    balances[key] = Number(next.toFixed(12)).toString();
  }
  return {
    v: "wallet_projection.v1",
    address: addr,
    event_count: String(filtered.length),
    balances,
    latest_block: filtered.length > 0 ? String(filtered[filtered.length - 1].payload.block) : "0",
  };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help === "1" || !args.mode) {
    console.log("mv-wallet-feed ingest --input <events.ndjson> --out <wallet-feed.ndjson>");
    console.log("mv-wallet-feed verify --input <wallet-feed.ndjson>");
    console.log("mv-wallet-feed project --input <wallet-feed.ndjson> --address <0x...> --out <projection.json>");
    console.log("mv-wallet-feed serve --input <wallet-feed.ndjson> [--port 7777]");
    return;
  }

  if (args.mode === "ingest") {
    if (!args.input || !args.out) die("ingest requires --input and --out");
    const lines = parseNdjson(await readText(args.input));
    const envelopes = lines.map((line, i) => {
      validateEvent(line, i);
      return toEnvelope(line);
    });
    const out = envelopes.map((e) => canonicalJson(e)).join("");
    await writeText(args.out, out);
    console.log(`ok mv-wallet-feed ingest events=${envelopes.length} out=${args.out}`);
    return;
  }

  if (args.mode === "verify") {
    if (!args.input) die("verify requires --input");
    const envelopes = await loadEnvelopes(args.input);
    envelopes.forEach((e, i) => validateEnvelope(e, i));
    console.log(`ok mv-wallet-feed verify envelopes=${envelopes.length}`);
    return;
  }

  if (args.mode === "project") {
    if (!args.input || !args.out || !args.address) die("project requires --input --address --out");
    if (!ADDRESS_RE.test(args.address)) die("--address invalid");
    const envelopes = await loadEnvelopes(args.input);
    envelopes.forEach((e, i) => validateEnvelope(e, i));
    const out = project(args.address, envelopes);
    const outText = canonicalJson(out);
    await writeText(args.out, outText);
    const digest = sha256Pref(Buffer.from(outText, "utf8"));
    console.log(`ok mv-wallet-feed project digest=${digest} out=${args.out}`);
    return;
  }

  if (args.mode === "serve") {
    if (!args.input) die("serve requires --input");
    const port = Number(args.port || 7777);
    const absInput = path.resolve(process.cwd(), args.input);
    const server = http.createServer(async (req, res) => {
      try {
        if (!req.url) {
          res.statusCode = 400;
          res.end("missing url\n");
          return;
        }
        const u = new URL(req.url, "http://localhost");
        if (u.pathname !== "/feed") {
          res.statusCode = 404;
          res.end("not found\n");
          return;
        }
        const since = Number(u.searchParams.get("since") || "0");
        const rows = parseNdjson(await fs.readFile(absInput, "utf8"));
        const sliced = rows.slice(Number.isFinite(since) && since >= 0 ? since : 0);
        res.setHeader("content-type", "application/x-ndjson; charset=utf-8");
        res.statusCode = 200;
        for (const row of sliced) {
          res.write(canonicalJson(row));
        }
        res.end();
      } catch (err) {
        res.statusCode = 500;
        res.end(`error: ${err.message || err}\n`);
      }
    });
    server.listen(port, "127.0.0.1", () => {
      console.log(`ok mv-wallet-feed serve port=${port} input=${args.input}`);
    });
    return;
  }

  die("mode must be ingest|verify|project|serve");
}

main().catch((err) => die(err.message || String(err)));

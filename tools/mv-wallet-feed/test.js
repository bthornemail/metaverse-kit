#!/usr/bin/env node
import fs from "fs/promises";
import os from "os";
import path from "path";
import crypto from "crypto";
import { spawnSync } from "child_process";

const TOOL = path.resolve(process.cwd(), "tools/mv-wallet-feed/index.js");

function fail(msg) {
  console.error(`FAIL: ${msg}`);
  process.exit(2);
}

function run(args, env = {}) {
  return spawnSync(process.execPath, [TOOL, ...args], {
    encoding: "utf8",
    env: { ...process.env, ...env },
  });
}

function expectOk(res, label) {
  if (res.status !== 0) {
    fail(`${label} failed\nstdout=${res.stdout}\nstderr=${res.stderr}`);
  }
}

function expectFail(res, label, pattern) {
  if (res.status === 0) fail(`${label} unexpectedly succeeded`);
  const text = `${res.stdout}\n${res.stderr}`;
  if (pattern && !pattern.test(text)) {
    fail(`${label} failed with unexpected output\n${text}`);
  }
}

async function main() {
  const tmp = await fs.mkdtemp(path.join(os.tmpdir(), "mv-wallet-feed-test-"));
  const feedInput = path.join(tmp, "input.ndjson");
  const feedOutput = path.join(tmp, "feed.ndjson");

  const event = {
    type: "WalletEvent",
    chain: "ethereum",
    address: "0xBAf66f816aaE45CA6476809a61bA02E92BC6D183",
    block: "1",
    tx: "0x1111111111111111111111111111111111111111111111111111111111111111",
    timestamp: "2",
    event: "transfer",
    asset: "ETH",
    amount: "10",
    direction: "in",
    source: "test",
  };
  await fs.writeFile(feedInput, `${JSON.stringify(event)}\n`, "utf8");

  const a = crypto.generateKeyPairSync("ed25519");
  const b = crypto.generateKeyPairSync("ed25519");
  const privatePem = a.privateKey.export({ type: "pkcs8", format: "pem" }).toString();
  const publicPem = a.publicKey.export({ type: "spki", format: "pem" }).toString();
  const otherPublicPem = b.publicKey.export({ type: "spki", format: "pem" }).toString();

  const allowlistPath = path.join(tmp, "allowlist.json");
  await fs.writeFile(
    allowlistPath,
    JSON.stringify({ keys: { "test-key": publicPem } }, null, 2),
    "utf8"
  );

  const envBase = {
    MV_WALLET_FEED_KEY_ID: "test-key",
    MV_WALLET_FEED_PRIVATE_KEY_PEM: privatePem,
    MV_WALLET_FEED_KEY_ALLOWLIST: allowlistPath,
  };

  expectOk(run(["ingest", "--input", feedInput, "--out", feedOutput], envBase), "ingest");
  expectOk(run(["verify", "--input", feedOutput], envBase), "verify baseline");

  const rows = (await fs.readFile(feedOutput, "utf8")).trim().split("\n").map((x) => JSON.parse(x));
  const row = rows[0];

  const tamperedSigPath = path.join(tmp, "tampered-signature.ndjson");
  const [sigPrefix, sigB64] = row.proof.signature.split(":", 2);
  const b64Chars = sigB64.split("");
  const idx = Math.min(5, b64Chars.length - 1);
  b64Chars[idx] = b64Chars[idx] === "A" ? "B" : "A";
  row.proof.signature = `${sigPrefix}:${b64Chars.join("")}`;
  await fs.writeFile(tamperedSigPath, `${JSON.stringify(row)}\n`, "utf8");
  expectFail(run(["verify", "--input", tamperedSigPath], envBase), "signature mismatch", /signature verify failed|signature invalid/);

  const cleanRow = JSON.parse((await fs.readFile(feedOutput, "utf8")).trim().split("\n")[0]);
  const badDigestPath = path.join(tmp, "bad-digest.ndjson");
  cleanRow.digest = "sha256:0000000000000000000000000000000000000000000000000000000000000000";
  await fs.writeFile(badDigestPath, `${JSON.stringify(cleanRow)}\n`, "utf8");
  expectFail(run(["verify", "--input", badDigestPath], envBase), "digest mismatch", /digest mismatch/);

  const tamperedPayloadPath = path.join(tmp, "tampered-payload.ndjson");
  const tamperedPayload = JSON.parse((await fs.readFile(feedOutput, "utf8")).trim().split("\n")[0]);
  tamperedPayload.payload.asset = "USDC";
  await fs.writeFile(tamperedPayloadPath, `${JSON.stringify(tamperedPayload)}\n`, "utf8");
  expectFail(run(["verify", "--input", tamperedPayloadPath], envBase), "payload tamper", /digest mismatch/);

  const wrongKeyAllowlist = path.join(tmp, "wrong-key-allowlist.json");
  await fs.writeFile(wrongKeyAllowlist, JSON.stringify({ keys: { "test-key": otherPublicPem } }, null, 2), "utf8");
  expectFail(
    run(["verify", "--input", feedOutput], { ...envBase, MV_WALLET_FEED_KEY_ALLOWLIST: wrongKeyAllowlist }),
    "wrong public key",
    /public key mismatch/
  );

  const missingKeyAllowlist = path.join(tmp, "missing-key-allowlist.json");
  await fs.writeFile(missingKeyAllowlist, JSON.stringify({ keys: {} }, null, 2), "utf8");
  expectFail(
    run(["verify", "--input", feedOutput], { ...envBase, MV_WALLET_FEED_KEY_ALLOWLIST: missingKeyAllowlist }),
    "non-allowlisted key_id",
    /not allowlisted/
  );

  console.log("ok mv-wallet-feed tests");
}

main().catch((err) => fail(err.stack || String(err)));

async function sha256Hex(bytes) {
  const hash = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(hash)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

function toPref(hex) {
  return `sha256:${hex}`;
}

export async function verifyBundle(base = "../") {
  const manifestRes = await fetch(`${base}manifest.json`, { cache: "no-store" });
  if (!manifestRes.ok) throw new Error(`manifest fetch failed: ${manifestRes.status}`);
  const manifestText = await manifestRes.text();
  const manifestBytes = new TextEncoder().encode(manifestText);

  const integrityRes = await fetch(`${base}integrity.sha256`, { cache: "no-store" });
  if (!integrityRes.ok) throw new Error(`integrity fetch failed: ${integrityRes.status}`);
  const integrity = (await integrityRes.text()).trim();
  const gotManifestDigest = toPref(await sha256Hex(manifestBytes));
  if (integrity !== gotManifestDigest) {
    throw new Error(`manifest digest mismatch: expected ${integrity} got ${gotManifestDigest}`);
  }

  const manifest = JSON.parse(manifestText);
  const files = manifest.files || [];
  for (const file of files) {
    const res = await fetch(`${base}${file.path}`, { cache: "no-store" });
    if (!res.ok) throw new Error(`asset fetch failed: ${file.path}`);
    const buf = await res.arrayBuffer();
    const got = toPref(await sha256Hex(buf));
    if (got !== file.sha256) {
      throw new Error(`asset digest mismatch: ${file.path}`);
    }
    if (String(buf.byteLength) !== String(file.bytes)) {
      throw new Error(`asset size mismatch: ${file.path}`);
    }
  }

  return {
    manifest,
    manifestDigest: gotManifestDigest,
  };
}

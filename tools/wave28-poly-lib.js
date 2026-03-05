import crypto from "crypto";

export const SHA_RE = /^sha256:[0-9a-f]{64}$/;
export const BITS6_RE = /^[01]{6}$/;
export const BIT_RE = /^[01]$/;

export const MATRIX_LAYOUT_ID = "wave28.matrix_layout.core6.v0";
export const DECOMPOSE_ID = "wave28.decompose.gauss_f2.v0";
export const NORM_ID = "wave28.poly_norm.bitmask_lex.v0";

export function die(msg) {
  console.error(`ERROR: ${msg}`);
  process.exit(2);
}

export function stableStringify(value) {
  if (Array.isArray(value)) return `[${value.map((v) => stableStringify(v)).join(",")}]`;
  if (value && typeof value === "object") {
    const keys = Object.keys(value).sort();
    return `{${keys.map((k) => `${JSON.stringify(k)}:${stableStringify(value[k])}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

export function canonicalJson(obj) {
  return `${stableStringify(obj)}\n`;
}

export function shaPref(bytes) {
  return `sha256:${crypto.createHash("sha256").update(bytes).digest("hex")}`;
}

export function keyset(obj, expected, ctx) {
  const got = Object.keys(obj).sort().join(",");
  const want = [...expected].sort().join(",");
  if (got !== want) die(`${ctx} keyset mismatch`);
}

export function requireSha(v, ctx) {
  if (typeof v !== "string" || !SHA_RE.test(v)) die(`${ctx} invalid sha256`);
}

export function requireBitString(v, ctx) {
  if (typeof v !== "string" || !BIT_RE.test(v)) die(`${ctx} must be bit string 0|1`);
}

export function requireBits6(v, ctx) {
  if (typeof v !== "string" || !BITS6_RE.test(v)) die(`${ctx} must be 6-bit string`);
}

export function requireStringMembrane(v, ctx) {
  if (Array.isArray(v)) {
    v.forEach((item, i) => requireStringMembrane(item, `${ctx}[${i}]`));
    return;
  }
  if (v && typeof v === "object") {
    for (const [k, inner] of Object.entries(v)) requireStringMembrane(inner, `${ctx}.${k}`);
    return;
  }
  if (typeof v !== "string") die(`${ctx} violates string membrane`);
}

function varIndex(token, ctx) {
  const m = /^x([1-6])$/.exec(token);
  if (!m) die(`${ctx} invalid variable token`);
  return Number(m[1]);
}

export function maskToBitString(mask) {
  return mask.toString(2).padStart(6, "0");
}

export function parseMonomial(term, ctx) {
  if (term === "1") return 0;
  const factors = term.split("*");
  if (factors.length === 0) die(`${ctx} invalid monomial`);
  let prev = 0;
  let mask = 0;
  for (const [i, f] of factors.entries()) {
    const idx = varIndex(f, `${ctx}.factor[${i}]`);
    if (idx <= prev) die(`${ctx} factors must be strictly increasing`);
    prev = idx;
    mask |= 1 << (idx - 1);
  }
  return mask;
}

export function renderMonomial(mask) {
  if (mask === 0) return "1";
  const out = [];
  for (let i = 1; i <= 6; i++) {
    if (mask & (1 << (i - 1))) out.push(`x${i}`);
  }
  return out.join("*");
}

export function parsePolyCanonical(poly, ctx) {
  if (typeof poly !== "string" || poly.length === 0) die(`${ctx} must be non-empty string`);
  if (poly === "0") return [];
  const terms = poly.split("+");
  if (terms.some((t) => t.length === 0)) die(`${ctx} invalid plus separator`);
  const masks = terms.map((t, i) => parseMonomial(t, `${ctx}.term[${i}]`));
  const unique = new Set(masks);
  if (unique.size !== masks.length) die(`${ctx} duplicate/canceling term not canonical`);
  const sorted = [...masks].sort((a, b) => maskToBitString(a).localeCompare(maskToBitString(b)));
  for (let i = 0; i < masks.length; i++) {
    if (masks[i] !== sorted[i]) die(`${ctx} terms not canonical order`);
  }
  return masks;
}

export function renderPolyFromMasks(masks) {
  if (masks.length === 0) return "0";
  const sorted = [...masks].sort((a, b) => maskToBitString(a).localeCompare(maskToBitString(b)));
  return sorted.map((m) => renderMonomial(m)).join("+");
}

export function validateBasisArtifact(basis) {
  keyset(basis, ["authority", "basis", "basis_order", "digest", "field", "v", "variables"], "basis");
  if (basis.v !== "wave28.zero_poly_basis.v0") die("basis version mismatch");
  if (basis.authority !== "advisory") die("basis authority must be advisory");
  if (basis.field !== "F2") die("basis field must be F2");
  if (!Array.isArray(basis.variables) || basis.variables.length === 0) die("variables must be non-empty array");
  if (!Array.isArray(basis.basis) || basis.basis.length === 0) die("basis must be non-empty array");
  if (!Array.isArray(basis.basis_order) || basis.basis_order.length === 0) die("basis_order must be non-empty array");
  requireSha(basis.digest, "basis.digest");

  for (const [i, v] of basis.variables.entries()) {
    if (typeof v !== "string" || !/^x[1-6]$/.test(v)) die(`variables[${i}] invalid`);
  }
  if (new Set(basis.variables).size !== basis.variables.length) die("variables duplicate");

  const basisMasks = basis.basis.map((p, i) => {
    const masks = parsePolyCanonical(p, `basis[${i}]`);
    if (masks.length !== 1) die(`basis[${i}] must be monomial in v0`);
    return masks[0];
  });
  const orderMasks = basis.basis_order.map((p, i) => {
    const masks = parsePolyCanonical(p, `basis_order[${i}]`);
    if (masks.length !== 1) die(`basis_order[${i}] must be monomial in v0`);
    return masks[0];
  });
  if (basisMasks.length !== orderMasks.length) die("basis and basis_order length mismatch");
  if (new Set(basisMasks).size !== basisMasks.length) die("basis terms duplicate");
  if (JSON.stringify(basis.basis) !== JSON.stringify(basis.basis_order)) die("basis_order must equal basis in v0");

  const expectedSort = [...basisMasks].sort((a, b) => maskToBitString(a).localeCompare(maskToBitString(b)));
  if (JSON.stringify(basisMasks) !== JSON.stringify(expectedSort)) die("basis must be sorted by monomial bitmask lexicographic order");

  requireStringMembrane(basis, "basis");
  const body = {
    authority: basis.authority,
    basis: basis.basis,
    basis_order: basis.basis_order,
    field: basis.field,
    v: basis.v,
    variables: basis.variables,
  };
  const want = shaPref(Buffer.from(canonicalJson(body), "utf8"));
  if (want !== basis.digest) die("basis digest mismatch");

  return { basisMasks, basisOrderMasks: orderMasks };
}

export function validateConstraintsArtifact(constraints) {
  keyset(constraints, ["authority", "digest", "matrix_layout_id", "row_masks", "v"], "constraints");
  if (constraints.v !== "wave28.constraints.v0") die("constraints version mismatch");
  if (constraints.authority !== "advisory") die("constraints authority must be advisory");
  if (constraints.matrix_layout_id !== MATRIX_LAYOUT_ID) die("constraints matrix_layout_id mismatch");
  requireSha(constraints.digest, "constraints.digest");
  if (!Array.isArray(constraints.row_masks) || constraints.row_masks.length !== 6) die("constraints.row_masks must be array[6]");
  constraints.row_masks.forEach((r, i) => requireBits6(r, `constraints.row_masks[${i}]`));
  requireStringMembrane(constraints, "constraints");
  const body = {
    authority: constraints.authority,
    matrix_layout_id: constraints.matrix_layout_id,
    row_masks: constraints.row_masks,
    v: constraints.v,
  };
  const want = shaPref(Buffer.from(canonicalJson(body), "utf8"));
  if (want !== constraints.digest) die("constraints digest mismatch");
}

export function validateCarrierArtifact(carrier) {
  keyset(carrier, ["authority", "carrier_bits", "digest", "v"], "carrier_state");
  if (carrier.v !== "wave28.carrier_state.v0") die("carrier_state version mismatch");
  if (carrier.authority !== "advisory") die("carrier_state authority must be advisory");
  requireBits6(carrier.carrier_bits, "carrier_state.carrier_bits");
  requireSha(carrier.digest, "carrier_state.digest");
  requireStringMembrane(carrier, "carrier_state");
  const body = {
    authority: carrier.authority,
    carrier_bits: carrier.carrier_bits,
    v: carrier.v,
  };
  const want = shaPref(Buffer.from(canonicalJson(body), "utf8"));
  if (want !== carrier.digest) die("carrier_state digest mismatch");
}

export function determinantNonZeroF2(matrixRows) {
  const rows = matrixRows.map((r) => parseInt(r, 2));
  let rank = 0;
  for (let col = 5; col >= 0; col--) {
    let pivot = -1;
    for (let i = rank; i < 6; i++) {
      if ((rows[i] >> col) & 1) {
        pivot = i;
        break;
      }
    }
    if (pivot < 0) continue;
    [rows[rank], rows[pivot]] = [rows[pivot], rows[rank]];
    for (let i = 0; i < 6; i++) {
      if (i !== rank && ((rows[i] >> col) & 1)) rows[i] ^= rows[rank];
    }
    rank += 1;
  }
  return rank === 6;
}

export function rotateBits6(bits, shift) {
  const n = Number.parseInt(bits, 2);
  const s = shift % 6;
  const out = ((n << s) | (n >> (6 - s))) & 0b111111;
  return out.toString(2).padStart(6, "0");
}

export function xorBits6(a, b) {
  const x = Number.parseInt(a, 2) ^ Number.parseInt(b, 2);
  return x.toString(2).padStart(6, "0");
}

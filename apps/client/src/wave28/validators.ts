export type ValidationResult<T> = {
  ok: true;
  value: T;
} | {
  ok: false;
  error: string;
};

import { SHA_RE, canonicalJson, sha256Prefixed } from './canonical';

export type Wave28SignalPolyProjection = {
  v: 'wave28.signal_poly_projection.v0';
  authority: 'advisory';
  source_type: 'pointer_sync' | 'txrx';
  source_digest: string;
  poly_decomp_digest: string;
  input_poly: string;
  norm_id: 'wave28.poly_norm.bitmask_lex.v0';
  digest: string;
};

export type Wave28PolyDecomp = {
  v: 'wave28.poly_decomp.v0';
  authority: 'advisory';
  basis_digest: string;
  closed_config_digest: string;
  input_poly: string;
  coeff_vector: string[];
  residual_poly: string;
  norm_id: 'wave28.poly_norm.bitmask_lex.v0';
  digest: string;
};

export type Wave27Residual = {
  v: 'wave27.pointer_sync_residual.v0';
  authority: 'advisory';
  turn_clock_id: 'wave27.turn_clock.delta12.v0';
  turn_project_id: 'wave27.turn_project.delta12_line_res.v0';
  reflect_id: 'wave27.reflect.parity_p.v0';
  fail_k: string;
  p_before: string;
  candidate_a: string;
  candidate_b: string;
  ring_fingerprint: string;
  digest: string;
};

function expectObject(input: unknown, ctx: string): Record<string, unknown> {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    throw new Error(`${ctx} must be object`);
  }
  return input as Record<string, unknown>;
}

function requireKeyset(obj: Record<string, unknown>, expected: string[], ctx: string) {
  const got = Object.keys(obj).sort().join(',');
  const want = [...expected].sort().join(',');
  if (got !== want) throw new Error(`${ctx} keyset mismatch`);
}

function requireString(v: unknown, ctx: string): string {
  if (typeof v !== 'string') throw new Error(`${ctx} must be string`);
  return v;
}

function requireDigest(v: unknown, ctx: string): string {
  const s = requireString(v, ctx);
  if (!SHA_RE.test(s)) throw new Error(`${ctx} invalid sha256`);
  return s;
}

function requireUnsignedString(v: unknown, ctx: string): string {
  const s = requireString(v, ctx);
  if (!/^[0-9]+$/.test(s)) throw new Error(`${ctx} must be unsigned decimal string`);
  return s;
}

function parseMonomial(term: string, ctx: string): number {
  if (term === '1') return 0;
  const parts = term.split('*');
  let prev = 0;
  let mask = 0;
  for (const [i, part] of parts.entries()) {
    const m = /^x([1-6])$/.exec(part);
    if (!m) throw new Error(`${ctx}.factor[${i}] invalid variable token`);
    const idx = Number(m[1]);
    if (idx <= prev) throw new Error(`${ctx} factors must be strictly increasing`);
    prev = idx;
    mask |= 1 << (idx - 1);
  }
  return mask;
}

function maskToken(mask: number): string {
  return mask.toString(2).padStart(6, '0');
}

export function validateCanonicalPolyString(poly: string, ctx: string) {
  if (poly === '0') return;
  if (poly.length === 0) throw new Error(`${ctx} must be non-empty`);
  if (poly.includes('(') || poly.includes(')')) throw new Error(`${ctx} parentheses not allowed in v0`);
  const terms = poly.split('+');
  if (terms.some((t) => t.length === 0)) throw new Error(`${ctx} invalid term separators`);
  const masks = terms.map((t, i) => parseMonomial(t, `${ctx}.term[${i}]`));
  if (new Set(masks).size !== masks.length) throw new Error(`${ctx} duplicate terms not canonical`);
  const sorted = [...masks].sort((a, b) => maskToken(a).localeCompare(maskToken(b)));
  if (JSON.stringify(sorted) !== JSON.stringify(masks)) throw new Error(`${ctx} terms not canonical order`);
}

async function verifyDigest(obj: Record<string, unknown>, ctx: string) {
  const body = { ...obj };
  delete body.digest;
  const want = await sha256Prefixed(canonicalJson(body));
  if (want !== obj.digest) throw new Error(`${ctx} digest mismatch`);
}

export async function validateWave28SignalPolyProjection(input: unknown): Promise<ValidationResult<Wave28SignalPolyProjection>> {
  try {
    const obj = expectObject(input, 'wave28.signal_poly_projection');
    requireKeyset(obj, ['v', 'authority', 'source_type', 'source_digest', 'poly_decomp_digest', 'input_poly', 'norm_id', 'digest'], 'wave28.signal_poly_projection');
    if (obj.v !== 'wave28.signal_poly_projection.v0') throw new Error('wave28.signal_poly_projection version mismatch');
    if (obj.authority !== 'advisory') throw new Error('wave28.signal_poly_projection authority must be advisory');
    if (obj.source_type !== 'pointer_sync' && obj.source_type !== 'txrx') throw new Error('wave28.signal_poly_projection source_type invalid');
    if (obj.norm_id !== 'wave28.poly_norm.bitmask_lex.v0') throw new Error('wave28.signal_poly_projection norm_id mismatch');

    requireDigest(obj.source_digest, 'wave28.signal_poly_projection.source_digest');
    const decompDigest = requireString(obj.poly_decomp_digest, 'wave28.signal_poly_projection.poly_decomp_digest');
    if (decompDigest !== '') requireDigest(decompDigest, 'wave28.signal_poly_projection.poly_decomp_digest');
    requireDigest(obj.digest, 'wave28.signal_poly_projection.digest');

    validateCanonicalPolyString(requireString(obj.input_poly, 'wave28.signal_poly_projection.input_poly'), 'wave28.signal_poly_projection.input_poly');
    await verifyDigest(obj, 'wave28.signal_poly_projection');

    return { ok: true, value: obj as Wave28SignalPolyProjection };
  } catch (error: any) {
    return { ok: false, error: String(error?.message ?? error) };
  }
}

export async function validateWave28PolyDecomp(input: unknown): Promise<ValidationResult<Wave28PolyDecomp>> {
  try {
    const obj = expectObject(input, 'wave28.poly_decomp');
    requireKeyset(obj, ['v', 'authority', 'basis_digest', 'closed_config_digest', 'input_poly', 'coeff_vector', 'residual_poly', 'norm_id', 'digest'], 'wave28.poly_decomp');
    if (obj.v !== 'wave28.poly_decomp.v0') throw new Error('wave28.poly_decomp version mismatch');
    if (obj.authority !== 'advisory') throw new Error('wave28.poly_decomp authority must be advisory');
    if (obj.norm_id !== 'wave28.poly_norm.bitmask_lex.v0') throw new Error('wave28.poly_decomp norm_id mismatch');

    requireDigest(obj.basis_digest, 'wave28.poly_decomp.basis_digest');
    requireDigest(obj.closed_config_digest, 'wave28.poly_decomp.closed_config_digest');
    requireDigest(obj.digest, 'wave28.poly_decomp.digest');

    validateCanonicalPolyString(requireString(obj.input_poly, 'wave28.poly_decomp.input_poly'), 'wave28.poly_decomp.input_poly');
    validateCanonicalPolyString(requireString(obj.residual_poly, 'wave28.poly_decomp.residual_poly'), 'wave28.poly_decomp.residual_poly');

    if (!Array.isArray(obj.coeff_vector)) throw new Error('wave28.poly_decomp.coeff_vector must be array');
    for (const [i, v] of obj.coeff_vector.entries()) {
      const s = requireString(v, `wave28.poly_decomp.coeff_vector[${i}]`);
      if (s !== '0' && s !== '1') throw new Error(`wave28.poly_decomp.coeff_vector[${i}] invalid`);
    }

    await verifyDigest(obj, 'wave28.poly_decomp');
    return { ok: true, value: obj as Wave28PolyDecomp };
  } catch (error: any) {
    return { ok: false, error: String(error?.message ?? error) };
  }
}

export async function validateWave27Residual(input: unknown): Promise<ValidationResult<Wave27Residual>> {
  try {
    const obj = expectObject(input, 'wave27.pointer_sync_residual');
    requireKeyset(obj, ['v', 'authority', 'turn_clock_id', 'turn_project_id', 'reflect_id', 'fail_k', 'p_before', 'candidate_a', 'candidate_b', 'ring_fingerprint', 'digest'], 'wave27.pointer_sync_residual');

    if (obj.v !== 'wave27.pointer_sync_residual.v0') throw new Error('wave27.pointer_sync_residual version mismatch');
    if (obj.authority !== 'advisory') throw new Error('wave27.pointer_sync_residual authority must be advisory');
    if (obj.turn_clock_id !== 'wave27.turn_clock.delta12.v0') throw new Error('wave27.pointer_sync_residual turn_clock_id mismatch');
    if (obj.turn_project_id !== 'wave27.turn_project.delta12_line_res.v0') throw new Error('wave27.pointer_sync_residual turn_project_id mismatch');
    if (obj.reflect_id !== 'wave27.reflect.parity_p.v0') throw new Error('wave27.pointer_sync_residual reflect_id mismatch');

    requireUnsignedString(obj.fail_k, 'wave27.pointer_sync_residual.fail_k');
    requireUnsignedString(obj.p_before, 'wave27.pointer_sync_residual.p_before');
    requireUnsignedString(obj.candidate_a, 'wave27.pointer_sync_residual.candidate_a');
    requireUnsignedString(obj.candidate_b, 'wave27.pointer_sync_residual.candidate_b');
    requireDigest(obj.ring_fingerprint, 'wave27.pointer_sync_residual.ring_fingerprint');
    requireDigest(obj.digest, 'wave27.pointer_sync_residual.digest');

    await verifyDigest(obj, 'wave27.pointer_sync_residual');
    return { ok: true, value: obj as Wave27Residual };
  } catch (error: any) {
    return { ok: false, error: String(error?.message ?? error) };
  }
}

export function detectArtifactVersion(input: unknown): string {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return '';
  const maybe = (input as Record<string, unknown>).v;
  return typeof maybe === 'string' ? maybe : '';
}

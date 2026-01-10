// ADDR.v1 Implementation: Content Addressing for Metaverse Kit
// Provides immutable content IDs (RID) and structural pointers (SID)

import { createHash } from "crypto";

// ============================================================================
// Type Definitions
// ============================================================================

export type HashAlgo = "sha256" | "blake3";
export type HashRef = `${HashAlgo}:${string}`;

// ============================================================================
// Canonical JSON Serialization
// ============================================================================

/**
 * Deterministic JSON canonicalization (MVP implementation).
 *
 * Rules:
 * - Object keys sorted lexicographically
 * - Arrays preserved in order
 * - Numbers emitted via JSON.stringify (no NaN/Infinity allowed)
 * - UTF-8 encoding for bytes
 * - Undefined values omitted (like JSON.stringify)
 *
 * NOTE: This is not full RFC 8785 (JCS), but stable for typical JSON data.
 * For full compliance, consider using a dedicated JCS library.
 */
export function stableStringify(value: unknown): string {
  return stringifyInner(value);

  function stringifyInner(v: unknown): string {
    if (v === null) return "null";

    const t = typeof v;

    if (t === "string") {
      return JSON.stringify(v);
    }

    if (t === "number") {
      if (!Number.isFinite(v as number)) {
        throw new Error("Non-finite number not allowed in canonical JSON");
      }
      return JSON.stringify(v);
    }

    if (t === "boolean") {
      return v ? "true" : "false";
    }

    if (t === "bigint") {
      throw new Error("bigint not allowed in JSON canonicalization");
    }

    if (Array.isArray(v)) {
      return `[${v.map((x) => stringifyInner(x)).join(",")}]`;
    }

    if (t === "object") {
      const obj = v as Record<string, unknown>;
      const keys = Object.keys(obj).sort();
      const parts: string[] = [];

      for (const k of keys) {
        const val = obj[k];
        if (val === undefined) continue; // omit undefined like JSON.stringify does
        parts.push(`${JSON.stringify(k)}:${stringifyInner(val)}`);
      }

      return `{${parts.join(",")}}`;
    }

    throw new Error(`Unsupported type in canonical JSON: ${t}`);
  }
}

// ============================================================================
// Hashing Functions
// ============================================================================

/**
 * Hash raw bytes using the specified algorithm.
 */
export function hashBytes(bytes: Buffer, algo: HashAlgo = "sha256"): HashRef {
  if (algo !== "sha256") {
    throw new Error(`Hash algorithm '${algo}' not yet supported (use sha256)`);
  }

  const hex = createHash(algo).update(bytes).digest("hex");
  return `${algo}:${hex}`;
}

/**
 * Hash a UTF-8 string using the specified algorithm.
 */
export function hashUtf8(s: string, algo: HashAlgo = "sha256"): HashRef {
  return hashBytes(Buffer.from(s, "utf8"), algo);
}

// ============================================================================
// RID (Immutable Content ID)
// ============================================================================

/**
 * Generate RID from already-materialized stored line (recommended).
 * Use this when you have the exact bytes that were or will be stored.
 */
export function ridFromStoredLine(lineBytes: Buffer, algo: HashAlgo = "sha256"): HashRef {
  return hashBytes(lineBytes, algo);
}

/**
 * Generate RID from a JSON value by canonical JSON bytes.
 * This ensures the same object structure always produces the same RID.
 */
export function ridFromJson(value: unknown, algo: HashAlgo = "sha256"): HashRef {
  const canonical = stableStringify(value);
  return hashUtf8(canonical, algo);
}

// ============================================================================
// SID (Structural Pointer via HD Paths)
// ============================================================================

/**
 * Create a canonical HD path for structural addressing.
 *
 * Format: m/world/{spaceId}/tiles/{tileId}/{role}
 *
 * Role examples: "head", "index", "manifest", "snapshot/{eventId}"
 */
export function makeHdPath(spaceId: string, tileId: string, role: string): string {
  return `m/world/${spaceId}/tiles/${tileId}/${role}`;
}

/**
 * Generate SID from canonical HD path.
 * SIDs point to mutable structural locations.
 */
export function sidFromPath(pathString: string, algo: HashAlgo = "sha256"): HashRef {
  return hashUtf8(pathString, algo);
}

// ============================================================================
// Deterministic Ordering for Multiple Inputs
// ============================================================================

export interface OrderedInput {
  type: string;
  ts?: number;
  rid: HashRef;
}

/**
 * Sort inputs deterministically for hashing.
 * Order: type → timestamp → rid (lexicographic)
 */
export function sortInputs(inputs: OrderedInput[]): OrderedInput[] {
  return [...inputs].sort((a, b) => {
    // First by type
    if (a.type !== b.type) {
      return a.type.localeCompare(b.type);
    }

    // Then by timestamp (undefined = 0)
    const ta = a.ts ?? 0;
    const tb = b.ts ?? 0;
    if (ta !== tb) {
      return ta - tb;
    }

    // Finally by rid
    return a.rid.localeCompare(b.rid);
  });
}

/**
 * Hash a list of ordered inputs deterministically.
 * Useful for combining multiple events/segments into a stable reference.
 */
export function hashOrderedInputs(inputs: OrderedInput[], algo: HashAlgo = "sha256"): HashRef {
  const ordered = sortInputs(inputs);

  // Normalize to canonical form (ts: null instead of undefined)
  const normalized = ordered.map((x) => ({
    type: x.type,
    ts: x.ts ?? null,
    rid: x.rid,
  }));

  const canonical = stableStringify(normalized);
  return hashUtf8(canonical, algo);
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Verify that a hash reference has the correct format.
 */
export function isValidHashRef(ref: string): ref is HashRef {
  const parts = ref.split(":");
  if (parts.length !== 2) return false;

  const [algo, hex] = parts;
  if (algo !== "sha256" && algo !== "blake3") return false;

  // Check hex format
  const hexLength = algo === "sha256" ? 64 : 64; // blake3 also 64 chars
  if (hex.length !== hexLength) return false;
  if (!/^[0-9a-f]+$/.test(hex)) return false;

  return true;
}

/**
 * Extract algorithm from hash reference.
 */
export function getHashAlgo(ref: HashRef): HashAlgo {
  const algo = ref.split(":")[0];
  if (algo !== "sha256" && algo !== "blake3") {
    throw new Error(`Invalid hash algorithm in reference: ${algo}`);
  }
  return algo as HashAlgo;
}

/**
 * Extract hex digest from hash reference.
 */
export function getHashHex(ref: HashRef): string {
  return ref.split(":")[1];
}

// ============================================================================
// Utility: Verify Content Integrity
// ============================================================================

/**
 * Verify that content matches its hash reference.
 * Returns true if the content hashes to the expected reference.
 */
export function verifyIntegrity(content: Buffer, expectedRef: HashRef): boolean {
  const algo = getHashAlgo(expectedRef);
  const actualRef = hashBytes(content, algo);
  return actualRef === expectedRef;
}

/**
 * Verify JSON content integrity.
 */
export function verifyJsonIntegrity(value: unknown, expectedRef: HashRef): boolean {
  const algo = getHashAlgo(expectedRef);
  const actualRef = ridFromJson(value, algo);
  return actualRef === expectedRef;
}

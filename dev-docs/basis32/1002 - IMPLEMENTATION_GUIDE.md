Below is a **full implementation guide** that turns **NF.v1 / ADDR.v1 / PF16.v1** into a buildable system with concrete modules, algorithms, file layouts, and test criteria. It assumes your existing baseline: **events JSONL**, **Tile Store v1**, **shadow canvas**, **scope dotfiles**, **discovery graph**, and optional **WASM projectors**.

---

# Implementation Guide: NF.v1 + ADDR.v1 + PF16.v1

## 0) What you’re building

A system with three “laws”:

1. **ADDR.v1**: how you name things (immutable content IDs + mutable structural pointers)
2. **NF.v1**: how you determine equivalence (what transforms are “the same”)
3. **PF16.v1**: how identities combine (typed 16-slot identity composition)

These laws attach to the existing pipeline:

```
Events (JSONL) → Validate (Scope + NF) → Store (TileStore) → Materialize (Shadow Canvas)
                                ↓
                           Address (ADDR)
                                ↓
                         Identity (PF16)
                                ↓
                      Discover / Project / Sync
```

---

# 1) Repo / package layout

Add 3 focused packages:

```
packages/
  addr/         # ADDR.v1 implementation
  nf/           # NF.v1 normalization + equivalence
  pf16/         # PF16.v1 typed identity + composition
```

And integrate into:

- `protocol/` (types for expressions)
- `tilestore/` (RID object store)
- `shadow-canvas/` (normalized state output)
- `server/` (apply rules on ingestion + expose endpoints)
- `client/` (consume normalized outputs, no authority mutation)

---

# 2) Data models (minimum)

## 2.1 Canonical HashRef

Use one string type:

- `sha256:<hex>` (or blake3 later)

Rules:

- hash MUST be computed on **canonical bytes**.

## 2.2 Required IDs

- **RID**: immutable content ID (objects/events/segments/snapshots)
- **SID**: structural pointer ID (HD-path derived)
- **TID**: tile id (z/x/y string)
- Optional: **AID** actor id, **FID** federation id (derived from PF16 hashes)

---

# 3) ADDR.v1 — how to implement

## 3.1 Canonical bytes

You must produce stable bytes for hashing.

### Canonical JSON rule (do this everywhere you hash)

- sort object keys lexicographically
- arrays keep order
- numbers must be emitted consistently (no trailing “.0” drift)
- UTF-8 encode

Implementation options:

- implement a tiny “stable stringify” function (no deps)
- or use a canonical JSON standard (RFC 8785) later

**MVP**: stable stringify with sorted keys.

## 3.2 RID generation

### RID for a blob

```
RID = sha256(bytes)
```

### RID for an event

Use canonical JSON bytes of the event line (after NF event normalization of field ordering).

Recommendation:

- compute RID from the **exact stored JSONL line bytes** to avoid mismatch.

## 3.3 TID generation

Keep TID as a readable string:

- `z{z}/x{x}/y{y}`

Where z may represent zoom/level/space partition.

Optional anchors:

- store geo anchors as events or separate mapping file; do not alter TID identity.

## 3.4 SID (HD-path pointer)

Define canonical path:

```
m/world/<space_id>/tiles/<tid>/<role>
```

Roles to start:

- `head` (points to current tip RID or tip segment RID)
- `index` (points to current index RID)
- `manifest` (points to manifest RID)
- `snapshot/<event_id>` (points to snapshot RID)

Then:

```
SID = sha256( canonical_path_utf8 )
```

Store SID → RID mapping as a **pointer record** (mutable):

```
pointers/<sid>.json
{ "sid": "...", "path": "...", "points_to": "sha256:..." }
```

If you want pure content-addressing only:

- pointer records can also be content-addressed, but you need a “latest pointer” file. Keep it simple: a mutable pointer file is fine.

## 3.5 Ordering rule (for hashing multiple inputs)

When hashing a list of items, sort them deterministically:

- by type tag
- then timestamp (if present)
- then RID lexicographic

Implement helper:

```ts
sortInputs([{type, ts?, rid}...])
```

---

# 4) NF.v1 — how to implement

NF is applied at 3 levels:

1. event normalization
2. state normalization
3. equivalence checks

## 4.1 NF event normalization

### Normalize event JSON

- enforce required fields
- ensure `preserves_invariants` includes root set
- order keys (stable)
- strip irrelevant view-only fields if they would affect hashing (optional)

### Deterministic ordering for application

Even if events arrive in different orders, NF defines application order:

1. topological by `previous_events` where available
2. then `timestamp`
3. then `event_id`

Practical MVP:

- If most events are linear per tile, you can skip full topo sort and rely on timestamp + event_id.
- If merges exist, do topo ordering when replaying a range.

## 4.2 NF state normalization

After building shadow state:

- tombstones retained
- properties reduced to LWW per key
- links reduced to OR-set (see below)
- node lists sorted by node_id for serialization
- links sorted by `(relation,to)` for serialization

### OR-set for links (simple version)

Represent each link as a tagged record:

- add event creates: `link_add {tag = event_id}`
- unlink removes by matching relation/to (MVP) OR by tag (better)

MVP:

- unlink removes all matching relation/to. Better:
- unlink includes `remove_tags[]`.

## 4.3 Equivalence checks

Provide:

### `nf_hash_state(state) -> HashRef`

Hash canonical JSON of normalized state.

### `nf_hash_trace(events[]) -> HashRef`

Hash canonical JSONL or canonical concatenation of event RIDs (sorted per NF).

Then:

- two states equivalent if nf_hash_state matches
- two traces equivalent if nf_hash_trace matches (under the same normalization)

---

# 5) PF16.v1 — how to implement

PF16 is a typed identity, not numerology. It’s a deterministic composition system.

## 5.1 Define the 16 slots (typed)

Make this a real TypeScript type:

- each slot has a name and schema
- each slot has a merge function
- slots are stored as an ordered array for hashing

Example (MVP slots):

1. self
2. authority
3. scope
4. boundary
5. location
6. time
7. relation
8. intent
9. source
10. witness
11. projection
12. derivation
13. version
14. federation
15. policy_nonce

You can rename later but keep the ordering stable for v1.

## 5.2 Slot merge laws (practical)

Here are sensible deterministic merge rules:

- **self**: must match or conflict
- **authority**: `source` overrides `derived` unless scope forbids
- **scope**: intersection (public ∩ team = team, etc.) or “stricter wins”
- **boundary**: stricter wins: exterior > boundary > interior (or your chosen order)
- **location**: if both absolute geo, merge as bounding region; if relative, union observations
- **time**: max timestamp
- **relation**: union set (sorted)
- **intent**: union list (sorted, dedup)
- **source**: union set of actor IDs
- **witness**: union set of witness hashes (may be private)
- **projection**: keep list, but non-authoritative
- **derivation**: record derivation chain hashes
- **version**: bump to max + deterministic increment if conflict
- **federation**: union of federation members
- **policy_nonce**: deterministic hash of (policy + entropy) so composition is stable

Conflicts should never be hidden; represent them as:

```json
{ "conflict": { "a": ..., "b": ... } }
```

## 5.3 PF16 hash

Compute:

```
PF16_HASH = sha256(canonical_bytes(pf16_struct))
```

Use as:

- peer identity fingerprint
- federation membership object
- signature context (later)

---

# 6) Integrations: where each law runs

## 6.1 Server ingestion (authoritative)

On `POST /append_events`:

1. validate envelope
2. validate scope via dotfiles
3. normalize event (NF)
4. compute RID for event bytes (ADDR)
5. append to tile segment buffer
6. when flushing segment:
    - store segment blob → RID
    - update manifest/index pointers (SID -> RID optional)
7. update discovery advertisements (tip changed)
8. optionally update PF16 identity for actor/federation state

## 6.2 Client (non-authoritative)

Client:

- builds local PF16 for its actor identity (self + scope + intent)
- emits events signed later (optional)
- consumes only normalized state from server or from replay

Client should not be deciding global equivalence; it can compute nf_hash locally to detect divergence.

## 6.3 Worker / WASM projectors

WASM projectors implement:

- stream ops over events
- compute derived projections
- output derived events with `authority: derived`

---

# 7) Discovery Graph implementation

Implement a tiny store:

- key: SID or tile_id
- value: list of peers + last_tip + last_seen + confidence

Discovery messages:

- `advertise_tip(space,tile,tip_event,tip_segment)`
- `who_has(space,tile)`
- `i_have(peer,space,tile,tip...)`
- optional: `want_segments_since(after_event)` routing request

This is tiny enough for ESP32:

- fixed-size ring buffer
- LRU eviction
- store only recent tiles/peers

---

# 8) Concrete modules you should implement

## 8.1 `packages/addr`

Functions:

- `canonicalizeJson(value) -> string`
- `hashBytes(bytes) -> HashRef`
- `ridFromEventLine(lineBytes) -> HashRef`
- `sidFromPath(pathString) -> HashRef`
- `makeHdPath(space, tid, role) -> string`

## 8.2 `packages/nf`

Functions:

- `normalizeEvent(event) -> event`
- `orderEvents(events) -> events`
- `normalizeState(tileState) -> normalized`
- `stateHash(normalizedState) -> HashRef`
- `traceHash(orderedEvents or orderedRIDs) -> HashRef`
- `equivalentStates(a,b) -> boolean`

## 8.3 `packages/pf16`

Functions:

- `pf16Create(seed) -> PF16`
- `pf16Merge(a,b) -> PF16`
- `pf16Hash(pf16) -> HashRef`
- `pf16ConflictDetect(pf16) -> list`

---

# 9) Test plan (must-have)

## ADDR tests

- same JSON object with different key order → same hash
- same event line bytes → same RID
- same HD path string → same SID

## NF tests

- events reordered → same state hash after normalization
- repeated no-op updates → same normal form
- link add/remove sequences deterministic

## PF16 tests

- merge is associative where intended (or flags conflict deterministically)
- merge order independence for commutative slots (sets)
- conflicts preserved, not erased
- PF16 hash stable under canonicalization

## End-to-end tests

- two peers produce same final state via different event arrival order
- offline edits merge with same nf_hash
- discovery graph routes to correct peer given tips

---

# 10) Practical build sequence (do this in order)

1. Implement `addr` canonical JSON + RID/SID
2. Implement `nf` normalize + state hashing
3. Implement `pf16` typed structure + merge + hash
4. Wire server ingestion:
    - normalize → RID → store segments
5. Add snapshot creation:
    - every N events or N seconds per tile
6. Add discovery gossip:
    - advertise tile tips periodically
7. Add worker execution:
    - WASM projectors reading event stream and outputting derived events

---

# 11) Minimal “ready to ship” UX

Once you have the above:

- `mv-init` creates world + dotfiles + demo space
- `mv-host` runs server
- `mv-client` opens client
- `mv-nf` prints nf_hashes for tiles (debug)
- `mv-addr` prints RID/SID for objects/paths
- `mv-id` prints PF16 hash + federation summary

---

# 12) Implementation notes to prevent drift

- **Never** allow rules to emit authoritative events unless scope explicitly grants it.
- Keep NF rules tiny and stable. Add features by projection, not by rewriting NF.
- Keep ADDR canonicalization strict. Hash instability will kill federation.
- Keep PF16 typed and explicit. No “slot means whatever today.”

---

Below are **drop-in TypeScript packages** (no runtime deps beyond Node’s built-ins) for:

- `packages/addr` (ADDR.v1)
- `packages/nf` (NF.v1)
- `packages/pf16` (PF16.v1)
- plus an updated `apps/server` endpoint `POST /append_events` that uses them.

I’m assuming a monorepo where `@metaverse-kit/*` resolves locally (or you can switch to relative imports).

---

## `packages/addr/package.json`

```json
{
  "name": "@metaverse-kit/addr",
  "version": "0.1.0",
  "type": "module",
  "main": "dist/index.js",
  "types": "dist/index.d.ts",
  "scripts": {
    "build": "tsc -p tsconfig.json"
  }
}
```

## `packages/addr/tsconfig.json`

```json
{
  "extends": "../../tsconfig.json",
  "compilerOptions": {
    "outDir": "dist"
  },
  "include": ["src"]
}
```

## `packages/addr/src/index.ts`

```ts
import { createHash } from "crypto";

export type HashAlgo = "sha256";
export type HashRef = `${HashAlgo}:${string}`;

/**
 * Deterministic JSON canonicalization (MVP).
 * - Object keys sorted lexicographically
 * - Arrays preserved in order
 * - Numbers emitted via JSON.stringify (beware NaN/Infinity not allowed)
 * - UTF-8 encoding for bytes
 *
 * NOTE: This is not full RFC 8785 (JCS), but stable for typical JSON data.
 */
export function stableStringify(value: unknown): string {
  return stringifyInner(value);

  function stringifyInner(v: unknown): string {
    if (v === null) return "null";
    const t = typeof v;

    if (t === "string") return JSON.stringify(v);
    if (t === "number") {
      if (!Number.isFinite(v as number)) throw new Error("Non-finite number in canonical JSON");
      // JSON.stringify ensures stable formatting for finite numbers
      return JSON.stringify(v);
    }
    if (t === "boolean") return v ? "true" : "false";
    if (t === "bigint") throw new Error("bigint not allowed in JSON canonicalization");

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

    // functions/symbol/undefined are not valid JSON values
    throw new Error(`Unsupported type in canonical JSON: ${t}`);
  }
}

export function hashBytes(bytes: Buffer, algo: HashAlgo = "sha256"): HashRef {
  const hex = createHash(algo).update(bytes).digest("hex");
  return `${algo}:${hex}`;
}

export function hashUtf8(s: string, algo: HashAlgo = "sha256"): HashRef {
  return hashBytes(Buffer.from(s, "utf8"), algo);
}

/** RID for an already-materialized stored line (recommended). */
export function ridFromStoredLine(lineBytes: Buffer, algo: HashAlgo = "sha256"): HashRef {
  return hashBytes(lineBytes, algo);
}

/** RID from a JSON value by canonical JSON bytes. */
export function ridFromJson(value: unknown, algo: HashAlgo = "sha256"): HashRef {
  const canonical = stableStringify(value);
  return hashUtf8(canonical, algo);
}

/** Canonical HD path (SID input). */
export function makeHdPath(spaceId: string, tid: string, role: string): string {
  // role examples: "head", "index", "manifest", `snapshot/${eventId}`
  // You can extend this later but keep stable for v1.
  return `m/world/${spaceId}/tiles/${tid}/${role}`;
}

/** SID derived from canonical HD path. */
export function sidFromPath(pathString: string, algo: HashAlgo = "sha256"): HashRef {
  return hashUtf8(pathString, algo);
}

/** Deterministic ordering helper for hashing multiple inputs. */
export type OrderedInput = { type: string; ts?: number; rid: HashRef };

export function sortInputs(inputs: OrderedInput[]): OrderedInput[] {
  return [...inputs].sort((a, b) => {
    if (a.type !== b.type) return a.type.localeCompare(b.type);
    const ta = a.ts ?? 0;
    const tb = b.ts ?? 0;
    if (ta !== tb) return ta - tb;
    return a.rid.localeCompare(b.rid);
  });
}

/** Hash a list of ordered inputs deterministically. */
export function hashOrderedInputs(inputs: OrderedInput[], algo: HashAlgo = "sha256"): HashRef {
  const ordered = sortInputs(inputs);
  const canonical = stableStringify(
    ordered.map((x) => ({ type: x.type, ts: x.ts ?? null, rid: x.rid }))
  );
  return hashUtf8(canonical, algo);
}
```

---

## `packages/nf/package.json`

```json
{
  "name": "@metaverse-kit/nf",
  "version": "0.1.0",
  "type": "module",
  "main": "dist/index.js",
  "types": "dist/index.d.ts",
  "scripts": {
    "build": "tsc -p tsconfig.json"
  }
}
```

## `packages/nf/tsconfig.json`

```json
{
  "extends": "../../tsconfig.json",
  "compilerOptions": {
    "outDir": "dist"
  },
  "include": ["src"]
}
```

## `packages/nf/src/index.ts`

```ts
import { stableStringify, hashUtf8, type HashRef } from "@metaverse-kit/addr";
import type { WorldEvent } from "@metaverse-kit/protocol/types";

export type Invariant =
  | "adjacency"
  | "exclusion"
  | "consistency"
  | "boundary_discipline"
  | "authority_nontransfer";

export const ROOT_INVARIANTS: Invariant[] = [
  "adjacency",
  "exclusion",
  "consistency",
  "boundary_discipline",
  "authority_nontransfer",
];

/** Minimal event normalization:
 * - ensures preserves_invariants includes ROOT_INVARIANTS
 * - removes undefined fields (stableStringify already omits undefined)
 * - does NOT rewrite event_id/timestamp, etc.
 */
export function normalizeEvent<T extends WorldEvent>(ev: T): T {
  const set = new Set((ev as any).preserves_invariants ?? []);
  for (const inv of ROOT_INVARIANTS) set.add(inv);
  (ev as any).preserves_invariants = Array.from(set).sort();
  return ev;
}

/** Deterministic ordering for application (MVP):
 * - timestamp ascending
 * - event_id ascending
 *
 * NOTE: This is enough for mostly-linear per-tile. If you rely heavily on merges,
 * add topo ordering using previous_events as a DAG.
 */
export function orderEventsDeterministic(events: WorldEvent[]): WorldEvent[] {
  return [...events].sort((a, b) => {
    if (a.timestamp !== b.timestamp) return a.timestamp - b.timestamp;
    return a.event_id.localeCompare(b.event_id);
  });
}

/** Remove obvious no-ops (MVP).
 * Keep this conservative to avoid accidental semantic changes.
 */
export function pruneNoOps(events: WorldEvent[]): WorldEvent[] {
  // Example: consecutive update_transform with identical transform for same node
  const out: WorldEvent[] = [];
  let lastTransformByNode = new Map<string, string>();

  for (const ev of events) {
    if (ev.operation === "update_transform") {
      const key = (ev as any).node_id as string;
      const norm = stableStringify((ev as any).transform);
      const prev = lastTransformByNode.get(key);
      if (prev === norm) continue; // no-op
      lastTransformByNode.set(key, norm);
    }
    out.push(ev);
  }
  return out;
}

/** A normalized trace hash: depends on ordered normalized events. */
export function traceHash(events: WorldEvent[]): HashRef {
  const normalized = events.map((e) => normalizeEvent(structuredClone(e)));
  const ordered = orderEventsDeterministic(pruneNoOps(normalized));
  // canonical bytes: canonical JSON array of events
  const canonical = stableStringify(ordered);
  return hashUtf8(canonical);
}

/** ---- State Normal Form (NF) ---- */

export interface NFLink {
  relation: string;
  to: string;
}

export interface NFNode {
  node_id: string;
  kind: string;
  transform: unknown;
  properties: Record<string, unknown>;
  links: NFLink[];
  deleted?: boolean;
}

export interface NFTileState {
  tile_id: string;
  nodes: NFNode[];
}

/** Normalize a materialized tile state:
 * - nodes sorted by node_id
 * - links sorted by (relation,to)
 * - properties keys sorted (via stableStringify on output)
 * - tombstones retained
 */
export function normalizeState(state: NFTileState): NFTileState {
  const nodes = [...state.nodes].map((n) => {
    const links = [...(n.links ?? [])].sort((a, b) => {
      if (a.relation !== b.relation) return a.relation.localeCompare(b.relation);
      return a.to.localeCompare(b.to);
    });
    return {
      node_id: n.node_id,
      kind: n.kind,
      transform: n.transform,
      properties: n.properties ?? {},
      links,
      deleted: n.deleted ? true : undefined,
    } satisfies NFNode;
  });

  nodes.sort((a, b) => a.node_id.localeCompare(b.node_id));
  return { tile_id: state.tile_id, nodes };
}

export function stateHash(state: NFTileState): HashRef {
  const nf = normalizeState(state);
  const canonical = stableStringify(nf);
  return hashUtf8(canonical);
}

export function equivalentStates(a: NFTileState, b: NFTileState): boolean {
  return stateHash(a) === stateHash(b);
}
```

---

## `packages/pf16/package.json`

```json
{
  "name": "@metaverse-kit/pf16",
  "version": "0.1.0",
  "type": "module",
  "main": "dist/index.js",
  "types": "dist/index.d.ts",
  "scripts": {
    "build": "tsc -p tsconfig.json"
  }
}
```

## `packages/pf16/tsconfig.json`

```json
{
  "extends": "../../tsconfig.json",
  "compilerOptions": {
    "outDir": "dist"
  },
  "include": ["src"]
}
```

## `packages/pf16/src/index.ts`

```ts
import { stableStringify, hashUtf8, type HashRef } from "@metaverse-kit/addr";

export type Authority = "source" | "derived";
export type Realm = "personal" | "team" | "public";
export type Boundary = "interior" | "boundary" | "exterior";
export type Policy = "public" | "private" | "redacted";

export type Conflict<T> = { conflict: { a: T; b: T } };

export type SlotValue =
  | null
  | boolean
  | number
  | string
  | Record<string, unknown>
  | Array<unknown>
  | Conflict<unknown>;

export interface PF16 {
  // Keep ordering stable in serialization.
  I0_self: string;                         // stable actor/self id
  I1_authority: Authority;
  I2_scope: { realm: Realm; policy: Policy };
  I3_boundary: Boundary;
  I4_location: null | { geo?: any; rel?: any }; // geojson-ish + relative observations
  I5_time: number;                         // max timestamp seen
  I6_relation: string[];                   // sorted set
  I7_intent: string[];                     // sorted set
  I8_source: string[];                     // sorted set of actor ids
  I9_witness: string[];                    // sorted set of witness hashes (may be empty)
  I10_projection: string[];                // sorted set (non-authoritative)
  I11_derivation: string[];                // sorted set of derivation hashes
  I12_version: string;                     // semantic version string or build id
  I13_federation: string[];                // sorted set of federation member ids
  I14_policy: { realm: Realm; policy: Policy; boundary: Boundary };
  I15_nonce: string;                       // entropy / nonce
}

export function pf16Create(seed: Partial<PF16> & Pick<PF16, "I0_self">): PF16 {
  return normalizePF16({
    I0_self: seed.I0_self,
    I1_authority: seed.I1_authority ?? "source",
    I2_scope: seed.I2_scope ?? { realm: "personal", policy: "private" },
    I3_boundary: seed.I3_boundary ?? "interior",
    I4_location: seed.I4_location ?? null,
    I5_time: seed.I5_time ?? 0,
    I6_relation: seed.I6_relation ?? [],
    I7_intent: seed.I7_intent ?? [],
    I8_source: seed.I8_source ?? [seed.I0_self],
    I9_witness: seed.I9_witness ?? [],
    I10_projection: seed.I10_projection ?? [],
    I11_derivation: seed.I11_derivation ?? [],
    I12_version: seed.I12_version ?? "v1",
    I13_federation: seed.I13_federation ?? [],
    I14_policy: seed.I14_policy ?? { realm: "personal", policy: "private", boundary: "interior" },
    I15_nonce: seed.I15_nonce ?? "",
  });
}

function uniqSorted(xs: string[]): string[] {
  return Array.from(new Set(xs)).sort();
}

function stricterBoundary(a: Boundary, b: Boundary): Boundary {
  // stricter wins: exterior > boundary > interior
  const rank = (x: Boundary) => (x === "exterior" ? 3 : x === "boundary" ? 2 : 1);
  return rank(a) >= rank(b) ? a : b;
}

function stricterRealm(a: Realm, b: Realm): Realm {
  // stricter wins: personal > team > public
  const rank = (x: Realm) => (x === "personal" ? 3 : x === "team" ? 2 : 1);
  return rank(a) >= rank(b) ? a : b;
}

function stricterPolicy(a: Policy, b: Policy): Policy {
  // stricter wins: private > redacted > public (you can swap private/redacted if preferred)
  const rank = (x: Policy) => (x === "private" ? 3 : x === "redacted" ? 2 : 1);
  return rank(a) >= rank(b) ? a : b;
}

function mergeAuthority(a: Authority, b: Authority): Authority {
  // source dominates derived
  return a === "source" || b === "source" ? "source" : "derived";
}

function conflict<T>(a: T, b: T): Conflict<T> {
  return { conflict: { a, b } };
}

export function pf16Merge(a: PF16, b: PF16): PF16 {
  // Self must match; otherwise conflict (caller can choose to reject)
  const I0_self =
    a.I0_self === b.I0_self ? a.I0_self : (stableStringify(conflict(a.I0_self, b.I0_self)) as any);

  const I1_authority = mergeAuthority(a.I1_authority, b.I1_authority);

  const realm = stricterRealm(a.I2_scope.realm, b.I2_scope.realm);
  const policy = stricterPolicy(a.I2_scope.policy, b.I2_scope.policy);

  const I2_scope = { realm, policy };

  const I3_boundary = stricterBoundary(a.I3_boundary, b.I3_boundary);

  // Location: merge hints (simple union structure)
  const I4_location =
    a.I4_location === null ? b.I4_location
    : b.I4_location === null ? a.I4_location
    : { geo: mergeObjects((a.I4_location as any).geo, (b.I4_location as any).geo),
        rel: mergeObjects((a.I4_location as any).rel, (b.I4_location as any).rel) };

  const I5_time = Math.max(a.I5_time, b.I5_time);

  const I6_relation = uniqSorted([...a.I6_relation, ...b.I6_relation]);
  const I7_intent = uniqSorted([...a.I7_intent, ...b.I7_intent]);
  const I8_source = uniqSorted([...a.I8_source, ...b.I8_source]);
  const I9_witness = uniqSorted([...a.I9_witness, ...b.I9_witness]);
  const I10_projection = uniqSorted([...a.I10_projection, ...b.I10_projection]);
  const I11_derivation = uniqSorted([...a.I11_derivation, ...b.I11_derivation]);

  const I12_version = a.I12_version === b.I12_version ? a.I12_version : `merge(${a.I12_version},${b.I12_version})`;

  const I13_federation = uniqSorted([...a.I13_federation, ...b.I13_federation]);

  const I14_policy = {
    realm: stricterRealm(a.I14_policy.realm, b.I14_policy.realm),
    policy: stricterPolicy(a.I14_policy.policy, b.I14_policy.policy),
    boundary: stricterBoundary(a.I14_policy.boundary, b.I14_policy.boundary),
  };

  // Nonce: deterministic combine (not random at merge time)
  const I15_nonce = hashUtf8(stableStringify([a.I15_nonce, b.I15_nonce])).split(":")[1];

  return normalizePF16({
    I0_self,
    I1_authority,
    I2_scope,
    I3_boundary,
    I4_location,
    I5_time,
    I6_relation,
    I7_intent,
    I8_source,
    I9_witness,
    I10_projection,
    I11_derivation,
    I12_version,
    I13_federation,
    I14_policy,
    I15_nonce,
  });
}

function mergeObjects(a: any, b: any): any {
  if (a == null) return b ?? null;
  if (b == null) return a ?? null;
  if (typeof a !== "object" || typeof b !== "object") return conflict(a, b);
  if (Array.isArray(a) || Array.isArray(b)) return conflict(a, b);
  const out: Record<string, unknown> = {};
  const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
  for (const k of Array.from(keys).sort()) {
    if (!(k in a)) out[k] = b[k];
    else if (!(k in b)) out[k] = a[k];
    else out[k] = stableStringify(a[k]) === stableStringify(b[k]) ? a[k] : conflict(a[k], b[k]);
  }
  return out;
}

export function normalizePF16(p: PF16): PF16 {
  return {
    ...p,
    I6_relation: uniqSorted(p.I6_relation ?? []),
    I7_intent: uniqSorted(p.I7_intent ?? []),
    I8_source: uniqSorted(p.I8_source ?? []),
    I9_witness: uniqSorted(p.I9_witness ?? []),
    I10_projection: uniqSorted(p.I10_projection ?? []),
    I11_derivation: uniqSorted(p.I11_derivation ?? []),
    I13_federation: uniqSorted(p.I13_federation ?? []),
  };
}

export function pf16Hash(p: PF16): HashRef {
  // Stable bytes of typed struct
  const canonical = stableStringify(p);
  return hashUtf8(canonical);
}

export function pf16HasConflicts(p: PF16): boolean {
  const s = stableStringify(p);
  return s.includes("\"conflict\":");
}
```

---

## `apps/server/src/server.ts` (updated with `POST /append_events`)

This extends the earlier server you had. It:

- validates + normalizes events
- routes by tile
- appends events to a new segment (simple MVP: each append call becomes its own segment)
- updates manifest/index via TileStore

```ts
import http from "http";
import url from "url";

import { TileStore } from "@metaverse-kit/tilestore";
import { validateWorldEvent } from "@metaverse-kit/protocol/validate";
import { normalizeEvent } from "@metaverse-kit/nf";

const store = new TileStore({ rootDir: process.env.WORLD || "./world" });

function json(res: http.ServerResponse, obj: unknown, code = 200) {
  res.writeHead(code, { "Content-Type": "application/json" });
  res.end(JSON.stringify(obj));
}

async function readBody(req: http.IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", (d) => (body += d));
    req.on("end", () => resolve(body));
    req.on("error", reject);
  });
}

const server = http.createServer(async (req, res) => {
  const u = url.parse(req.url || "", true);
  if (!u.pathname) return json(res, { error: "no path" }, 404);

  // --- Existing endpoints ---
  if (u.pathname === "/tile_tip" && req.method === "GET") {
    const { space_id, tile_id } = u.query as any;
    const tip = await store.getTileTip(space_id, tile_id);
    return json(res, tip ?? { error: "not found" }, tip ? 200 : 404);
  }

  if (u.pathname === "/segments_since" && req.method === "POST") {
    const body = await readBody(req);
    const { space_id, tile_id, after_event } = JSON.parse(body);
    const segs = await store.getSegmentsSince(space_id, tile_id, after_event ?? null);
    return json(res, { tile_id, segments: segs });
  }

  if (u.pathname.startsWith("/object/") && req.method === "GET") {
    const hash = decodeURIComponent(u.pathname.split("/").pop()!);
    try {
      const bytes = await store.getObject(hash as any);
      res.writeHead(200);
      return res.end(bytes);
    } catch {
      return json(res, { error: "not found" }, 404);
    }
  }

  // --- NEW: append events ---
  if (u.pathname === "/append_events" && req.method === "POST") {
    try {
      const body = await readBody(req);
      const payload = JSON.parse(body);

      const space_id: string = payload.space_id;
      const tile_id: string = payload.tile_id;
      const events: unknown[] = payload.events;

      if (!space_id || !tile_id || !Array.isArray(events)) {
        return json(res, { error: "payload must include space_id, tile_id, events[]" }, 400);
      }

      // Validate + normalize (NF)
      const normalized = events.map((raw) => {
        const ev = validateWorldEvent(raw);
        // enforce routing
        if (ev.space_id !== space_id) throw new Error(`space_id mismatch: ${ev.space_id}`);
        if (ev.tile !== tile_id) throw new Error(`tile mismatch: ${ev.tile}`);
        return normalizeEvent(ev);
      });

      // MVP: each call becomes its own segment
      await store.appendTileEvents(space_id, tile_id, normalized);

      return json(res, { ok: true, appended: normalized.length });
    } catch (e: any) {
      return json(res, { error: String(e?.message ?? e) }, 400);
    }
  }

  return json(res, { error: "unknown route" }, 404);
});

server.listen(8080, () =>
  console.log("Tile Store server running on http://localhost:8080")
);
```

---

## Minimal client-side append example

Once the server has `/append_events`, your client can post events like:

```js
await fetch("/append_events", {
  method: "POST",
  headers: {"Content-Type":"application/json"},
  body: JSON.stringify({
    space_id: "demo",
    tile_id: "z0/x0/y0",
    events: [myEvent1, myEvent2]
  })
});
```

---

## What you should implement next (so this doesn’t stall)

1. **Batching/segment flush policy** (not “one segment per append”)
    - buffer per tile in memory, flush by bytes/time
2. **Snapshots** every N events
    - use `shadow-canvas` builder, then `tilestore.commitSnapshot`
3. **SID pointers**
    - store `SID(head) -> tip_segment RID` in a mutable pointer file
4. **Discovery graph messages**
    - start with “advertise_tip” gossip via UDP/WiFi/BLE later

---

Here’s a **drop-in update** for `packages/tilestore` that adds:

- per-tile in-memory buffering
- periodic/size-based flush to immutable segments
- manifest/index updates
- snapshot hooks (you can wire shadow-canvas later)

This stays file-first and simple.

---

## `packages/tilestore/src/index.ts`

```ts
import fs from "fs/promises";
import path from "path";
import { stableStringify, hashUtf8, type HashRef } from "@metaverse-kit/addr";

export interface TileStoreOpts {
  rootDir: string;
  flushBytes?: number;   // default 256KB
  flushMs?: number;      // default 5s
}

interface BufferedTile {
  space_id: string;
  tile_id: string;
  events: string[];     // JSONL lines (already normalized)
  bytes: number;
  lastFlush: number;
}

export class TileStore {
  root: string;
  flushBytes: number;
  flushMs: number;
  buffers = new Map<string, BufferedTile>();

  constructor(opts: TileStoreOpts) {
    this.root = opts.rootDir;
    this.flushBytes = opts.flushBytes ?? 256 * 1024;
    this.flushMs = opts.flushMs ?? 5000;
    setInterval(() => this.periodicFlush(), 1000);
  }

  key(space: string, tile: string) {
    return `${space}::${tile}`;
  }

  tileDir(space: string, tile: string) {
    return path.join(this.root, space, "tiles", tile);
  }

  async ensureTileDirs(space: string, tile: string) {
    const base = this.tileDir(space, tile);
    await fs.mkdir(path.join(base, "segments"), { recursive: true });
    await fs.mkdir(path.join(base, "snapshots"), { recursive: true });
  }

  async appendTileEvents(space: string, tile: string, events: any[]) {
    await this.ensureTileDirs(space, tile);
    const k = this.key(space, tile);
    let buf = this.buffers.get(k);
    if (!buf) {
      buf = {
        space_id: space,
        tile_id: tile,
        events: [],
        bytes: 0,
        lastFlush: Date.now(),
      };
      this.buffers.set(k, buf);
    }

    for (const ev of events) {
      const line = JSON.stringify(ev);
      buf.events.push(line);
      buf.bytes += Buffer.byteLength(line) + 1;
    }

    if (buf.bytes >= this.flushBytes) {
      await this.flushTile(buf);
    }
  }

  async periodicFlush() {
    const now = Date.now();
    for (const buf of this.buffers.values()) {
      if (buf.events.length === 0) continue;
      if (now - buf.lastFlush >= this.flushMs) {
        await this.flushTile(buf);
      }
    }
  }

  async flushTile(buf: BufferedTile) {
    if (buf.events.length === 0) return;
    const content = buf.events.join("\n") + "\n";
    const hash = hashUtf8(content);
    const [algo, hex] = hash.split(":");
    const segPath = path.join(
      this.tileDir(buf.space_id, buf.tile_id),
      "segments",
      `${hex}.jsonl`
    );
    await fs.writeFile(segPath, content, "utf8");

    // update manifest + index
    await this.updateManifestAndIndex(
      buf.space_id,
      buf.tile_id,
      hash,
      buf.events[0],
      buf.events[buf.events.length - 1]
    );

    buf.events = [];
    buf.bytes = 0;
    buf.lastFlush = Date.now();
  }

  async updateManifestAndIndex(
    space: string,
    tile: string,
    segHash: HashRef,
    firstLine: string,
    lastLine: string
  ) {
    const base = this.tileDir(space, tile);
    const manifestPath = path.join(base, "manifest.json");
    const indexPath = path.join(base, "index.json");

    const firstEv = JSON.parse(firstLine);
    const lastEv = JSON.parse(lastLine);

    let manifest: any = { tile_id: tile, segments: [] };
    try {
      manifest = JSON.parse(await fs.readFile(manifestPath, "utf8"));
    } catch {}

    manifest.segments.push({
      hash: segHash,
      from_event: firstEv.event_id,
      to_event: lastEv.event_id,
      ts: Date.now(),
    });

    await fs.writeFile(manifestPath, stableStringify(manifest));

    const index = {
      tile_id: tile,
      tip_event: lastEv.event_id,
      tip_segment: segHash,
      last_update: Date.now(),
    };

    await fs.writeFile(indexPath, stableStringify(index));
  }

  // ---- Read APIs ----

  async getTileTip(space: string, tile: string) {
    try {
      const idx = JSON.parse(
        await fs.readFile(
          path.join(this.tileDir(space, tile), "index.json"),
          "utf8"
        )
      );
      return idx;
    } catch {
      return null;
    }
  }

  async getSegmentsSince(space: string, tile: string, afterEvent: string | null) {
    const manifestPath = path.join(this.tileDir(space, tile), "manifest.json");
    let manifest: any;
    try {
      manifest = JSON.parse(await fs.readFile(manifestPath, "utf8"));
    } catch {
      return [];
    }

    if (!afterEvent) return manifest.segments;

    const out = [];
    let include = false;
    for (const s of manifest.segments) {
      if (include) out.push(s);
      if (s.to_event === afterEvent) include = true;
    }
    return out;
  }

  async getObject(hash: string): Promise<Buffer> {
    const [, hex] = hash.split(":");
    // search all spaces/tiles (MVP; later index this)
    const spaces = await fs.readdir(this.root);
    for (const sp of spaces) {
      const tilesDir = path.join(this.root, sp, "tiles");
      try {
        const tiles = await fs.readdir(tilesDir);
        for (const t of tiles) {
          const segPath = path.join(tilesDir, t, "segments", `${hex}.jsonl`);
          try {
            return await fs.readFile(segPath);
          } catch {}
        }
      } catch {}
    }
    throw new Error("object not found");
  }
}
```

---

## What this gives you

- Clients can stream events continuously.
- Server buffers per tile.
- Flush happens:
    - when buffer ≥ `flushBytes`
    - or every `flushMs`
- Each flush becomes:
    - one immutable segment file
    - one manifest append
    - one index pointer update

So now you have:

```
append_events → buffer → segment → manifest → index
```

Which is exactly the shape you wanted.

---

## Next natural steps

1. Add snapshotting:

```text
if segments since last snapshot > N
  materialize with shadow-canvas
  write snapshot
  update index
```

2. Add SID pointers:

- map `SID(head)` → index RID
- map `SID(manifest)` → manifest RID

3. Add discovery gossip:

- whenever index changes, advertise: `{space,tile,tip_event,tip_segment}`

At this point you have a real, working, append-only, federatable world engine.


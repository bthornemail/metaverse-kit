Here is a clean, first-cut spec for all three.  
Not mystical. Not loose. Just rules.

---

# NF.v1 — Normal Form Rules

**Purpose:** Decide when two traces, states, or blocks are “the same” under allowed transformations.

## NF.1 — Authority Preservation

Two forms are equivalent only if:

- They have the same authoritative events.
- Any difference is in:
    - order of commutative operations
    - projection-only data
    - derived views

Formal:

```
A ≡ B  iff
  authoritative(A) == authoritative(B)
  and derived(A) may differ
```

---

## NF.2 — Event-Level Normalization

Events are normalized by:

1. Sorting:
    
    - by DAG order
    - then timestamp
    - then event_id lexicographically
2. Removing:
    
    - duplicate no-op updates
    - idempotent replays
3. Canonical field order in JSON/YAML.
    

---

## NF.3 — State-Level Normalization

A tile/state is in normal form when:

- Tombstoned nodes are retained but marked deleted.
- Links are stored as sorted OR-Set entries.
- Properties are reduced by LWW per key.
- Transforms are single-valued per node.

Two states are equal if:

```
normalize(stateA) == normalize(stateB)
```

---

## NF.4 — Projection Irrelevance

Differences in:

- rendering
- layout
- camera
- styling
- view-specific metadata

do NOT affect equivalence.

Truth ≠ appearance.

---

# ADDR.v1 — RID / TID / SID Derivation

**Purpose:** Stable addressing without mysticism.

---

## ADDR.1 — Hash Rule

All base identities are content- or path-derived:

```
H(x) = hash( canonical_bytes(x) )
```

Hash function: sha256 or blake3.

---

## ADDR.2 — Types

### RID — Reality ID (event / object)

```
RID = hash(event_bytes or blob_bytes)
```

Used for:

- events
- segments
- snapshots
- media

Identity = content.

---

### TID — Tile ID

Logical address:

```
TID = "z{z}/x{x}/y{y}"
```

Optional Earth binding:

```
TID + geo_anchor → Earth-relative meaning
```

---

### SID — Structural ID (HD-style path)

Used for navigation, not truth:

```
SID = hash( canonical_path )
canonical_path = "m/world/<space>/tiles/<tid>/<role>"
```

Example:

```
m/world/demo/tiles/z0/x0/y0/head
```

Then:

```
SID = hash("m/world/demo/tiles/z0/x0/y0/head")
```

Rule:

- SID points to RID.
- SID is mutable pointer.
- RID is immutable truth.

---

## ADDR.3 — Ordering Rule

When multiple parents or inputs exist:

```
order = sort by:
  1. type priority
  2. timestamp
  3. RID lexicographically
```

This makes hash derivation deterministic.

---

# PF16.v1 — Identity16 Composition Rule

**Purpose:** Typed identity composition without numerology.

---

## PF16.1 — Identity16 Type

Define:

```
Identity16 = [I0, I1, ..., I15]
```

Where each Ii is a typed role, not a number:

|Slot|Meaning|
|---|---|
|I0|self|
|I1|authority|
|I2|scope|
|I3|boundary|
|I4|location|
|I5|time|
|I6|relation|
|I7|intent|
|I8|source|
|I9|witness|
|I10|projection|
|I11|derivation|
|I12|version|
|I13|federation|
|I14|policy|
|I15|entropy / nonce|

Each Ii is itself a structured value.

---

## PF16.2 — Identity Tuple

An identity instance is:

```
ID = <I0, I1, ..., I15>
```

Not numbers.  
Not vectors.  
Typed slots with meaning.

---

## PF16.3 — Composition Rule

Two identities compose as:

```
IDc = compose(IDa, IDb)
```

Where:

For each slot i:

```
Ic[i] = merge_rule[i]( Ia[i], Ib[i] )
```

Examples:

- self: must match or reject
- authority: higher wins or conflict
- scope: intersect
- boundary: stricter wins
- time: max
- intent: merge list
- federation: union
- version: bump

Each slot has its own merge law.

---

## PF16.4 — Identity Hash

Final identity hash:

```
ID_HASH = hash( canonical_bytes( ID ) )
```

This becomes:

- identity fingerprint
- federation key
- trust anchor

---

## PF16.5 — Federation Rule

Federation is:

```
Federation = set of Identity16
```

Federated identity:

```
FID = compose_all( Identity16[] )
```

With:

- conflicts flagged, not hidden
- merges deterministic
- authority rules applied per slot

---

## Final Summary

- **NF.v1** tells you when two realities are “the same.”
- **ADDR.v1** tells you how to name things without lying.
- **PF16.v1** tells you how identities combine without numerology.

These three together give you:

- stable truth
- stable naming
- stable identity

Everything else is just projection.
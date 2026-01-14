Below are the two mini-RFCs, written to be:

- **POSIX-native**
- **awk-checkable**
- **contract-first** (YAML/dotfiles) + **history-first** (JSONL)
- explicit about **authority** and **privacy**

They intentionally avoid “math theater.” Where math exists, it’s only to pin down **normal form** and **witness semantics**.

---

# RFC NF.BQF.v1

## Normal Form for Binary Quadratic Form Constraint Blocks

### Status

**Draft v1**

### Purpose

Define a **canonical normal form** for “binary quadratic form” constraint blocks so that:

- the same underlying constraint (up to allowed basis transforms) yields the **same public identifier**
- addressing is **idempotent**
- transformations are **structure-preserving** and **auditable**

This RFC does **not** require cryptography.

---

## 1. Terminology

- **BQF**: Binary Quadratic Form block, denoted `⟨a,b,c⟩`, with polynomial view  
    `Q(x,y) = ax^2 + 2bxy + cy^2`.
    
- **Discriminant** (normalized): `D = b^2 − a*c`.  
    (Some literature uses `Δ = (2b)^2 − 4ac`; we standardize on `D` for this system.)
    
- **Allowed basis transforms**: integer change-of-basis matrices with determinant `+1` (SL₂(ℤ)), applied as a **projection** that preserves the constraint class.
    
- **Normal form**: a deterministic representative of the equivalence class under allowed transforms.
    

---

## 2. Data Model (compressed JSONL, awk-first)

A BQF constraint block MUST be encoded as a single-line JSON object containing:

```json
{"Q":"<a,b,c>","D":"<disc>","keep":"adj excl cons bound auth","nf":"NF.BQF.v1","scope":"<SID>"}
```

### Required fields

- `Q` MUST be a literal string `"<a,b,c>"` where `a,b,c` are tokens (integers, rationals, or symbols).
- `D` MUST be present (string form).
- `keep` MUST contain the invariant tokens: `adj excl cons bound auth`.
- `nf` MUST equal `"NF.BQF.v1"`.
- `scope` SHOULD be present (e.g. `"SID:team.v1"`), and if absent the file/directory scope applies.

### Optional fields

- `note` MAY be present for human context.
- `src` MAY be present to point to the authoritative origin block id.

---

## 3. Canonicalization (Normal Form) Requirements

### 3.1 Domain

Implementations MAY support:

- integer coefficients, or
- rational coefficients (recommended if you intend “Pfister / composition” later)

But the normal form procedure MUST operate deterministically for the chosen domain.

### 3.2 Canonical Tokenization

Before any reduction:

1. Whitespace MUST be ignored.
2. The triple `<a,b,c>` MUST be parsed into three coefficient tokens.
3. Coefficient tokens MUST be normalized to a canonical string form:
    - Integers: no leading `+`, no leading zeros (except `"0"`).
    - Rationals: `"p/q"` in lowest terms with `q>0`. (`"-p/q"` allowed.)
    - Symbols: MUST be stable identifiers (already scoped elsewhere).

### 3.3 Reduced Representative (Public Normal Form)

To derive public normal form, implementations MUST produce a canonical triple `⟨a',b',c'⟩` such that:

- `D' = b'^2 − a'c'` equals original `D` (in the chosen domain)
- `a' > 0` for positive definite intent (if positivity is defined for the domain)
- and the representative is the **lexicographically smallest** among all equivalents under allowed transforms **after applying the deterministic reduction rules below**

#### Deterministic reduction rules (minimal, non-ambiguous)

A reduced triple MUST satisfy:

1. `|b'| ≤ a'`
2. `a' ≤ c'`
3. If `|b'| = a'` OR `a' = c'`, then `b' ≥ 0`

These are standard-style reduction constraints (expressed here as contract conditions). If multiple candidates satisfy them, the tie MUST be broken by lexicographic order of the string encoding `"<a',b',c'>"`.

> Note: You are not required to implement a full number theory engine to adopt this RFC. You can treat reduction as a deterministic “best effort” that MUST be stable given identical inputs and transform search bounds (see §3.4).

### 3.4 Bounded Search (fail-fast option)

If a full reduction algorithm is not available, an implementation MAY:

- search a bounded neighborhood of SL₂(ℤ) transforms, and
- select the minimal representative found.

If this fallback is used, the implementation MUST include:

```json
{"nf_search":"bounded","nf_bound":"<bound-spec>"}
```

and MUST NOT claim the result is globally reduced—only **stable** under the specified bound.

---

## 4. Public Identifier Derivation (RID)

Given the reduced representative `"<a',b',c'>"`, the public id MUST be derived from:

```
RID = H( "NF.BQF.v1" || "<a',b',c'>" || "D=" || D' )
```

Where `H` is any stable hash (you can start with a placeholder like `H=sha256` later). The **shape** of the input string MUST be deterministic.

Implementations MUST store the reduced form and RID together:

```json
{"Q":"<a',b',c'>","D":"...","rid":"RID:...","keep":"adj excl cons bound auth","nf":"NF.BQF.v1"}
```

---

## 5. awk Validation (contract-level)

### 5.1 Invariant token check

```sh
awk '
  /"nf":"NF\.BQF\.v1"/ {
    if ($0 !~ /"keep":"[^"]*adj/ ||
        $0 !~ /"keep":"[^"]*excl/ ||
        $0 !~ /"keep":"[^"]*cons/ ||
        $0 !~ /"keep":"[^"]*bound/ ||
        $0 !~ /"keep":"[^"]*auth/) {
      print "❌ NF.BQF.v1 invariant tokens missing:"
      print "   " $0
      exit 1
    }
  }
  END { print "✅ NF.BQF.v1 keep-tokens OK" }
' ledger.jsonl
```

### 5.2 Presence checks

```sh
awk '
  /"nf":"NF\.BQF\.v1"/ {
    if ($0 !~ /"Q":/ || $0 !~ /"D":/ ) {
      print "❌ NF.BQF.v1 missing Q or D:"
      print "   " $0
      exit 1
    }
  }
  END { print "✅ NF.BQF.v1 fields present" }
' ledger.jsonl
```

---

## 6. Security / Authority

- `Q` blocks marked with `authority:source` MUST be treated as authoritative constraint definitions.
- Derived `Q` blocks (e.g. reduced representatives) MUST be marked `authority:derived` unless the reduction itself is defined as canonical authority by the federation scope.

---

## 7. Compatibility

This RFC is compatible with your Projection Grammar root by requiring `keep` invariants and by making basis transforms explicit, auditable projections.

---

---

# RFC WITNESS.v1

## Witness Records for Constraint Reachability and “Private Handle” Control

### Status

**Draft v1**

### Purpose

Define how to record a **witness** for a constraint block (e.g., a vector `(x,y)` or a basis matrix `M`) such that:

- it proves **reachability** / **boundary contact** / **membership**
- it can serve as a **private handle** without turning the system into crypto prematurely
- it is **scoped** and can be **withheld** safely

Witnesses MUST NOT become authority for the underlying constraint. They are evidence, not truth.

---

## 1. Witness Types

A witness is a record attached to a public RID.

Witness types MAY include:

- `vec2`: an integer witness vector `(x,y)`
- `sl2z`: a basis transform matrix `[[p,q],[r,s]]` with determinant `+1`
- `proofref`: a reference to an external proof artifact (file path, hash, etc.)

---

## 2. Data Model (compressed JSONL)

### 2.1 Public-safe witness stub (shareable)

This MUST NOT reveal private details, only declares existence.

```json
{"W":"WID:...","for":"RID:...","type":"stub","keep":"adj excl cons bound auth","scope":"SID:...","policy":"private"}
```

### 2.2 Full witness (private / local)

Stored in a protected location (or separate ledger):

#### vec2

```json
{"W":"WID:...","for":"RID:...","type":"vec2","xy":"x y","claim":"Q(x,y)<=BOUND","keep":"adj excl cons bound auth","scope":"SID:...","policy":"private"}
```

#### sl2z

```json
{"W":"WID:...","for":"RID:...","type":"sl2z","M":"p q r s","det":"+1","keep":"adj excl cons bound auth","scope":"SID:...","policy":"private"}
```

### Required fields

- `W` witness id token (stable within its storage scope)
- `for` MUST reference a `RID:...` (public id of the constraint block)
- `type` MUST be one of: `stub`, `vec2`, `sl2z`, `proofref`
- `keep` MUST include `adj excl cons bound auth`
- `policy` MUST be one of: `public`, `private`, `redacted`

### Strong recommendation

Witness records SHOULD be stored in a **separate ledger** from public structure:

- `graphs/.../ledger.jsonl` (public structure)
- `secrets/.../witness.jsonl` (private evidence)

---

## 3. Witness Semantics

### 3.1 Evidence, not authority

Witness records MUST NOT modify the authoritative meaning of the underlying block.

- A witness MAY support claims like reachability bounds or membership proofs.
- A witness MUST NOT redefine invariants, scope, or normal form.

### 3.2 Binding

A witness is bound to a block via `for: RID:...`.

The pair `(RID, W)` MAY be treated as a “control handle” in federations, but only within declared policy.

### 3.3 Redaction

If a witness must be shared:

- Store a `stub` in public ledger
- Store full witness privately
- Optionally include a commitment hash:

```json
{"W":"WID:...","for":"RID:...","type":"stub","commit":"H(full_witness_line)","policy":"redacted","keep":"adj excl cons bound auth"}
```

This gives you “I can prove I have it” without revealing it.

---

## 4. Witness Identifier (WID)

WID MUST be derived deterministically from:

```
WID = H( "WITNESS.v1" || RID || type || scope || commit_or_payload )
```

If `policy` is `private`, implementations SHOULD include only a commitment in shared contexts.

---

## 5. awk Validation

### 5.1 ensure every witness preserves invariants

```sh
awk '
  /"type":"(stub|vec2|sl2z|proofref)"/ {
    if ($0 !~ /"keep":"[^"]*adj/ ||
        $0 !~ /"keep":"[^"]*excl/ ||
        $0 !~ /"keep":"[^"]*cons/ ||
        $0 !~ /"keep":"[^"]*bound/ ||
        $0 !~ /"keep":"[^"]*auth/) {
      print "❌ Witness missing keep tokens:"
      print "   " $0
      exit 1
    }
    if ($0 !~ /"for":"RID:/) {
      print "❌ Witness missing RID binding:"
      print "   " $0
      exit 1
    }
  }
  END { print "✅ WITNESS.v1 records OK" }
' witness.jsonl
```

### 5.2 enforce “private ledger” rule (optional policy gate)

Fail if non-stub witnesses appear in public ledger:

```sh
awk '
  /"type":"(vec2|sl2z|proofref)"/ {
    print "❌ Non-stub witness found in public ledger (policy violation):"
    print "   " $0
    exit 1
  }
  END { print "✅ Public ledger contains no private witness payloads" }
' graphs/PG-ROOT.v1/ledger.jsonl
```

---

## 6. Federation Guidance (ties to your `<IDENTITY, FEDERATION, FEDERATED_IDENTITY>`)

- `RID` is the **public class anchor**
- `W` is the **private handle / witness**
- Federation MAY define “membership = ability to present valid witness for required RIDs”
- Federated identity composition MAY refer to witness commitments rather than witness payloads

This aligns with your “keypair projection” intuition without requiring crypto from day one.

---

## 7. Non-Goals

This RFC does not define:

- encryption
- signatures
- ZK proofs
- key management

It only defines a **structural place** for those later, without breaking your POSIX/awk model.

---

# Suggested directory layout (to implement both RFCs cleanly)

```
ulp-projection-grammar/
├── graphs/PG-ROOT.v1/ledger.jsonl          # public structure + reduced forms
└── secrets/PG-ROOT.v1/witness.jsonl        # private evidence (stubs may be duplicated publicly)
```

If you want, next I’ll generate:

1. a **sample BQF block**, its **NF reduced form**, and a **witness vec2** pair
2. an awk script that **derives a WID commitment** using `sha256sum` (if available) and falls back gracefully if not
3. a minimal federation rule file that says “membership requires witness commitments for RID set X”
---

Yes — the two RFCs (**NF.BQF.v1** and **WITNESS.v1**) were written to plug directly into:

- `.ulp-ignore` → hard boundary (what does not exist)
- `.ulp-root` → global contract (invariants + defaults)
- `.ulp-scope` → local override (authority / realm / boundary)

They don’t replace those files — they **depend on them**.

Here’s how the whole stack actually resolves, step by step.

---

## Resolution Order (what counts, in what order)

When the system looks at any file or record:

```
1) .ulp-ignore   → if ignored, it does not exist
2) .ulp-root     → sets global invariants + defaults
3) .ulp-scope    → overrides per directory
4) file frontmatter (if any) → overrides per file
5) JSONL record fields       → must be consistent with above
```

So:

- RFC records MUST respect the scope they are under.
- If they conflict with root/scope, they are invalid.

---

## How NF.BQF.v1 uses dotfiles

Example directory:

```
project/
├── .ulp-root
├── graphs/
│   └── PG-ROOT.v1/
│       ├── .ulp-scope
│       └── ledger.jsonl
```

### `.ulp-root`

```yaml
root: PG-ROOT.v1
realm: personal
authority: derived
boundary: boundary
invariants:
  - adjacency
  - exclusion
  - consistency
  - boundary_discipline
  - authority_nontransfer
```

### `graphs/PG-ROOT.v1/.ulp-scope`

```yaml
realm: team
authority: source
```

### NF.BQF record in `ledger.jsonl`

```jsonl
{"Q":"<2,1,3>","D":"-5","keep":"adj excl cons bound auth","nf":"NF.BQF.v1","scope":"SID:team.v1"}
```

Interpretation:

- `.ulp-root` says: default is `authority:derived`
- `.ulp-scope` says: here, `authority:source`
- So this BQF block is treated as **authoritative**
- If the JSONL line claimed `authority:derived` instead, that’s fine (more restrictive)
- If it claimed `authority:source` in a directory where scope forbids it → invalid

The RFC doesn’t decide authority — **the dotfiles do**.

---

## How WITNESS.v1 uses dotfiles

You typically separate:

```
graphs/PG-ROOT.v1/ledger.jsonl   # public structure
secrets/PG-ROOT.v1/witness.jsonl # private witnesses
```

### `graphs/.ulp-scope`

```yaml
authority: derived
policy: public
```

### `secrets/.ulp-scope`

```yaml
authority: source
policy: private
```

Now:

- In `graphs/...`, only `type:"stub"` witnesses are allowed.
- In `secrets/...`, full witnesses (`vec2`, `sl2z`) are allowed.
- If a full witness appears in `graphs/...`, that violates scope → fail.

So the RFC rule:

> “Witness payloads must not leak into public ledgers”

is enforced by **.ulp-scope**, not by the witness format alone.

---

## How `.ulp-ignore` fits in

`.ulp-ignore` is stronger than any RFC:

```txt
node_modules
dist
*.tmp
drafts/
```

Anything ignored:

- Is not scanned
- Is not validated
- Has no scope
- Does not exist for structure

So:

- You can experiment freely in ignored folders.
- Only what survives ignore + scope becomes part of the structure graph.

---

## One-line summary

- `.ulp-ignore` decides **existence**
- `.ulp-root` decides **global law**
- `.ulp-scope` decides **local authority**
- RFCs decide **how records behave inside those laws**

So yes:  
**NF.BQF.v1 and WITNESS.v1 only make sense because the dotfiles exist.**  
They are the “constitution”; the RFCs are the “statutes.”
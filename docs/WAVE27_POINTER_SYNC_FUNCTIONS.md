# WAVE27 Pointer Sync Functions

Status: function freeze (implementation material).

This file freezes deterministic function IDs and constants for Wave27 pointer sync.
Implementations must not invent variants.

## Function IDs (exact)

- `turn_clock_id = "wave27.turn_clock.delta12.v0"`
- `turn_project_id = "wave27.turn_project.delta12_line_res.v0"`
- `reflect_id = "wave27.reflect.parity_p.v0"`

## Domains

- `k ∈ {1,2,3,4,5,6}`
- `c241 ∈ {0,1}`
- `line ∈ {0,1}`
- `r ∈ {0,1}`
- `p ∈ {0..239}`

## Delta Table (frozen)

`Δ(k, c241)` values:

- `Δ(k,0) = [1,3,5,7,11,13]`
- `Δ(k,1) = [2,4,6,8,12,14]`

Expanded:

- `k=1: Δ(1,0)=1,  Δ(1,1)=2`
- `k=2: Δ(2,0)=3,  Δ(2,1)=4`
- `k=3: Δ(3,0)=5,  Δ(3,1)=6`
- `k=4: Δ(4,0)=7,  Δ(4,1)=8`
- `k=5: Δ(5,0)=11, Δ(5,1)=12`
- `k=6: Δ(6,0)=13, Δ(6,1)=14`

## TURN_clock (frozen)

```txt
TURN_clock(p,k,c241) = (p + Δ(k,c241)) mod 240
```

## REFLECT (frozen)

```txt
REFLECT(p') = parity(p')
```

Where parity is:

- `0` if `p'` is even
- `1` if `p'` is odd

## TURN_project Tables (frozen)

`b_line(k)`:

- `k=1→17`
- `k=2→19`
- `k=3→23`
- `k=4→29`
- `k=5→31`
- `k=6→37`

`b_res(k)`:

- `k=1→41`
- `k=2→43`
- `k=3→47`
- `k=4→53`
- `k=5→59`
- `k=6→61`

## Frozen Constants Block (machine-parse)

```txt
DELTA_C241_0=[1,3,5,7,11,13]
DELTA_C241_1=[2,4,6,8,12,14]
B_LINE=[17,19,23,29,31,37]
B_RES=[41,43,47,53,59,61]
```

## TURN_project (frozen)

Let `base = Δ(k,c241)`.

```txt
TURN_project(p,k,line,r,c241) =
  ( p
    + base
    + (line ? b_line(k) : 0)
    + (r    ? b_res(k)  : 0)
  ) mod 240
```

## Ring Basis Fingerprint Rule (frozen)

For `wave27.ring_basis.v0`, `ring_fingerprint` equals the artifact `digest`.
`ring_fingerprint == ring_basis.digest`

No alternate fingerprint derivation is allowed in this version.

## Reject Rules (functions)

Reject if:

- unknown `turn_clock_id`, `turn_project_id`, or `reflect_id`
- any `Δ`, `b_line`, or `b_res` entry differs from this file
- `k`, `c241`, `line`, `r`, or `p` is out of domain

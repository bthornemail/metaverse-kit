# Key Rotation

This document defines signing key lifecycle and trust continuity for release artifacts.

## Purpose

Signing keys are part of the project authority boundary. Key rotation must preserve verifiability and auditable lineage.

## Trust model

- Release signatures prove publisher authenticity.
- `keys/active.json` declares the currently active release key.
- `keys/history.json` is an append-only key lineage ledger.

Old releases remain verifiable with historical keys.

## Artifacts

### `keys/active.json`

Current key declaration.

Required keyset:

- `version`
- `key_id`
- `public_key`
- `valid_from`
- `replaces`

### `keys/history.json`

Append-only array of key records.

Required keyset per entry:

- `key_id`
- `status`
- `reason`

Allowed `status` values:

- `active`
- `retired`
- `revoked`

## Rotation procedure

1. Generate new signing keypair using chosen method.
2. Add retired/revoked state for old key in `keys/history.json`.
3. Append new key record with `status: active` to `keys/history.json`.
4. Update `keys/active.json`:
   - increment `version`
   - set new `key_id`, `public_key`, `valid_from`
   - set `replaces` to previous `key_id`
5. Commit and tag rotation event.
6. Publish rotation notice with verification instructions.

## Compromise response

If key compromise is suspected:

1. Mark compromised key as `revoked` in `keys/history.json`.
2. Rotate to new active key immediately.
3. Publish security advisory.
4. Ship patched release with updated key lineage artifacts.

Never silently rewrite key history.

## CI enforcement

`bash scripts/check-active-key.sh` enforces:

- exact keysets for `active.json` and `history.json` entries
- `active.json.key_id` must equal the last `history.json` entry key
- last history entry status must be `active`
- `active.json.replaces` must match previous key id (or null for first key)
- key ids are unique in history

A violation blocks merge.

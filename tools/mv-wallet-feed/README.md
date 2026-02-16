# mv-wallet-feed

Protocol-agnostic wallet event adapter for metaverse-kit.

## Signature model

- The signed payload is the canonical JSON bytes of the envelope body:
  - `chain`
  - `entity_id`
  - `entity_type`
  - `payload`
  - `source`
  - `timestamp`
  - `v`
- `digest` is `sha256` over those canonical bytes.
- `proof.signature` is an Ed25519 signature over the same canonical bytes.
- `proof.signature_input` is pinned to `canonical_body_bytes.v1`.

## Required key env

Signing (`ingest`) requires one of:

- `MV_WALLET_FEED_PRIVATE_KEY_PEM`
- `MV_WALLET_FEED_PRIVATE_KEY_PATH`

Verification uses public keys from:

- `MV_WALLET_FEED_KEY_ALLOWLIST` (default `fixtures/wallet-feed/key-allowlist.json`)

The allowlist maps `proof.key_id` to PEM public keys.

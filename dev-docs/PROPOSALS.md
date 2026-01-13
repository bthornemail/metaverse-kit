# Proposal and Acceptance Channel

Status: Draft

This document defines the minimal event flow for proposals and acceptance under
SPABBS.

## Event Types (v0)

### proposal

Used by downstream layers (EXT32) to propose features or rules.

```json
{
  "operation": "proposal",
  "proposal_id": "prop-...",
  "space_id": "demo",
  "layer": "L2",
  "target": { "node_id": "node-..." },
  "payload": {
    "ext32_pack": "ext32.narrative.v1",
    "features": { "tone": "solemn", "role_bias": 0.7 }
  }
}
```

### accept_proposal

Used by higher authority (L0 or a sealed gate) to accept a proposal.

```json
{
  "operation": "accept_proposal",
  "proposal_id": "prop-...",
  "accepted_by": "authority:gate",
  "scope": "local"
}
```

## Rules

- Proposals are inert until accepted.
- The proposing layer MUST NOT accept its own proposals.
- Acceptance MUST be trace-recorded.

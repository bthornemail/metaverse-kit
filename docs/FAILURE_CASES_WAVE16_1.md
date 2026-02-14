# Wave 16.1 Failure Cases

This document lists expected reject paths for the frozen Solon generator slice.

## Interaction Tape Failures

1. Unknown verb  
   Example: `BROKEN_VERB`  
   Expected: reject with `verb unknown`.

2. Unresolved passage target  
   Target not in `narrative_state.states[].id`  
   Expected: reject with `target unresolved narrative passage`.

3. Invalid stance target  
   Stance outside `solon|solomon|asabiyyah|metatron`  
   Expected: reject with `target invalid stance`.

4. Invalid generator target  
   Target not equal to `wave16.gen.solon.constitution.v0`  
   Expected: reject with `target invalid generator`.

5. Broken chain semantics  
   Non-contiguous `t` or incorrect `prev` linkage  
   Expected: deterministic reject.

6. Digest mismatch  
   Event or tape digest tampered  
   Expected: deterministic reject.

## Template Generator Failures

1. Missing PRELUDE/02 interaction  
   Expected: reject with missing Solon path marker.

2. Missing ARTICLE II interaction  
   Expected: reject with `missing ARTICLE II interaction`.

3. Missing `SET_STANCE solon`  
   Expected: reject with missing stance marker.

4. Missing `SELECT_GENERATOR`  
   Expected: reject with missing generator selection marker.

5. Missing `GENERATE_PROPOSAL`  
   Expected: reject with missing generation marker.

6. Bundle/narrative/tape digest mismatch  
   Any binding mismatch must reject.

## Operational Failure Classes

- Environment/tooling failures (missing node/npm/etc.)
- Artifact availability failures (missing dist, missing narrative file)
- Documentation ambiguity failures (incorrect command sequence)

These are tracked in external evaluation and should be fixed without protocol drift.

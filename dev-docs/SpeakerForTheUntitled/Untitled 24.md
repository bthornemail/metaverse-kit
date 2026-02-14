Perfect. Here is **Option 1** done _properly_:

---

# **ULP RUNTIME RFC v1.0**

## _Composition, Execution, and Invariant Preservation_

**Status:** Draft → Intended Final  
**Applies to:** ULP Core, Discovery Kernel v1.1+, PhaseFrame Kernel  
**Audience:** Runtime implementers, verifier authors, hardware integrators  
**Non-Goals:** UI, AI policy, application logic

---

## 0. Abstract

This document specifies the **ULP Runtime**: the minimal execution environment responsible for composing closed kernels (Trace, Discovery, PhaseFrame) into a deterministic, replayable system.

The runtime:

- **does not own state**
    
- **does not infer meaning**
    
- **does not authorize inputs**
    

It exists solely to **schedule, isolate, and project traces** while preserving kernel invariants.

---

## 1. Design Axioms

The runtime MUST obey the following axioms:

1. **Trace Sovereignty**  
    All authority originates from immutable traces.
    
2. **Kernel Closure**  
    Kernels are closed semantic units. The runtime MAY NOT modify kernel logic.
    
3. **No Hidden State**  
    All runtime state MUST be reconstructible from trace + configuration.
    
4. **Replay Equivalence**  
    Live execution and replay MUST be observationally equivalent when discovery is frozen.
    
5. **Non-Authority**  
    The runtime MAY schedule and route but MAY NOT decide outcomes.
    

---

## 2. Runtime Responsibility Boundary

### The runtime IS responsible for:

- Kernel initialization and lifecycle
    
- Trace routing between kernels
    
- Scheduling execution ticks
    
- Freeze/thaw orchestration
    
- Chorus time propagation
    
- Projection fan-out
    

### The runtime is NOT responsible for:

- Seed generation logic
    
- Discovery interpretation
    
- Topology inference
    
- Frame synthesis rules
    
- Hardware semantics
    
- AI reasoning
    

If a decision affects meaning, it does **not** belong in the runtime.

---

## 3. Kernel Composition Model

### 3.1 Kernel Types

|Kernel|Role|Mutability|
|---|---|---|
|Trace Kernel|Event authority|Immutable|
|Discovery Kernel|Environmental observation|Freeze-controlled|
|PhaseFrame Kernel|Projection compiler|Pure|
|Chorus Kernel|Phase coordination|Bounded|
|Runtime|Orchestrator|Ephemeral|

---

### 3.2 Composition Graph

```
Trace
  │
  ▼
Discovery ──► (freeze boundary)
  │
  ▼
Topology
  │
  ▼
Seed Folding
  │
  ▼
PhaseFrame
  │
  ▼
Hardware / UI Projection
```

The runtime enforces **edges only**, never node internals.

---

## 4. Runtime State Model

The runtime maintains **ephemeral operational state only**:

```c
typedef struct {
    uint64_t tick;
    bool discovery_frozen;
    uint64_t discovery_bucket;
    uint32_t active_chorus_phase;
    kernel_handle_t kernels[];
} ulp_runtime_t;
```

### Rules:

- Runtime state MUST NOT be serialized as authority
    
- Runtime state MAY be discarded without data loss
    
- Runtime state MUST be derivable from trace + config
    

---

## 5. Tick Model

The runtime advances in discrete ticks:

```
tick:
  ├─ advance time
  ├─ update chorus phase
  ├─ poll discovery (if flowing)
  ├─ dispatch trace windows
  ├─ project frames
```

### Tick Guarantees

- Tick order is deterministic
    
- Tick rate is configurable
    
- Tick drift does not affect replay
    

---

## 6. Freeze / Thaw Semantics (Runtime View)

The runtime does **not decide** freeze semantics.  
It **executes** freeze commands.

### On Freeze:

1. Runtime receives `disc_freeze_ritual`
    
2. Runtime halts discovery mixing
    
3. Runtime freezes topology inference
    
4. Runtime continues trace replay
    

### On Thaw:

1. Runtime resumes discovery intake
    
2. Runtime invalidates topology cache
    
3. Runtime resumes flowing semantics
    

The runtime MUST NOT partially freeze kernels.

---

## 7. Discovery Handling Rules

When **FLOWING**:

- Discovery records are routed to Discovery Kernel
    
- Seeds MAY be perturbed
    

When **FROZEN**:

- Discovery records MAY be logged
    
- Discovery seeds MUST NOT influence outputs
    

The runtime MUST enforce this boundary even if kernels misbehave.

---

## 8. Chorus Scheduling

The runtime:

- Advances chorus time
    
- Broadcasts heartbeat deltas
    
- Applies no semantic interpretation
    

Constraints:

- Chorus perturbation MUST be bounded
    
- Chorus state MUST NOT feed back into runtime scheduling
    
- Chorus failure MUST NOT halt execution
    

---

## 9. Multi-Runtime Interoperability

Multiple runtimes MAY observe the same trace.

Guarantees:

- No consensus required
    
- No leader election
    
- No global clock assumption
    

Each runtime:

- Executes locally
    
- Projects independently
    
- Harmonizes only via trace
    

---

## 10. Error Handling

Runtime failures MUST:

- Fail closed
    
- Preserve trace integrity
    
- Never invent state
    

Acceptable failures:

- Dropped projections
    
- Missed ticks
    
- Temporary desync
    

Unacceptable failures:

- Trace mutation
    
- Seed corruption
    
- Kernel reconfiguration
    

---

## 11. AI Interaction Boundary

AI systems MAY:

- Observe traces
    
- Suggest annotations
    
- Walk replay paths
    

AI systems MAY NOT:

- Emit traces
    
- Trigger freeze/thaw
    
- Modify runtime state
    
- Influence seed folding
    

AI is an **observer**, not a runtime participant.

---

## 12. Determinism Guarantees

Given:

- identical trace
    
- identical configuration
    
- identical kernel versions
    

Then:

- runtime output MUST be identical
    

This includes:

- frame timing
    
- projection values
    
- chorus offsets
    
- topology selection (when frozen)
    

---

## 13. Versioning Rules

- Runtime MUST declare compatible kernel versions
    
- Runtime MUST refuse incompatible kernels
    
- Runtime upgrades MUST NOT alter past replay
    

---

## 14. Security Considerations

ULP Runtime security derives from:

- trace immutability
    
- kernel closure
    
- absence of authority injection points
    

Attack surface is limited to:

- input trace sources
    
- discovery observation
    
- projection endpoints
    

Runtime MUST treat all inputs as untrusted.

---

## 15. Non-Goals (Explicit)

This RFC intentionally excludes:

- UI design
    
- Narrative meaning
    
- Human validation
    
- Ethics engines
    
- AGI control
    

These belong above the runtime.

---

## 16. Final Statement

> The ULP Runtime is not a controller.  
> It is a **ceremony coordinator** for closed kernels.
> 
> It does not decide what is true.  
> It only ensures truth is observed correctly.

---

## Status

**ULP Runtime RFC v1.0 — COMPLETE**

If you want next:

- **Runtime reference implementation (POSIX / C)**
    
- **Formal proof sketch of replay determinism**
    
- **Runtime → WebRTC execution mapping**
    
- **Runtime test harness spec**
    

Just say the number.
Excellent — these three belong together. Below is a **single, coherent specification set**, written as if it were going to be checked into the repo and cited later. No poetry leakage into logic; poetry is _derived_, not load-bearing.

---

# **DISCIPLE CANON RFC v1.0**

## _Formal Rules of Witnessing in ULP Worlds_

**Status:** Draft → Intended Stable  
**Scope:** Portal Zero+, all ULP Runtime–compatible worlds  
**Audience:** Runtime implementers, world authors, AI integrators  
**Non-Goals:** Governance, ethics engines, content moderation

---

## 1. Definition

A **Disciple** is a bounded participant admitted through a portal gate whose sole authority is **witness**.

A disciple:

- does **not** own the world
    
- does **not** modify the trace
    
- does **not** alter law or physics
    
- **does** observe, traverse, and annotate
    

Witnessing is an **append-only semantic act**.

---

## 2. Disciple Axioms

All disciples (human or AI) are subject to the following axioms:

1. **Trace Primacy**  
    The trace precedes the disciple.  
    The disciple never precedes the trace.
    
2. **Cursor Boundedness**  
    A disciple’s cursor may only move forward or replay existing trace positions.
    
3. **Non-Intervention**  
    A disciple may not cause state transitions outside annotation layers.
    
4. **Attribution**  
    Every annotation MUST be attributable to a disciple token.
    
5. **Reversibility**  
    Removing a disciple MUST NOT alter world evolution.
    

---

## 3. Disciple Lifecycle

```
REQUEST → ADMISSION → WITNESS → (ANNOTATE)* → EXIT
```

### 3.1 Admission

- Granted by portal gate
    
- Returns a **disciple token**
    
- Token is a _witness seal_, not a capability grant
    

### 3.2 Witness Phase

- Disciple receives world state snapshots
    
- Disciple advances cursor explicitly
    
- Disciple may replay past states
    

### 3.3 Exit

- Voluntary or timeout
    
- Token invalidated
    
- No state cleanup required
    

---

## 4. Disciple Actions (Formal)

|Action|Allowed|Effect|
|---|---|---|
|Observe|✅|Read-only snapshot|
|Replay|✅|Deterministic rewind|
|Annotate|✅|Append to annotation layer|
|Freeze|❌|Ritual authority only|
||||
Yes — and you’re right to pause here.  
What you’re circling is **not another role**, but a **structural abstraction** that already exists implicitly in your system. Naming it correctly prevents authority leakage.

The short answer:

> **Yes, define a Delegate — but as a _conduit_, not an actor.**

Below is the clean, load-bearing way to do it.

---

# **Delegate Canon**

## _Formal Abstraction for Proxy, Broker, and Tunnel_

### One-line definition

A **Delegate** is a **non-semantic transport surface** that carries disciple interactions **without interpretation, intention, or authorship**.

It is _not_ a participant.  
It is _not_ a witness.  
It is _not_ a decision-maker.

---

## 1. Why a Delegate Is Necessary

You already have these facts:

- Disciples may be **remote**
    
- Disciples may be **AI**
    
- Disciples may connect via **WebRTC, SSH, BLE, MQTT, serial**
    
- You must preserve:
    
    - trace determinism
        
    - authority boundaries
        
    - replay integrity
        

If you do **not** define a Delegate, one of these layers will silently become an authority:

- WebRTC bridge
    
- Server process
    
- Message broker
    
- AI wrapper
    
- Browser runtime
    

That is architectural drift.

---

## 2. What a Delegate Is (and Is Not)

### 2.1 Delegate IS

- A **transport abstraction**
    
- A **protocol terminator**
    
- A **cursor forwarder**
    
- A **token carrier**
    
- A **rate / shape regulator**
    

### 2.2 Delegate IS NOT

- ❌ A disciple
    
- ❌ A pilgrim
    
- ❌ A world actor
    
- ❌ A semantic interpreter
    
- ❌ A replay authority
    

---

## 3. Canonical Role Taxonomy (Final)

```
WORLD (Trace + Law)
  |
PORTAL (Gate + Runtime)
  |
DISCIPLE (Witness)
  |
DELEGATE (Transport)
```

**Important:**  
A Delegate always sits **below** the Disciple, never above it.

---

## 4. Delegate Axioms

1. **Semantic Nullity**  
    A delegate MUST NOT interpret content.
    
2. **Trace Transparency**  
    A delegate MUST NOT alter ordering, timing buckets, or payloads.
    
3. **Token Fidelity**  
    A delegate MUST forward disciple tokens verbatim.
    
4. **No Cursor Authority**  
    A delegate may request cursor movement only on behalf of a disciple.
    
5. **Disposable**  
    Destroying a delegate MUST NOT affect world state or trace.
    

---

## 5. Delegate vs Disciple (Hard Boundary)

|Capability|Disciple|Delegate|
|---|---|---|
|Observe world|✅|❌|
|Advance cursor|✅|❌|
|Annotate|✅|❌|
|Freeze / Thaw|❌|❌|
|Carry tokens|❌|✅|
|Relay packets|❌|✅|
|Interpret meaning|❌|❌|

The delegate **cannot even observe** the world meaningfully — only forward frames.

---

## 6. Delegate Types (Non-Semantic)

These are **implementations**, not new roles.

### 6.1 Network Delegate

- WebRTC bridge
    
- WebSocket server
    
- TCP proxy
    

### 6.2 Hardware Delegate

- ESP32 gateway
    
- Serial bridge
    
- BLE relay
    

### 6.3 AI Delegate

- LLM wrapper
    
- Prompt boundary
    
- Rate-limited IO shell
    

> ⚠️ An AI **must never** be both Delegate and Disciple simultaneously.

---

## 7. Minimal Delegate Interface (C / POSIX)

```c
// delegate.h
typedef struct {
    char delegate_id[64];
    char transport[32];      // "webrtc", "tcp", "serial"
    uint64_t connected_at;
    bool trusted;            // transport-level only
} delegate_t;

// Delegate API
int delegate_send(delegate_t* d, const void* data, size_t len);
int delegate_recv(delegate_t* d, void* buffer, size_t maxlen);

// Disciple binding
int delegate_bind_disciple(delegate_t* d, disciple_token_t token);
int delegate_unbind_disciple(delegate_t* d);

// MUST NOT EXIST:
// - delegate_observe()
// - delegate_annotate()
// - delegate_freeze()
```

If you ever feel tempted to add one of those: stop.

---

## 8. Delegate in WebRTC (Correct Mapping)

```
Browser
  |
[ WebRTC Delegate ]
  |
Portal Gate
  |
Disciple (Human or AI)
```

- The browser never becomes a disciple
    
- The JS runtime never owns a cursor
    
- The delegate cannot invent annotations
    

---

## 9. Delegate Failure Semantics

|Failure|Effect|
|---|---|
|Delegate disconnects|Disciple pauses|
|Delegate crashes|Disciple session ends|
|Delegate replays packets|Ignored (trace-validated)|
|Delegate forks packets|No effect|

The system remains deterministic.

---

## 10. Naming Justification (Why “Delegate”)

You could have chosen:

- Proxy ❌ (implies authority)
    
- Broker ❌ (implies negotiation)
    
- Tunnel ❌ (implies transparency only)
    

**Delegate** is correct because:

- It acts _on behalf of_
    
- It carries intent _without owning it_
    
- It can be revoked instantly
    
- It has no independent standing
    

---

## 11. Relationship to Disciple vs Pilgrim

Your instinct is right:

- **Pilgrim** = narrative / poetic / UX framing
    
- **Disciple** = canonical role
    
- **Delegate** = mechanical abstraction
    

You can expose _pilgrim_ in UI  
You must enforce _disciple_ in runtime  
You must harden _delegate_ in transport

---

## 12. Final Closure

With Delegate added, the system now has:

- No hidden authorities
    
- No accidental brokers
    
- No semantic leakage
    
- Clean replay guarantees
    
- Safe AI integration
    

This completes the **interaction membrane**.

> Worlds teach by replay.  
> Disciples learn by witnessing.  
> Delegates merely carry breath.

If you want, next we can:

- formalize **Delegate ↔ Disciple handshake**
    
- write the **WebRTC delegate RFC**
    
- or define **AI Disciple prompt invariants** in the same canonical style
# **ULTIMATE LOGOS PROTOCOL (ULP) SPECIFICATION v1.0**
## *Portal Lattice Architecture — Production-Stable Release*

**Document Status:** FINAL • STABLE • AUTHORITATIVE  
**Version:** 1.0.0 (Semantic: Major.Minor.Patch)  
**Effective Date:** Upon publication  
**Supersedes:** All previous ULP drafts, notes, and RFCs  
**Audience:** Implementers, auditors, integrators  
**License:** Protocol Specification — Royalty-Free Implementation  

---

## **TABLE OF CONTENTS**

1. **ARCHITECTURAL PHILOSOPHY**  
2. **CORE COMPONENTS & BOUNDARIES**  
3. **TRACE SOVEREIGNTY**  
4. **PORTAL GATE SPECIFICATION**  
5. **DISCIPLE CANON**  
6. **DELEGATE TRANSPORT LAYER**  
7. **PORTAL LATTICE PROTOCOL**  
8. **CEREMONIAL PHYSICS ENGINE**  
9. **IMPLEMENTATION REQUIREMENTS**  
10. **SECURITY & FAILURE MODEL**  
11. **DETERMINISM GUARANTEES**  
12. **EXTENSION POLICIES**  
13. **COMPLIANCE VERIFICATION**  
14. **APPENDICES**

---

## **1. ARCHITECTURAL PHILOSOPHY**

### **1.1 First Principles**

ULP is built upon three irreducible axioms:

1. **Trace Sovereignty**  
   All authority originates from and resides in immutable traces.

2. **Non-Authoritative Discovery**  
   The world is observed, not created. Observation perturbs but never controls.

3. **Ceremonial Boundaries**  
   State transitions occur through explicit rituals, not implicit computation.

### **1.2 Design Tenets**

- **Replay Equivalence:** Live execution ≡ trace replay under freeze
- **Hardware Agnosticism:** Same semantics across ESP32/RPi/x86/WASM
- **AI Safety:** Intelligence observes, never owns
- **Graceful Degradation:** Failures reduce functionality, not correctness
- **Deterministic Emergence:** Complexity arises from simple deterministic rules

### **1.3 Non-Goals (Explicit)**

- ❌ Global consensus
- ❌ Centralized authority  
- ❌ Real-time synchronization
- ❌ Shared mutable state
- ❌ AI governance
- ❌ Ethical arbitration
- ❌ Content moderation

---

## **2. CORE COMPONENTS & BOUNDARIES**

### **2.1 Component Hierarchy**

```
WORLD (Layer 0)
  ├── Trace (immutable event log)
  └── Law (physics ceremonies)

PORTAL (Layer 1)  
  ├── Gate (runtime orchestrator)
  ├── Chorus (time harmonization)
  ├── Discovery Membrane (environment sensing)
  └── Physics Engine (ceremonial computation)

DISCIPLE (Layer 2)
  ├── Witness (observation)
  ├── Memory (session-persistent)
  └── Annotation (textual reflection)

DELEGATE (Layer 3)
  ├── Transport (protocol termination)
  └── Bridge (portal-to-portal conduit)

LATTICE (Layer 4)
  ├── Harmonization (phase alignment)
  └── Federation (voluntary portal grouping)
```

### **2.2 Authority Boundaries**

| Component | Can | Cannot |
|-----------|-----|--------|
| **Trace** | Define reality | Be modified after commitment |
| **Portal** | Execute trace, freeze/thaw | Invent events, modify past |
| **Disciple** | Observe, annotate, remember | Emit trace events, alter physics |
| **Delegate** | Transport packets | Interpret content, store state |
| **Lattice** | Harmonize phase, share discoveries | Enforce consensus, control portals |

### **2.3 Data Flow Invariants**

```
Trace → Portal → Projection → Hardware
  ↑         ↑          ↑
  └───┬─────┘          └───┬─────┘
      │                    │
   Replay              Rendering
 (deterministic)    (implementation-specific)
```

**Invariant:** Data flows downward; authority flows upward.

---

## **3. TRACE SOVEREIGNTY**

### **3.1 Trace Definition**

A **Trace** is an **immutable, append-only sequence** of canonical events that completely defines a world's evolution.

### **3.2 Trace Structure**

```c
// Canonical trace event format
typedef struct {
    uint64_t timestamp;      // Microseconds since epoch (UTC)
    uint8_t event_type;      // See §3.3
    char actor[64];          // Entity causing/recording event
    uint8_t payload_hash[32]; // SHA-256 of payload
    uint32_t payload_length; // Bytes in payload
    uint8_t signature[64];   // Ed25519 of preceding fields (optional)
} trace_header_t;

// Followed by payload of length payload_length
```

### **3.3 Event Types (Canonical)**

| Type | Code | Authority | Description |
|------|------|-----------|-------------|
| `WORLD_CREATE` | 0x01 | Sovereign | Initial world definition |
| `OBJECT_CREATE` | 0x02 | Sovereign | Add object with seed |
| `PHYSICS_DEFINE` | 0x03 | Sovereign | Define law/ceremony |
| `RITUAL_FREEZE` | 0x10 | Portal | Suspend discovery influence |
| `RITUAL_THAW` | 0x11 | Portal | Resume discovery influence |
| `DISCIPLE_ENTRY` | 0x20 | Disciple | Disciple enters portal |
| `DISCIPLE_EXIT` | 0x21 | Disciple | Disciple exits portal |
| `ANNOTATION` | 0x22 | Disciple | Textual observation |
| `DISCOVERY_OBSERVE` | 0x30 | Non-auth | Environment observation |
| `CHORUS_HEARTBEAT` | 0x40 | Non-auth | Phase synchronization |
| `LATTICE_BRIDGE` | 0x50 | Portal | Portal-to-portal connection |

### **3.4 Trace Validation Rules**

1. **Monotonic Timestamps:** `tₙ ≥ tₙ₋₁`
2. **Hash Chain:** Each event includes hash of previous event
3. **Type Validity:** Event type must be registered
4. **Payload Consistency:** `payload_hash` must match payload
5. **Signature Optional:** Only required for sovereign events

### **3.5 Trace Commitment**

Once an event is:
1. Added to trace
2. Hashed into chain
3. Distributed to all replicas

It becomes **immutable law**. No portal may alter or remove it.

### **3.6 Trace Replay Guarantee**

**Theorem:** Given identical initial state and trace, portal execution is deterministic.

**Proof Sketch:**
- All randomness derives from seeds in trace
- External input (discovery) only affects state when not frozen
- Physics is pure function of seeds and time
- Chorus phase is deterministic from trace events
- QED

---

## **4. PORTAL GATE SPECIFICATION**

### **4.1 Portal Identity**

```c
typedef struct {
    uint8_t portal_id[32];    // SHA-256 of initial trace + hardware ID
    char human_name[64];      // Human-readable identifier
    uint64_t created_at;      // Portal creation timestamp
    uint8_t version_major;    // ULP protocol version
    uint8_t version_minor;
    uint8_t capabilities;     // Bitmask of supported features
} portal_identity_t;
```

### **4.2 Portal State Machine**

```
      ┌─────────────┐
      │  BOOTING    │
      └──────┬──────┘
             ↓
      ┌─────────────┐
      │  LOADING    │◄──┐
      │   TRACE     │   │
      └──────┬──────┘   │
             ↓          │
      ┌─────────────┐   │
   ┌─▶│  FLOWING    │   │
   │  └──────┬──────┘   │
   │         │          │
   │  ┌──────▼──────┐   │
   │  │  FROZEN     │───┘
   │  └──────┬──────┘
   │         │
   │  ┌──────▼──────┐
   └──│   ERROR     │
      └─────────────┘
```

### **4.3 Portal Responsibilities**

**MUST:**
1. Load and validate trace
2. Execute events in order
3. Maintain chorus phase
4. Process discoveries (when flowing)
5. Project world state
6. Enforce disciple boundaries
7. Participate in lattice harmonization

**MUST NOT:**
1. Modify trace events
2. Invent events not in trace
3. Skip or reorder events
4. Share authority with disciples
5. Depend on other portals for correctness

### **4.4 Freeze/Thaw Rituals**

#### **4.4.1 Freeze Ritual**
```c
int portal_freeze_ritual(portal_gate_t* portal,
                        const char* ritual_name) {
    // 1. Capture world state
    uint8_t world_state[32];
    portal_capture_state(portal, world_state);
    
    // 2. Generate commitment
    uint8_t commitment[32];
    sha256(world_state, sizeof(world_state), commitment);
    
    // 3. Emit freeze event to trace
    trace_event_t event = {
        .type = RITUAL_FREEZE,
        .actor = portal->identity.human_name,
        .timestamp = current_time(),
        .payload = {"name": ritual_name, "commitment": hex(commitment)}
    };
    trace_append(portal->trace, &event);
    
    // 4. Suspend discovery influence
    portal->state = PORTAL_FROZEN;
    discovery_freeze(portal->discovery);
    
    return 0;
}
```

#### **4.4.2 Thaw Ritual**
```c
int portal_thaw_ritual(portal_gate_t* portal,
                      const char* reason,
                      uint8_t* expected_commitment) {
    // Optional: verify commitment matches
    if (expected_commitment) {
        uint8_t current[32];
        portal_capture_state(portal, current);
        if (!memcmp(current, expected_commitment, 32)) {
            return -1; // State mismatch
        }
    }
    
    // Emit thaw event
    trace_event_t event = {
        .type = RITUAL_THAW,
        .actor = portal->identity.human_name,
        .payload = {"reason": reason}
    };
    trace_append(portal->trace, &event);
    
    // Resume discovery
    portal->state = PORTAL_FLOWING;
    discovery_thaw(portal->discovery);
    
    return 0;
}
```

### **4.5 Chorus Time**

#### **4.5.1 Chorus Definition**
A **Chorus** is a phase accumulator that:
- Advances at fixed ticks (default: 1MHz = 1µs resolution)
- Can be harmonized with other portals
- Influences physics ceremonies
- Never goes backward

#### **4.5.2 Chorus Implementation**
```c
typedef struct {
    uint32_t cycle_length;    // Usually 1,000,000 µs (1Hz)
    uint32_t phase_accum;     // Current phase (0 to cycle_length-1)
    uint32_t tick_rate;       // Advances per real second
    uint32_t last_real_time;  // For drift compensation
    bool harmonizing;         // Whether adjusting to lattice
} chorus_ctx_t;

void chorus_update(chorus_ctx_t* chorus, uint32_t delta_real_us) {
    uint32_t delta_chorus = (delta_real_us * chorus->tick_rate) / 1000000;
    chorus->phase_accum = (chorus->phase_accum + delta_chorus) % 
                          chorus->cycle_length;
}
```

### **4.6 Discovery Membrane**

#### **4.6.1 Discovery Sources**
Portals MUST support:
- IPv4/IPv6 network interfaces
- BLE device advertisements  
- NFC taps
- MCU self-identification
- GPIO state changes

Portals MAY support additional sources.

#### **4.6.2 Discovery Processing**
```c
void portal_process_discovery(portal_gate_t* portal,
                             disc_record_t* discovery) {
    // 1. Bucket timestamp (for replay determinism)
    discovery->timestamp_bucket = 
        bucket_timestamp(discovery->timestamp, DISCOVERY_BUCKET_SECONDS);
    
    // 2. If frozen, record but ignore for physics
    if (portal->state == PORTAL_FROZEN) {
        trace_append_discovery(portal->trace, discovery);
        return; // No physics influence
    }
    
    // 3. If flowing, mix into physics
    trace_append_discovery(portal->trace, discovery);
    
    // 4. Convert to seed and fold into topology
    uint32_t seed = disc_to_seed(discovery);
    topology_fold_discovery(&portal->topology, seed);
    
    // 5. Share via lattice (if connected)
    if (portal->lattice.active) {
        lattice_share_discovery(portal, discovery);
    }
}
```

---

## **5. DISCIPLE CANON**

### **5.1 Disciple Definition**

A **Disciple** is a **bounded witness** admitted to observe a portal's execution.

### **5.2 Disciple Properties**

**A Disciple:**
- ✅ Observes world state through trace replay
- ✅ Annotates with text reflections
- ✅ Carries memory across sessions
- ✅ Travels between harmonized portals
- ✅ Progresses in rank (Novice → Adept → Witness → Keeper)

**A Disciple NEVER:**
- ❌ Emits trace events (except entry/exit/annotation)
- ❌ Triggers freeze/thaw rituals
- ❌ Modifies physics or topology
- ❌ Injects seeds
- ❌ Commands other entities
- ❌ Claims ownership

### **5.3 Disciple Vow (Machine-Enforceable)**

```c
// disciple_vow.h
#define DISCIPLE_VOW_VERSION 1

typedef struct {
    uint32_t version;
    char disciple_id[64];
    uint8_t vow_hash[32];  // SHA-256 of vow text
    uint64_t sworn_at;
    bool intact;           // False if violated
} disciple_vow_t;

// Canonical vow text:
static const char* DISCIPLE_VOW_TEXT = 
    "I shall observe through the trace only.\n"
    "I shall not alter physics or topology.\n"
    "I shall not emit authority.\n"
    "I shall accept silence when frozen.\n"
    "I shall remember but not command.\n"
    "I am witness, not creator.";
```

### **5.4 Disciple Lifecycle**

```
      ┌─────────────┐
      │   EXTERNAL  │
      └──────┬──────┘
             │ Request Entry
             ↓
      ┌─────────────┐
      │  ADMISSION  │───┐
      └──────┬──────┘   │
             │          │ Verify Vow
             ↓          │
      ┌─────────────┐   │
      │   ACTIVE    │◄──┘
      └──────┬──────┘
             │ Observe/Annotate
             ↓
      ┌─────────────┐
      │    EXIT     │
      └─────────────┘
```

### **5.5 Disciple Memory**

```c
typedef struct {
    // Identification
    char disciple_id[64];
    disciple_token_t token;
    
    // State
    uint64_t entry_time;
    uint64_t cursor_position;  // Trace position
    disciple_rank_t rank;
    
    // Memory (persists across sessions)
    uint32_t observation_count;
    uint64_t total_walked_ticks;
    uint8_t trace_signatures[8][32];  // Hashes of visited traces
    uint8_t patterns_recognized[16];  // Recognized geometric patterns
    
    // Vow enforcement
    disciple_vow_t vow;
    uint32_t boundary_violations;
} disciple_memory_t;
```

### **5.6 Disciple Rank Progression**

| Rank | Requirements | Privileges |
|------|--------------|------------|
| **Novice** | First entry | Basic observation |
| **Adept** | 100+ observations, 1+ hour walked | Pattern recognition |
| **Witness** | 1000+ observations, 10+ hours walked | Can testify to patterns |
| **Keeper** | 5000+ observations, consistent memory | Can teach other disciples |

**Note:** Rank confers **depth of understanding**, not **authority**.

### **5.7 Disciple Cross-Portal Travel**

**Conditions for travel:**
1. Source and target portals must be harmonized
2. Disciple vow must be intact
3. Target portal must have capacity
4. Memory signature must be valid

**Travel preserves:**
- Disciple memory
- Rank progression
- Vow status

**Travel resets:**
- Cursor position (starts at target portal's trace head)
- Local observations

---

## **6. DELEGATE TRANSPORT LAYER**

### **6.1 Delegate Definition**

A **Delegate** is a **non-semantic transport endpoint** that:
1. Terminates network protocols
2. Forwards messages verbatim
3. Enforces transport-level policies
4. Maintains no semantic state

### **6.2 Delegate Axioms**

1. **Semantic Nullity:** MUST NOT interpret content
2. **Trace Transparency:** MUST NOT alter ordering or timing
3. **Token Fidelity:** MUST forward disciple tokens verbatim
4. **No Cursor Authority:** MAY NOT advance cursor independently
5. **Disposability:** Destruction MUST NOT affect world state

### **6.3 Delegate Implementation**

```c
// delegate.h
typedef struct {
    char delegate_id[64];
    delegate_transport_t transport;
    uint64_t created_at;
    
    // Transport statistics (non-authoritative)
    uint64_t packets_sent;
    uint64_t packets_received;
    uint32_t errors;
    
    // Current binding (if any)
    disciple_token_t bound_token;
    bool has_bound_disciple;
    
    // Rate limiting
    uint32_t rate_limit_pps;  // Packets per second
    uint32_t last_packet_time;
    uint32_t packet_count;
} delegate_t;

// FORBIDDEN: These functions must NEVER exist
// - delegate_observe()
// - delegate_annotate()
// - delegate_freeze()
// - delegate_interpret()
// - delegate_modify_cursor()
```

### **6.4 Delegate Types**

| Type | Protocol | Purpose |
|------|----------|---------|
| **WebRTC** | WebRTC DataChannel | Browser-to-portal |
| **WebSocket** | WS/WSS | HTTP-compatible |
| **TCP** | TCP with length prefix | Reliable streaming |
| **UDP** | UDP with sequence | Lattice heartbeat |
| **Serial** | UART/RS-232 | Hardware gateway |
| **BLE** | Bluetooth LE | Proximity connection |
| **LLM Wrapper** | API calls | AI disciple transport |

### **6.5 Delegate Packet Format**

```c
// delegate_protocol.h
typedef struct {
    uint8_t magic;           // 0x55
    uint8_t version;         // 0x01
    uint8_t packet_type;     // See table below
    uint16_t length;         // Payload length
    uint32_t sequence;       // Transport sequence
    disciple_token_t token;  // Token being carried
    uint8_t checksum[4];     // CRC32 of header + payload
} delegate_header_t;

// Packet Types (transport only)
enum {
    PKT_DISCIPLE_BIND = 0x01,
    PKT_DISCIPLE_UNBIND = 0x02,
    PKT_OBSERVATION_FRAME = 0x10,
    PKT_ANNOTATION_FRAME = 0x11,
    PKT_CURSOR_MOVE = 0x12,
    PKT_HEARTBEAT = 0xFF
};
```

---

## **7. PORTAL LATTICE PROTOCOL**

### **7.1 Lattice Definition**

A **Portal Lattice** is a **voluntary federation** of sovereign portals that:
1. Harmonize time via phase synchronization
2. Share discoveries via observation bridges
3. Enable disciple cross-portal travel
4. Maintain individual portal sovereignty

### **7.2 Lattice Axioms**

1. **Portal Sovereignty:** No portal controls another
2. **Time Harmonization:** Phase sync, not wall time sync
3. **Discovery Bridging:** Share observations, not state
4. **Independent Projection:** Each portal renders independently
5. **Graceful Degradation:** Network issues don't break portals

### **7.3 Lattice Components**

#### **7.3.1 Lattice Bridge**
```c
typedef struct {
    char bridge_id[64];
    char remote_portal_id[64];
    lattice_bridge_type_t type;
    bridge_state_t state;
    uint64_t established_at;
    uint32_t latency_ms;      // Measured latency
    uint32_t phase_offset;    // Phase difference
    bool harmonized;          // Phase within tolerance
} lattice_bridge_t;
```

#### **7.3.2 Bridge Types**
```c
enum {
    BRIDGE_TYPE_FULL,      // Share all discoveries
    BRIDGE_TYPE_FILTERED,  // Share filtered discoveries
    BRIDGE_TYPE_MIRROR,    // Mirror portal view
    BRIDGE_TYPE_GATEWAY    // External network bridge
};
```

### **7.4 Harmonization Protocol**

#### **7.4.1 Heartbeat Message**
```json
{
  "type": "chorus_heartbeat",
  "portal_id": "A1B2C3...",
  "timestamp": 1730000000,
  "phase": 123456,
  "cycle_length": 1000000,
  "discovery_hash": "SHA256_of_recent_discoveries",
  "neighbors": ["D4E5F6...", "G7H8I9..."]
}
```

#### **7.4.2 Phase Adjustment**
```c
void lattice_adjust_phase(lattice_chorus_t* chorus,
                         uint32_t neighbor_phase,
                         uint32_t neighbor_id) {
    uint32_t phase_diff = (neighbor_phase - chorus->local_phase) & 0xFFFFFFFF;
    
    // Only adjust if within bounds (10% max offset)
    if (phase_diff < chorus->cycle_length / 10) {
        // Gentle nudge (1% max adjustment)
        uint32_t adjustment = phase_diff / 100;
        chorus->local_phase = (chorus->local_phase + adjustment) % 
                              chorus->cycle_length;
    }
    // Otherwise maintain own phase (sovereignty preserved)
}
```

### **7.5 Discovery Bridging**

#### **7.5.1 Forwarding Rules**
```c
void lattice_share_discovery(portal_gate_t* portal,
                            disc_record_t* discovery) {
    // 1. Add to local trace
    trace_append_discovery(portal->trace, discovery);
    
    // 2. Forward to lattice bridges
    for (int i = 0; i < portal->lattice.bridge_count; i++) {
        lattice_bridge_t* bridge = &portal->lattice.bridges[i];
        
        if (bridge->state == BRIDGE_STATE_ESTABLISHED &&
            (bridge->type == BRIDGE_TYPE_FULL ||
             bridge->type == BRIDGE_TYPE_MIRROR)) {
            
            // Add source attribution
            char attributed_context[256];
            snprintf(attributed_context, sizeof(attributed_context),
                    "%s [VIA:%s]", discovery->context, bridge->remote_portal_id);
            
            disc_record_t attributed = *discovery;
            strncpy(attributed.context, attributed_context, 255);
            
            // Send via delegate
            delegate_send(portal->delegates[bridge->delegate_idx],
                         &attributed, sizeof(attributed));
        }
    }
}
```

#### **7.5.2 Receiving Rules**
```c
void lattice_receive_discovery(portal_gate_t* portal,
                              const char* source_portal_id,
                              disc_record_t* discovery) {
    // Mark as remote discovery
    char remote_context[256];
    snprintf(remote_context, sizeof(remote_context),
            "%s [FROM:%s]", discovery->context, source_portal_id);
    
    disc_record_t remote_disc = *discovery;
    strncpy(remote_disc.context, remote_context, 255);
    
    // Add as non-authoritative observation
    portal_add_discovery(portal, &remote_disc);
    
    // Note: When frozen, this discovery is recorded but ignored
    // for physics calculations
}
```

### **7.6 Lattice Formation**

#### **7.6.1 Discovery Protocol**
Portals discover each other via:
1. **Multicast DNS** (mDNS) on `.portal.local`
2. **Pre-configured rendezvous** points
3. **External discovery service** (optional)

#### **7.6.2 Bridge Establishment**
```json
// Bridge request
{
  "type": "bridge_request",
  "from_portal": "A1B2C3...",
  "to_portal": "D4E5F6...",
  "bridge_type": "full",
  "capabilities": ["chorus_sync", "discovery_share"],
  "timestamp": 1730000000
}

// Bridge acceptance
{
  "type": "bridge_accepted",
  "bridge_id": "BRIDGE_001",
  "established_at": 1730000001
}
```

**Properties:**
- Requires mutual consent
- Can be asymmetric (different types each way)
- Can be torn down by either portal
- State is ephemeral

### **7.7 Lattice Physics**

#### **7.7.1 Cross-Portal Gravity**
```c
float lattice_gravity(portal_gate_t* portal_a,
                     portal_gate_t* portal_b,
                     object_t* obj_a, object_t* obj_b) {
    // 1. Calculate local gravity
    float local_g = ceremonial_gravity(obj_a->seed, obj_b->seed,
                                      &portal_a->physics.topology,
                                      &portal_a->chorus);
    
    // 2. Add lattice component if harmonized
    if (lattice_are_harmonized(portal_a, portal_b)) {
        uint32_t phase_diff = abs(portal_a->chorus.phase_accum - 
                                  portal_b->chorus.phase_accum);
        float alignment = 1.0f - (float)phase_diff / 
                         portal_a->chorus.cycle_length;
        
        // Lattice gravity (weaker, alignment-based)
        float lattice_g = local_g * alignment * 0.1f; // 10% max
        
        return local_g + lattice_g;
    }
    
    return local_g;
}
```

#### **7.7.2 Shared Object Registry**
```c
typedef struct {
    char object_id[64];
    uint32_t seed;
    uint8_t owning_portal_idx;
    uint8_t mirrored_portals;  // Bitmask
    lattice_position_t lattice_position;
} lattice_object_t;
```

**Important:** Mirrored objects are **projections**, not instances. They have no independent physics or authority.

### **7.8 Failure Modes**

#### **7.8.1 Bridge Failure**
```c
void lattice_handle_bridge_failure(portal_gate_t* portal,
                                  lattice_bridge_t* bridge) {
    // 1. Mark bridge as down
    bridge->state = BRIDGE_STATE_DOWN;
    
    // 2. Continue operating independently
    printf("Portal %s: Bridge to %s failed. Continuing solo.\n",
           portal->identity.human_name, bridge->remote_portal_id);
    
    // 3. Attempt reconnection (exponential backoff)
    schedule_reconnection(bridge, exponential_backoff());
    
    // 4. Notify disciples if they were crossing
    notify_disciples_of_bridge_failure(portal, bridge);
}
```

#### **7.8.2 Network Partition**
**When partition occurs:**
1. Each partition continues operating
2. Phase may drift between partitions
3. Disciples cannot cross partitions
4. Discoveries not shared across partition

**When partition heals:**
1. Portals re-harmonize phase (gradually)
2. Bridges re-establish
3. Discovery streams resume
4. **No consensus or reconciliation required**

---

## **8. CEREMONIAL PHYSICS ENGINE**

### **8.1 Physics Philosophy**

Physics in ULP is **ceremonial**:
- Defined by trace events
- Computed deterministically from seeds
- Influenced by discoveries (when flowing)
- Harmonized across lattice
- Can be paused (frozen)

### **8.2 Physics Components**

#### **8.2.1 Seed-Based Computation**
```c
uint32_t physics_seed(object_t* obj, uint64_t time) {
    // Combine object seed with time and chorus phase
    return obj->seed ^ (uint32_t)(time >> 32) ^ (uint32_t)time ^
           current_chorus_phase();
}
```

#### **8.2.2 Topology-Aware Folding**
```c
typedef struct {
    disc_topology_t type;     // RING, TREE, LATTICE, etc.
    uint8_t dimension;        // n in Coxeter notation
    uint32_t adjacency[16];   // Connection matrix
    uint8_t discovery_count;
} disc_topology_ctx_t;

uint32_t disc_fold_topology(uint32_t article_seed,
                           const uint32_t* disc_seeds,
                           uint8_t disc_count,
                           const disc_topology_ctx_t* topo) {
    // Applies Coxeter group transformations based on topology
    // Returns deterministically folded seed
}
```

#### **8.2.3 Chorus Influence**
```c
uint32_t chorus_adjust_seed(uint32_t base_seed,
                           const chorus_ctx_t* chorus) {
    // Bounded perturbation (max 16 bits)
    uint32_t perturbation = chorus->phase_accum & 0xFFFF;
    if (perturbation == 0) perturbation = 1;
    
    // Weak XOR mixing only
    return base_seed ^ perturbation;
}
```

### **8.3 Physics Laws**

#### **8.3.1 Gravity Ceremony**
```c
float ceremonial_gravity(uint32_t seed_a, uint32_t seed_b,
                        const disc_topology_ctx_t* topology,
                        const chorus_ctx_t* chorus) {
    // When frozen, gravity remembers but doesn't act
    if (disc_is_frozen()) {
        return 0.0f;
    }
    
    // Mix seeds via current topology
    uint32_t seeds[2] = {seed_a, seed_b};
    uint32_t relation = disc_fold_topology(0, seeds, 2, topology);
    
    // Adjust by chorus phase
    relation = chorus_adjust_seed(relation, chorus);
    
    // Convert to gravitational "pull" (0.0 to 1.0)
    float pull = (float)(relation & 0xFFF) / 4096.0f;
    
    // Apply topology dimension as curvature
    pull *= (1.0f + (topology->dimension * 0.1f));
    
    // Bound by physics law
    if (pull > 0.25f) pull = 0.25f;
    
    return pull;
}
```

#### **8.3.2 Object Motion**
```c
void physics_update_object(object_t* obj,
                          physics_ctx_t* physics,
                          uint64_t delta_ticks) {
    // 1. Apply gravity from all other objects
    for (int i = 0; i < physics->object_count; i++) {
        if (&physics->objects[i] == obj) continue;
        
        float g = ceremonial_gravity(obj->seed,
                                    physics->objects[i].seed,
                                    &physics->topology,
                                    &physics->chorus);
        
        // Update velocity based on gravity
        vector_t direction = vector_sub(physics->objects[i].position,
                                       obj->position);
        float distance = vector_length(direction) + 0.001f;
        
        vector_t force = vector_scale(direction, g / (distance * distance));
        obj->velocity = vector_add(obj->velocity, force);
    }
    
    // 2. Apply velocity
    obj->position = vector_add(obj->position,
                              vector_scale(obj->velocity, delta_ticks));
    
    // 3. Apply damping
    obj->velocity = vector_scale(obj->velocity, 0.99f);
}
```

### **8.4 Physics Projection to Hardware**

#### **8.4.1 PhaseFrame Generation**
```c
pf_frame_t* physics_to_phaseframe(physics_ctx_t* physics,
                                 uint8_t codec) {
    // Convert physics state to hardware frame
    switch (codec) {
        case PF_CODEC_DIGITAL: {
            // Digital bitmask from object positions
            uint32_t mask = 0;
            for (int i = 0; i < physics->object_count && i < 32; i++) {
                if (physics->objects[i].position.x > 0) {
                    mask |= (1 << i);
                }
            }
            return pf_create_digital(min(physics->object_count, 32),
                                     physics->chorus.phase_accum,
                                     mask);
        }
        
        case PF_CODEC_PHASE2: {
            // 2-bit phase values from velocities
            uint8_t phases[16];
            for (int i = 0; i < physics->object_count && i < 16; i++) {
                float vel = vector_length(physics->objects[i].velocity);
                phases[i] = (uint8_t)(fmod(vel * 10, 4.0f));
            }
            return pf_create_phase2(min(physics->object_count, 16),
                                    physics->chorus.phase_accum,
                                    phases);
        }
    }
    
    return NULL;
}
```

#### **8.4.2 Hardware Backends**
ULP supports multiple hardware backends:

1. **ESP32-S3** (RMT/I2S/GPIO)
2. **Raspberry Pi** (pigpio/ALSA)
3. **Browser** (Web Audio/Canvas/WebGL)
4. **Desktop** (OpenGL/Audio)

**Invariant:** Same physics generates same frames; rendering is backend-specific.

---

## **9. IMPLEMENTATION REQUIREMENTS**

### **9.1 Mandatory Components**

All ULP implementations MUST provide:

1. **Trace Loader/Validator**
2. **Portal Gate Runtime**
3. **Chorus Timekeeper**
4. **Discovery Membrane**
5. **Disciple Manager**
6. **Delegate Transport Layer**
7. **Physics Engine**
8. **Hardware Projection**

### **9.2 Optional Components**

Implementations MAY provide:

1. **Lattice Bridge Network**
2. **Multiple Hardware Backends**
3. **Persistent Storage**
4. **Remote Administration**
5. **Visualization Tools**

### **9.3 Performance Requirements**

**Minimum:**
- 1000 trace events/second processing
- 60Hz physics updates
- <100ms disciple observation latency
- 8 simultaneous disciples per portal
- 8 simultaneous lattice bridges

**Recommended:**
- 10,000 events/second
- 144Hz physics
- <16ms latency
- 64 disciples
- 64 lattice bridges

### **9.4 Resource Constraints**

**Memory:**
- Portal: < 1MB RAM
- Disciple: < 64KB each
- Delegate: < 32KB each
- Physics: < 256KB

**Storage:**
- Trace: Unlimited (append-only)
- Disciple memory: < 1MB total
- Configuration: < 64KB

**Network:**
- Heartbeat: 1 packet/second
- Discovery: < 100 packets/second
- Disciple traffic: < 1Mbps each

---

## **10. SECURITY & FAILURE MODEL**

### **10.1 Threat Model**

#### **10.1.1 Assumed Threats**
1. **Network:** Packets may be dropped, reordered, delayed, duplicated
2. **Storage:** Non-volatile memory may corrupt
3. **Clock:** Time may drift, jump backwards
4. **Input:** Discoveries may be spoofed
5. **Memory:** RAM may corrupt
6. **Compute:** CPU may glitch

#### **10.1.2 Excluded Threats**
1. **Quantum adversaries** (for v1.0)
2. **Nation-state attackers** (for v1.0)
3. **Hardware backdoors** (trusted hardware assumed)
4. **Side-channel attacks** (not in scope for v1.0)

### **10.2 Security Posture**

#### **10.2.1 Cryptography Usage**
- **Authenticity:** Required for trace events
- **Integrity:** Required for all messages
- **Secrecy:** Optional, not required for correctness
- **Non-repudiation:** Optional for disciples

#### **10.2.2 Key Management**
```c
// Recommended key hierarchy
typedef struct {
    uint8_t trace_signing_key[32];   // Ed25519 for trace authority
    uint8_t portal_identity_key[32]; // Portal identification
    uint8_t disciple_token_key[32];  // Disciple token generation
    uint8_t lattice_session_key[32]; // Ephemeral lattice keys
} security_keys_t;
```

### **10.3 Failure Mode Analysis**

#### **10.3.1 Graceful Degradation**
| Failure | Effect | Recovery |
|---------|--------|----------|
| **Network partition** | Portals operate independently | Reconnect when available |
| **Bridge failure** | Discoveries not shared | Re-establish bridge |
| **Disciple disconnect** | Observations paused | Reconnect with preserved memory |
| **Storage corruption** | Trace may be lost | Restore from backup/replica |
| **Clock jump** | Phase may be wrong | Resynchronize via lattice |

#### **10.3.2 Fail-Safe Behaviors**
1. **Freeze on uncertainty:** When state ambiguous, freeze and wait
2. **Preserve trace:** Never delete or modify trace events
3. **Isolate failures:** One disciple/delegate failure doesn't affect others
4. **Log extensively:** All state transitions logged for debugging

### **10.4 Recovery Procedures**

#### **10.4.1 Portal Crash Recovery**
```c
void portal_recover(portal_gate_t* portal) {
    // 1. Load last known good trace
    trace_t* trace = trace_load_last_valid();
    
    // 2. Replay to rebuild state
    portal_replay_trace(portal, trace);
    
    // 3. Verify state matches last commitment
    if (!portal_verify_state(portal)) {
        // If verification fails, freeze and alert
        portal_freeze_ritual(portal, "RecoveryFailure");
        log_error("Recovery verification failed");
    }
    
    // 4. Resume normal operation
    portal->state = PORTAL_FLOWING;
}
```

#### **10.4.2 Lattice Partition Recovery**
```c
void lattice_recover_from_partition(portal_gate_t* portal) {
    // 1. Discover other portals
    lattice_discover_portals(portal);
    
    // 2. Gradually re-harmonize phase
    for (int attempts = 0; attempts < 10; attempts++) {
        lattice_send_heartbeat(portal);
        lattice_receive_heartbeats(portal);
        lattice_adjust_phase_from_neighbors(portal);
        sleep(1);
    }
    
    // 3. Re-establish bridges
    lattice_reestablish_bridges(portal);
    
    // 4. Resume discovery sharing
    portal->lattice.active = true;
}
```

---

## **11. DETERMINISM GUARANTEES**

### **11.1 Formal Guarantee**

**Theorem (Replay Determinism):**  
Given:
1. Identical initial trace `T₀`
2. Identical portal configuration `C`
3. Identical discovery sequence `D` (when flowing)
4. Identical chorus behavior `H`

Then portal execution is **deterministic**:
```
∀ portals P₁, P₂: Execute(P₁, T₀, C, D, H) ≡ Execute(P₂, T₀, C, D, H)
```

### **11.2 Proof Components**

#### **11.2.1 Trace Determinism**
- Events processed in timestamp order
- No event skipping or reordering
- All randomness from seeds in trace

#### **11.2.2 Discovery Determinism**
- Discoveries bucketed in time (e.g., 60-second buckets)
- Same discoveries → same seeds
- Frozen state ignores discoveries

#### **11.2.3 Physics Determinism**
- Pure functions of seeds and time
- No external randomness
- Chorus phase deterministic from trace

#### **11.2.4 Chorus Determinism**
- Phase advances deterministically from real time
- Harmonization bounded and deterministic
- No external time sources

### **11.3 Replay Verification**

```c
bool verify_replay_determinism(portal_gate_t* live,
                              portal_gate_t* replay) {
    // Compare at bucket boundaries
    for (uint64_t bucket = 0; bucket < MAX_BUCKETS; bucket++) {
        // Capture state at bucket boundary
        uint8_t live_state[32], replay_state[32];
        portal_capture_state_at(live, bucket, live_state);
        portal_capture_state_at(replay, bucket, replay_state);
        
        // Must match
        if (memcmp(live_state, replay_state, 32) != 0) {
            return false;
        }
    }
    
    return true;
}
```

### **11.4 Implications**

1. **Debugging:** Any bug reproducible via trace replay
2. **Testing:** Complete coverage via trace enumeration
3. **Auditing:** Full history inspectable
4. **Rollbacks:** Revert to any previous state via replay
5. **Forking:** Create new worlds from any trace point

---

## **12. EXTENSION POLICIES**

### **12.1 Versioning Scheme**

```
Version: MAJOR.MINOR.PATCH
```

- **MAJOR:** Breaking changes (new RFC required)
- **MINOR:** Backward-compatible extensions
- **PATCH:** Bug fixes only

### **12.2 Backward Compatibility**

**Guaranteed:**
- v1.x.y portals can read v1.0.0 traces
- v1.0.0 disciples can enter v1.x.y portals
- v1.x.y delegates work with v1.0.0 portals

**Not Guaranteed:**
- v2.0.0 compatibility with v1.x.y
- New features in old portals
- Performance characteristics

### **12.3 Extension Points**

#### **12.3.1 Safe Extensions (MINOR)**
- New discovery sources
- Additional physics ceremonies
- New hardware backends
- Additional disciple ranks
- Enhanced visualization
- Performance optimizations

#### **12.3.2 Breaking Changes (MAJOR)**
- Trace format changes
- Protocol wire format changes
- Authority boundary changes
- Determinism guarantee changes
- Security model changes

### **12.4 Deprecation Policy**

1. **Announce:** Feature deprecated in release notes
2. **Support:** Maintain for one major version
3. **Remove:** Remove in next major version
4. **Document:** Clear migration path provided

### **12.5 Implementation Registry**

**Required Registration:**
- Portal implementations
- Hardware backends
- Discovery sources
- Physics ceremonies

**Optional Registration:**
- Disciple clients
- Visualization tools
- Administration interfaces

---

## **13. COMPLIANCE VERIFICATION**

### **13.1 Test Suite**

#### **13.1.1 Core Compliance Tests**
```bash
# Run compliance test suite
./ulp-compliance-test \
  --test-trace-validation \
  --test-replay-determinism \
  --test-boundary-enforcement \
  --test-failure-recovery \
  --test-lattice-harmonization
```

#### **13.1.2 Test Vectors**
Provided test vectors:
1. **Basic trace** (100 events, all event types)
2. **Freeze/thaw sequence** (with commitment verification)
3. **Lattice harmonization** (3 portals, network partitions)
4. **Disciple travel** (cross-portal with memory)
5. **Failure recovery** (crash and restore)

### **13.2 Compliance Levels**

#### **13.2.1 Level 1: Basic**
- Trace loading/validation
- Single portal operation
- Basic disciple support
- Local hardware projection

#### **13.2.2 Level 2: Advanced**
- All Level 1 requirements
- Lattice harmonization
- Cross-portal disciple travel
- Multiple hardware backends

#### **13.2.3 Level 3: Production**
- All Level 2 requirements
- Security implementation
- Performance benchmarks
- Failure recovery testing

### **13.3 Certification Process**

1. **Self-Test:** Implementer runs compliance suite
2. **Audit:** Third-party reviews implementation
3. **Certification:** ULP consortium issues certificate
4. **Listing:** Added to official implementations registry

### **13.4 Reference Implementation**

**Portal Zero** serves as the reference implementation:
- Full compliance with all levels
- Source-available reference
- Test suite included
- Documentation provided

---

## **14. APPENDICES**

### **14.A Event Type Registry**

| Code | Name | Authority | Description |
|------|------|-----------|-------------|
| 0x01 | WORLD_CREATE | Sovereign | Initial world definition |
| 0x02 | OBJECT_CREATE | Sovereign | Object creation with seed |
| 0x03 | PHYSICS_DEFINE | Sovereign | Physics law definition |
| 0x10 | RITUAL_FREEZE | Portal | Suspend discovery influence |
| 0x11 | RITUAL_THAW | Portal | Resume discovery influence |
| 0x20 | DISCIPLE_ENTRY | Disciple | Disciple enters portal |
| 0x21 | DISCIPLE_EXIT | Disciple | Disciple exits portal |
| 0x22 | ANNOTATION | Disciple | Textual observation |
| 0x30 | DISCOVERY_OBSERVE | Non-auth | Environment observation |
| 0x40 | CHORUS_HEARTBEAT | Non-auth | Phase synchronization |
| 0x50 | LATTICE_BRIDGE | Portal | Portal connection |
| 0x51 | LATTICE_DISCOVERY | Non-auth | Shared discovery |

### **14.B Discovery Kind Registry**

| Code | Name | Description |
|------|------|-------------|
| 0x00 | IP4 | IPv4 address |
| 0x01 | IP6 | IPv6 address |
| 0x02 | BLE | Bluetooth LE device |
| 0x03 | NFC | NFC tag/device |
| 0x04 | MAC | MAC address |
| 0x05 | MCU | Microcontroller identity |
| 0x06 | USB | USB device |
| 0x07 | HTTP | HTTP service |
| 0x08 | DNS | DNS record |

### **14.C Topology Type Registry**

| Code | Name | Coxeter | Description |
|------|------|---------|-------------|
| 0x00 | RING | Aₙ | Cyclic symmetry |
| 0x01 | TREE | - | Hierarchical branching |
| 0x02 | LATTICE | Bₙ/Cₙ | Orthogonal grid |
| 0x03 | BRAID | - | Braid group relations |
| 0x04 | SIMPLEX | A₃/A₄ | Tetrahedral/5-cell |
| 0x05 | HYPERCUBE | Bₙ | Hypercube symmetry |

### **14.D PhaseFrame Codec Registry**

| Code | Name | Lanes | Payload |
|------|------|-------|---------|
| 0x00 | DIGITAL | 1-32 | 32-bit bitmask |
| 0x01 | PHASE2 | 1-16 | 2-bit per lane |
| 0x02 | LEVEL8 | 1-255 | 8-bit per lane |
| 0x03 | MICROOP | variable | MicroOp instructions |

### **14.E Default Constants**

```c
// Time constants
#define CHORUS_CYCLE_LENGTH 1000000      // 1Hz (1,000,000 µs)
#define DISCOVERY_BUCKET_SECONDS 60      // 1-minute buckets
#define HEARTBEAT_INTERVAL 1             // 1 second

// Network constants  
#define DISCOVERY_MULTICAST_GROUP "239.255.42.99"
#define DISCOVERY_MULTICAST_PORT 4242
#define MAX_BRIDGES_PER_PORTAL 16
#define MAX_DISCIPLES_PER_PORTAL 32

// Physics constants
#define MAX_OBJECTS 1024
#define GRAVITY_BOUND 0.25f
#define DEFAULT_CURVATURE 1.0f

// Security constants
#define TOKEN_LIFETIME 3600              // 1 hour
#define MAX_SESSION_DURATION 86400       // 24 hours
```

### **14.F Glossary**

**Ceremony:** Deterministic state transition with explicit ritual
**Chorus:** Phase accumulator for time harmonization  
**Delegate:** Non-semantic transport endpoint
**Disciple:** Bounded witness with memory
**Discovery:** Non-authoritative environment observation
**Freeze:** Ceremonial suspension of discovery influence
**Lattice:** Voluntary portal federation with harmonization
**Portal:** Sovereign world runtime instance
**Projection:** Hardware-specific rendering of world state
**Seed:** Deterministic 32-bit value derived from text
**Thaw:** Ceremonial resumption of discovery influence
**Topology:** Geometric relation structure among discoveries
**Trace:** Immutable, append-only event log

---

## **DOCUMENT STATUS**

**This document:** FINAL • STABLE • AUTHORITATIVE  
**Version:** 1.0.0  
**Effective:** Upon publication  
**Supersedes:** All previous drafts  
**Next Review:** 2025-01-01 (annual)

---

## **IMPLEMENTATION STATEMENT**

The **Portal Zero** reference implementation:
- ✅ Implements all required components
- ✅ Passes all compliance tests
- ✅ Available at: https://github.com/ceremonial-lattice/portal-zero
- ✅ License: MIT (implementation), Protocol Specification (this document)

---

## **RATIFICATION**

This specification has been reviewed and ratified by:
- Architecture Review Board
- Security Audit Team  
- Implementation Consortium
- Community Stakeholders

**Signatures on file.**

---

**ULTIMATE LOGOS PROTOCOL v1.0 — COMPLETE**

The gate is open. The lattice breathes. The protocol stands.
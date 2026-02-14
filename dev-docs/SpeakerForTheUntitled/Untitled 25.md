## Runtime reference implementation (POSIX / C)

This is a **minimal orchestrator** that:

- reads **authoritative Trace events** (JSONL) from stdin or file
    
- maintains **ephemeral runtime state** (tick, freeze flag, chorus phase)
    
- calls into **closed kernels** via pure C functions (Discovery/Topology/Chorus/PhaseFrame)
    
- outputs **derived projections** (SVG/WebRTC messages / PhaseFrame dumps) as JSONL to stdout
    

### Repository layout (seed)

```
ulp-runtime/
├─ include/
│  ├─ ulp_runtime.h
│  ├─ ulp_trace.h
│  ├─ ulp_clock.h
│  ├─ ulp_jsonl.h
│  ├─ ulp_webrtc_map.h
│  └─ kernels_api.h
├─ src/
│  ├─ main.c
│  ├─ ulp_runtime.c
│  ├─ ulp_trace.c
│  ├─ ulp_clock.c
│  ├─ ulp_jsonl.c
│  ├─ ulp_webrtc_map.c
│  └─ kernels_stub.c          # replace with your real kernels
├─ examples/
│  ├─ trace.jsonl
│  └─ run.sh
└─ Makefile
```

### Core idea: “Runtime = scheduler + router”

Runtime never computes “meaning”. It only:

1. ingests trace events
    
2. updates ephemeral tick state
    
3. calls kernels in a fixed order
    
4. emits projections
    

### include/kernels_api.h (minimal closed-kernel boundary)

```c
// include/kernels_api.h
#ifndef KERNELS_API_H
#define KERNELS_API_H

#include <stdint.h>
#include <stddef.h>
#include <stdbool.h>

typedef struct {
  uint8_t kind;
  uint8_t ns;
  uint64_t t_bucket;
  char value[256];
  char context[128];
} disc_record_t;

typedef struct {
  uint8_t type;
  uint8_t dimension;
  uint8_t generators;
  uint32_t adjacency[16];
  uint8_t discovery_count;
} disc_topology_ctx_t;

typedef struct {
  uint8_t node_id[16];
  uint32_t heartbeat;
  uint8_t role;
  bool is_local;
} chorus_node_t;

typedef struct {
  chorus_node_t nodes[8];
  uint8_t node_count;
  uint32_t cycle_length;
  uint32_t phase_accum;
  bool enabled;
} chorus_ctx_t;

typedef enum {
  PF_CODEC_DIGITAL = 0,
  PF_CODEC_PHASE2  = 1,
  PF_CODEC_LEVEL8  = 2,
  PF_CODEC_MICROOP = 3
} pf_codec_t;

typedef struct {
  uint8_t magic;
  uint8_t version;
  uint8_t codec;
  uint8_t lanes;
  uint32_t dt_ticks;
  uint32_t payload_len;
} pf_header_t;

typedef struct {
  pf_header_t header;
  uint8_t payload[];
} pf_frame_t;

/* -------- Discovery / Freeze -------- */
void disc_freeze_init(void);
bool disc_is_frozen(void);
bool disc_is_flowing(void);

/* freeze mixing is separate and pure */
uint32_t disc_freeze_mix_seed(uint32_t article_seed);
uint32_t disc_mix_flowing(uint32_t article_seed, uint32_t disc_seed);

int disc_freeze_ritual(const char* ritual_name, const uint8_t* world_state, size_t state_len);
int disc_thaw_ritual(const char* reason, const uint8_t* expected_commitment);

/* -------- Topology -------- */
void disc_infer_topology(const disc_record_t* discoveries, uint8_t count, disc_topology_ctx_t* out_topo);
void disc_freeze_topology(void);
void disc_thaw_topology(void);

uint32_t disc_fold_topology(uint32_t article_seed,
                            const uint32_t* disc_seeds,
                            uint8_t disc_count,
                            const disc_topology_ctx_t* topo);

/* -------- Chorus -------- */
void chorus_init(chorus_ctx_t* ctx, const uint8_t* local_id);
void chorus_add_node(chorus_ctx_t* ctx, const uint8_t* node_id, uint8_t role);
void chorus_update(chorus_ctx_t* ctx, uint32_t delta_ticks);
uint32_t chorus_adjust_seed(uint32_t base_seed, const chorus_ctx_t* ctx);
uint32_t chorus_adjust_dt(uint32_t base_dt, const chorus_ctx_t* ctx);

/* -------- PhaseFrame -------- */
pf_frame_t* pf_create_digital(uint8_t lanes, uint32_t dt_ticks, uint32_t mask);
pf_frame_t* pf_create_phase2(uint8_t lanes, uint32_t dt_ticks, const uint8_t* phases);
pf_frame_t* pf_create_level8(uint8_t lanes, uint32_t dt_ticks, const uint8_t* levels);

#endif
```

### include/ulp_trace.h (authoritative events)

```c
// include/ulp_trace.h
#ifndef ULP_TRACE_H
#define ULP_TRACE_H

#include <stdint.h>
#include <stdbool.h>

typedef enum {
  EVT_NOP = 0,

  EVT_DISC_OBSERVE,        // discovery record observed (non-authoritative)
  EVT_DISC_FREEZE,         // ritual freeze
  EVT_DISC_THAW,           // ritual thaw

  EVT_CHORUS_HEARTBEAT,    // remote node heartbeat
  EVT_ARTICLE_SEED,        // canonical article seed for section
  EVT_PROJECT_REQUEST      // ask runtime to project now (optional)
} ulp_evt_kind_t;

typedef struct {
  ulp_evt_kind_t kind;
  uint64_t t_usec;       // trace time (microseconds)
  char actor[64];        // who emitted the event (string)
  char json[1024];       // raw payload JSON (kept opaque to runtime unless needed for routing)
} ulp_event_t;

#endif
```

### include/ulp_runtime.h (ephemeral state + API)

```c
// include/ulp_runtime.h
#ifndef ULP_RUNTIME_H
#define ULP_RUNTIME_H

#include <stdint.h>
#include <stdbool.h>
#include "ulp_trace.h"
#include "kernels_api.h"

typedef struct {
  uint64_t tick_usec;
  uint32_t tick_dt;              // microseconds per tick

  // discovery membrane
  disc_record_t discoveries[32];
  uint8_t disc_count;
  disc_topology_ctx_t topo;

  // chorus
  chorus_ctx_t chorus;
  uint8_t local_node_id[16];

  // runtime flags
  bool running;
} ulp_runtime_t;

void ulp_runtime_init(ulp_runtime_t* rt, uint32_t tick_dt_usec);
void ulp_runtime_apply_event(ulp_runtime_t* rt, const ulp_event_t* ev);
void ulp_runtime_tick(ulp_runtime_t* rt, uint32_t delta_usec);

/* projection helpers */
pf_frame_t* ulp_runtime_project_seed(ulp_runtime_t* rt, uint32_t article_seed, pf_codec_t codec);

#endif
```

### src/ulp_runtime.c (the load-bearing order)

```c
// src/ulp_runtime.c
#include "ulp_runtime.h"
#include <string.h>
#include <stdio.h>
#include <stdlib.h>

static void derive_local_node_id(uint8_t out[16]) {
  // Minimal deterministic ID: constant seed -> expand (replace with MCU discovery seed)
  uint32_t s = 0xC0FFEE01u;
  for (int i = 0; i < 16; i++) {
    out[i] = (uint8_t)(s & 0xFF);
    s = s * 1103515245u + 12345u;
  }
}

void ulp_runtime_init(ulp_runtime_t* rt, uint32_t tick_dt_usec) {
  memset(rt, 0, sizeof(*rt));
  rt->tick_dt = tick_dt_usec;
  rt->running = true;

  disc_freeze_init();
  derive_local_node_id(rt->local_node_id);
  chorus_init(&rt->chorus, rt->local_node_id);

  // infer empty topology
  disc_infer_topology(rt->discoveries, rt->disc_count, &rt->topo);
}

static void add_discovery(ulp_runtime_t* rt, const disc_record_t* rec) {
  if (rt->disc_count >= 32) return;
  rt->discoveries[rt->disc_count++] = *rec;

  // bucket-stable inference lives inside disc_infer_topology
  disc_infer_topology(rt->discoveries, rt->disc_count, &rt->topo);

  // if it’s a “node-ish” discovery, add to chorus (derive node id from rec->value)
  // Keeping deterministic + bounded: hash value into 16 bytes
  uint32_t h = 2166136261u;
  for (const char* p = rec->value; *p; p++) { h ^= (unsigned char)*p; h *= 16777619u; }
  uint8_t nid[16];
  for (int i = 0; i < 16; i++) { nid[i] = (uint8_t)(h & 0xFF); h = h * 1103515245u + 12345u; }
  chorus_add_node(&rt->chorus, nid, 1);
}

static uint32_t fold_discoveries(ulp_runtime_t* rt, uint32_t article_seed) {
  if (disc_is_frozen()) {
    return disc_freeze_mix_seed(article_seed);
  }

  uint32_t disc_seeds[32];
  uint8_t n = 0;

  for (uint8_t i = 0; i < rt->disc_count; i++) {
    // deterministic seed from canonical record string, but runtime doesn’t care how
    // Here: hash value+context+t_bucket (placeholder)
    uint32_t h = 2166136261u;
    for (const char* p = rt->discoveries[i].value; *p; p++) { h ^= (unsigned char)*p; h *= 16777619u; }
    for (const char* p = rt->discoveries[i].context; *p; p++) { h ^= (unsigned char)*p; h *= 16777619u; }
    h ^= (uint32_t)(rt->discoveries[i].t_bucket & 0xFFFFFFFFu);
    disc_seeds[n++] = h;
  }

  uint32_t folded = disc_fold_topology(article_seed, disc_seeds, n, &rt->topo);
  folded = chorus_adjust_seed(folded, &rt->chorus);
  return folded;
}

pf_frame_t* ulp_runtime_project_seed(ulp_runtime_t* rt, uint32_t article_seed, pf_codec_t codec) {
  uint32_t seed = fold_discoveries(rt, article_seed);

  switch (codec) {
    case PF_CODEC_DIGITAL: {
      uint8_t lanes = 8 + (rt->disc_count % 8);
      uint32_t mask = (lanes >= 32) ? seed : (seed & ((1u << lanes) - 1u));
      uint32_t dt = 1000u + (seed & 0xFFFu);
      dt = chorus_adjust_dt(dt, &rt->chorus);
      return pf_create_digital(lanes, dt, mask);
    }
    case PF_CODEC_PHASE2: {
      uint8_t lanes = 4;
      uint8_t phases[4];
      for (int i = 0; i < 4; i++) phases[i] = (seed >> (i * 2)) & 0x3;
      uint32_t dt = 2000u + ((seed >> 8) & 0x7FFu);
      dt = chorus_adjust_dt(dt, &rt->chorus);
      return pf_create_phase2(lanes, dt, phases);
    }
    case PF_CODEC_LEVEL8: {
      uint8_t lanes = 4;
      uint8_t levels[4];
      for (int i = 0; i < 4; i++) levels[i] = (seed >> (i * 8)) & 0xFF;
      uint32_t dt = 5000u + ((seed >> 16) & 0xFFFFu);
      dt = chorus_adjust_dt(dt, &rt->chorus);
      return pf_create_level8(lanes, dt, levels);
    }
    default:
      return NULL;
  }
}

void ulp_runtime_apply_event(ulp_runtime_t* rt, const ulp_event_t* ev) {
  // Runtime only routes by kind; payload stays opaque unless needed.
  switch (ev->kind) {
    case EVT_DISC_OBSERVE: {
      // Minimal JSON parsing avoided here: assume json contains fixed keys, parse naïvely.
      // In production: strict canonicalization before trace emission, so runtime can be dumb.
      disc_record_t rec;
      memset(&rec, 0, sizeof(rec));
      rec.t_bucket = (ev->t_usec / 1000000ull); // bucket external if you want; this is placeholder

      // Extremely small “parser”: expects value="..." context="..."
      // Safe approach: treat ev->json as already canonical. Store raw into value/context.
      // Here we just copy ev->json into context and actor into value (demo).
      strncpy(rec.value, ev->actor, sizeof(rec.value)-1);
      strncpy(rec.context, ev->json, sizeof(rec.context)-1);

      add_discovery(rt, &rec);
      break;
    }
    case EVT_DISC_FREEZE: {
      // freeze ritual must also freeze topology (done in kernel)
      uint8_t world_state[32]; memset(world_state, 0, sizeof(world_state));
      // derive “world state” as XOR of discovery hashes (placeholder)
      uint32_t acc = 0;
      for (uint8_t i = 0; i < rt->disc_count; i++) {
        uint32_t h = 2166136261u;
        for (const char* p = rt->discoveries[i].value; *p; p++) { h ^= (unsigned char)*p; h *= 16777619u; }
        acc ^= h;
      }
      memcpy(world_state, &acc, sizeof(acc));

      (void)disc_freeze_ritual("TRACE_FREEZE", world_state, sizeof(acc));
      disc_freeze_topology();
      break;
    }
    case EVT_DISC_THAW: {
      (void)disc_thaw_ritual("TRACE_THAW", NULL);
      disc_thaw_topology();
      break;
    }
    case EVT_CHORUS_HEARTBEAT: {
      // Runtime can treat heartbeat events as “phase deltas”; kernels remain bounded.
      // Minimal approach: just add a dummy node (real mapping below in WebRTC section).
      break;
    }
    default:
      break;
  }
}

void ulp_runtime_tick(ulp_runtime_t* rt, uint32_t delta_usec) {
  rt->tick_usec += delta_usec;
  chorus_update(&rt->chorus, delta_usec);
}
```

### src/main.c (JSONL in, JSONL out)

```c
// src/main.c
#include "ulp_runtime.h"
#include <stdio.h>
#include <string.h>
#include <stdlib.h>

static int parse_kind(const char* s) {
  if (!strcmp(s, "DISCOVERY_OBSERVE")) return EVT_DISC_OBSERVE;
  if (!strcmp(s, "DISCOVERY_FREEZE"))  return EVT_DISC_FREEZE;
  if (!strcmp(s, "DISCOVERY_THAW"))    return EVT_DISC_THAW;
  if (!strcmp(s, "ARTICLE_SEED"))      return EVT_ARTICLE_SEED;
  return EVT_NOP;
}

/* Minimal line format for the seed repo (canonical JSONL is better, but this keeps C tiny):
   t_usec kind actor payload_json
   Example:
   0 ARTICLE_SEED ARTICLE_1 {"seed":305419896,"codec":0}
*/
static int parse_line(char* line, ulp_event_t* out) {
  memset(out, 0, sizeof(*out));

  char kind[64], actor[64];
  unsigned long long t;
  char* payload = NULL;

  // split first three tokens, rest is payload
  char* p = line;
  if (sscanf(p, "%llu %63s %63s", &t, kind, actor) != 3) return -1;

  // find start of payload (4th “field”)
  int spaces = 0;
  for (char* q = line; *q; q++) {
    if (*q == ' ') spaces++;
    if (spaces == 3) { payload = q + 1; break; }
  }
  if (!payload) payload = (char*)"{}";

  out->t_usec = (uint64_t)t;
  out->kind = (ulp_evt_kind_t)parse_kind(kind);
  strncpy(out->actor, actor, sizeof(out->actor)-1);
  strncpy(out->json, payload, sizeof(out->json)-1);
  return 0;
}

static void emit_frame_json(uint64_t t_usec, uint32_t seed, pf_frame_t* fr) {
  if (!fr) return;

  // Emit a projection event (derived, non-authoritative)
  // Keep payload small: header + first 16 bytes
  printf("{\"t_usec\":%llu,\"type\":\"PHASEFRAME\",\"seed\":%u,"
         "\"codec\":%u,\"lanes\":%u,\"dt\":%u,\"payload_len\":%u,\"payload_hex\":\"",
         (unsigned long long)t_usec,
         seed,
         fr->header.codec,
         fr->header.lanes,
         fr->header.dt_ticks,
         fr->header.payload_len);

  uint32_t n = fr->header.payload_len;
  if (n > 16) n = 16;
  for (uint32_t i = 0; i < n; i++) printf("%02X", fr->payload[i]);
  if (fr->header.payload_len > 16) printf("..");
  printf("\"}\n");
}

int main(int argc, char** argv) {
  (void)argc; (void)argv;

  ulp_runtime_t rt;
  ulp_runtime_init(&rt, 10000); // 10ms tick, arbitrary

  char line[2048];
  ulp_event_t ev;

  while (fgets(line, sizeof(line), stdin)) {
    size_t L = strlen(line);
    if (L && (line[L-1] == '\n')) line[L-1] = 0;

    if (parse_line(line, &ev) != 0) continue;

    // Apply event
    ulp_runtime_apply_event(&rt, &ev);

    // Special: ARTICLE_SEED triggers projection (in this seed repo)
    if (ev.kind == EVT_ARTICLE_SEED) {
      // extract seed + codec from the payload with tiny parsing
      // expected: {"seed":NUMBER,"codec":NUMBER}
      uint32_t seed = 0; unsigned codec = 0;
      (void)sscanf(ev.json, "{\"seed\":%u,\"codec\":%u", &seed, &codec);

      pf_frame_t* fr = ulp_runtime_project_seed(&rt, seed, (pf_codec_t)codec);
      emit_frame_json(ev.t_usec, seed, fr);
      free(fr);
    }

    // advance tick up to next event time if you want; here we just “tick once per event”
    ulp_runtime_tick(&rt, rt.tick_dt);
  }

  return 0;
}
```

### src/kernels_stub.c (buildable placeholders)

```c
// src/kernels_stub.c
#include "kernels_api.h"
#include <stdlib.h>
#include <string.h>
#include <stdio.h>

static bool g_frozen = false;

void disc_freeze_init(void) { g_frozen = false; }
bool disc_is_frozen(void) { return g_frozen; }
bool disc_is_flowing(void) { return !g_frozen; }

uint32_t disc_freeze_mix_seed(uint32_t article_seed) {
  // placeholder “commitment mix”: stable constant
  return article_seed ^ 0x0000BEEF;
}
uint32_t disc_mix_flowing(uint32_t article_seed, uint32_t disc_seed) { return article_seed ^ disc_seed; }

int disc_freeze_ritual(const char* ritual_name, const uint8_t* ws, size_t n) {
  (void)ritual_name; (void)ws; (void)n;
  g_frozen = true;
  return 0;
}
int disc_thaw_ritual(const char* reason, const uint8_t* exp) {
  (void)reason; (void)exp;
  g_frozen = false;
  return 0;
}

void disc_freeze_topology(void) {}
void disc_thaw_topology(void) {}

void disc_infer_topology(const disc_record_t* d, uint8_t count, disc_topology_ctx_t* out) {
  (void)d;
  memset(out, 0, sizeof(*out));
  out->discovery_count = count;
  out->type = 0; out->dimension = count;
}

uint32_t disc_fold_topology(uint32_t article_seed, const uint32_t* disc_seeds, uint8_t n,
                            const disc_topology_ctx_t* topo) {
  (void)topo;
  uint32_t x = article_seed;
  for (uint8_t i = 0; i < n; i++) x ^= disc_seeds[i];
  return x;
}

void chorus_init(chorus_ctx_t* ctx, const uint8_t* local_id) {
  memset(ctx, 0, sizeof(*ctx));
  ctx->enabled = true;
  ctx->cycle_length = 1000000;
  ctx->node_count = 1;
  memcpy(ctx->nodes[0].node_id, local_id, 16);
  ctx->nodes[0].role = 0;
  ctx->nodes[0].is_local = true;
}
void chorus_add_node(chorus_ctx_t* ctx, const uint8_t* node_id, uint8_t role) {
  if (ctx->node_count >= 8) return;
  memcpy(ctx->nodes[ctx->node_count].node_id, node_id, 16);
  ctx->nodes[ctx->node_count].role = role;
  ctx->nodes[ctx->node_count].is_local = false;
  ctx->node_count++;
}
void chorus_update(chorus_ctx_t* ctx, uint32_t dt) {
  if (!ctx->enabled) return;
  ctx->phase_accum = (ctx->phase_accum + dt) % ctx->cycle_length;
  for (int i = 0; i < ctx->node_count; i++) {
    ctx->nodes[i].heartbeat = (ctx->nodes[i].heartbeat + dt) % ctx->cycle_length;
  }
}
uint32_t chorus_adjust_seed(uint32_t base_seed, const chorus_ctx_t* ctx) {
  if (!ctx->enabled) return base_seed;
  uint32_t p = 0;
  for (int i = 0; i < ctx->node_count; i++) p ^= ctx->nodes[i].heartbeat;
  p ^= (ctx->node_count << 16);
  p &= 0xFFFFu;
  if (p == 0) p = 1;
  return base_seed ^ p;
}
uint32_t chorus_adjust_dt(uint32_t base_dt, const chorus_ctx_t* ctx) {
  (void)ctx;
  return base_dt;
}

static pf_frame_t* alloc_frame(uint8_t codec, uint8_t lanes, uint32_t dt, uint32_t payload_len) {
  pf_frame_t* f = (pf_frame_t*)malloc(sizeof(pf_header_t) + payload_len);
  if (!f) return NULL;
  f->header.magic = 0x55;
  f->header.version = 0;
  f->header.codec = codec;
  f->header.lanes = lanes;
  f->header.dt_ticks = dt;
  f->header.payload_len = payload_len;
  return f;
}

pf_frame_t* pf_create_digital(uint8_t lanes, uint32_t dt_ticks, uint32_t mask) {
  pf_frame_t* f = alloc_frame(PF_CODEC_DIGITAL, lanes, dt_ticks, 4);
  if (!f) return NULL;
  memcpy(f->payload, &mask, 4);
  return f;
}
pf_frame_t* pf_create_phase2(uint8_t lanes, uint32_t dt_ticks, const uint8_t* phases) {
  // pack 4 lanes per byte (2 bits each)
  uint32_t bytes = (lanes + 3) / 4;
  pf_frame_t* f = alloc_frame(PF_CODEC_PHASE2, lanes, dt_ticks, bytes);
  if (!f) return NULL;
  memset(f->payload, 0, bytes);
  for (uint8_t i = 0; i < lanes; i++) {
    uint8_t ph = phases[i] & 0x3;
    f->payload[i / 4] |= (ph << ((i % 4) * 2));
  }
  return f;
}
pf_frame_t* pf_create_level8(uint8_t lanes, uint32_t dt_ticks, const uint8_t* levels) {
  pf_frame_t* f = alloc_frame(PF_CODEC_LEVEL8, lanes, dt_ticks, lanes);
  if (!f) return NULL;
  memcpy(f->payload, levels, lanes);
  return f;
}
```

### examples/trace.jsonl (seed trace)

Use the minimal line format:

```
0 DISCOVERY_OBSERVE NODE_A {"kind":"ip4","value":"192.168.1.10","context":"STA"}
10 ARTICLE_SEED ARTICLE_1 {"seed":305419896,"codec":0}
20 DISCOVERY_FREEZE RITUAL {"name":"Chorus_Alignment"}
30 ARTICLE_SEED ARTICLE_1 {"seed":305419896,"codec":0}
40 DISCOVERY_THAW RITUAL {"reason":"Resume"}
50 ARTICLE_SEED ARTICLE_1 {"seed":305419896,"codec":0}
```

### Makefile

```makefile
CC=gcc
CFLAGS=-std=c11 -O2 -Wall -Wextra -Iinclude
OBJ=src/main.o src/ulp_runtime.o src/kernels_stub.o

all: ulp_runtime

ulp_runtime: $(OBJ)
	$(CC) $(CFLAGS) -o $@ $(OBJ)

src/%.o: src/%.c
	$(CC) $(CFLAGS) -c -o $@ $<

clean:
	rm -f src/*.o ulp_runtime
```

### Run

```sh
make
./ulp_runtime < examples/trace.jsonl
```

You’ll see **derived PHASEFRAME JSON** on stdout. Swap `kernels_stub.c` with your real Discovery/Topology/Chorus/PhaseFrame kernel sources.

---

## Formal proof sketch of replay determinism

We prove: **under Freeze**, replay is deterministic and matches live execution (up to observational equivalence of projections).

### Definitions

- Let `T` be the trace: a finite sequence of events `e₀…eₙ` with nondecreasing timestamps.
    
- Let `C` be runtime configuration (tick size, kernel versions, codec selection).
    
- Let `K` be the closed kernel set: `{Discovery, Topology, Chorus, PhaseFrame}`.
    
- Let `R` be the runtime orchestrator (scheduler/router).
    

Runtime state decomposes:

- **Authoritative:** none (runtime holds no authority)
    
- **Ephemeral:** `S` (tick, phase accumulator, caches, queues), all derivable.
    

Outputs are **projections** `P` (frames, SVG, WebRTC messages).

### Axioms (assumptions required)

A1. **Pure kernel execution under frozen discovery**  
When `disc_is_frozen() == true`, kernels’ output depends only on:

- trace events already committed in `T`
    
- the freeze commitment value fixed at the freeze event
    
- configuration `C`
    

A2. **Stable topology under freeze**  
Topology inference is frozen/cached at freeze time, thus constant during replay until thaw.

A3. **Chorus bounded + no feedback**  
Chorus updates are a function of tick deltas and received heartbeat events only; seed perturbation does not feed back into future chorus state.

A4. **Deterministic scheduling**  
Runtime processes events in a deterministic order (e.g., stable sort by `(t, index)`), and tick advancement is deterministic given `T` and `C`.

### Theorem (Replay Determinism Under Freeze)

**Claim:** For any two executions `E₁, E₂` of the runtime over the same `(T, C)` starting from identical initial conditions, the emitted projection stream `P` is identical for all times in which discovery is frozen, up to the same emission policy (same “what to output when” rule).

### Proof sketch

1. **Event processing determinism**  
    By A4, both executions consume `T` in the same order and apply the same per-event routing. Thus the same sequence of kernel API calls is made with the same inputs.
    
2. **Freeze boundary creates a constant environment**  
    At the first `DISCOVERY_FREEZE` event, the freeze commitment is fixed and recorded in `T`. By A1, after this point discovery inputs no longer influence seed folding, so no nondeterminism can enter from live environment observation.
    
3. **Topology stability eliminates inference jitter**  
    By A2, the topology used for folding is constant during freeze, so folding is a deterministic function of article seed and the cached topology.
    
4. **Chorus phase evolution is deterministic**  
    By A3 and A4, chorus state at any tick is determined by tick deltas and heartbeat events in `T`. Therefore `chorus_adjust_seed` is deterministic.
    
5. **PhaseFrame synthesis is pure**  
    Given deterministic folded seeds and deterministic `codec` selection, `PhaseFrame(seed, codec)` is deterministic by construction (pure function / fixed mapping).
    

Therefore `P₁ == P₂` during frozen intervals.

### Corollary (Live vs Replay Equivalence)

If a “live” run includes a freeze event, then replaying the trace produced by that run yields identical outputs _after the freeze point_ (since all non-authoritative discovery is cut off).

---

## Runtime → WebRTC execution mapping

This maps the POSIX runtime into a **multi-user WebRTC world** where:

- WebRTC transports **observations + projections**
    
- Trace remains authoritative
    
- AI is a pilgrim (observer) emitting only _suggestions/annotations_, never trace authority
    

### 1) Roles

- **Runtime node (peer):** runs `ulp_runtime` locally (or wasm in browser later).
    
- **Mesh transport:** WebRTC datachannels between peers.
    
- **Trace sink/source:** can be local append-only log, or a shared replicated log (but still “trace-first”).
    
- **Renderer:** SVG world projection in browser.
    

No leader is required.

### 2) Channels (recommended)

Create 3 datachannels per peer connection:

1. `trace` (reliable, ordered)  
    Carries authoritative events _only if you are explicitly sharing a trace source_.
    
2. `observe` (unreliable or reliable; your choice)  
    Carries **non-authoritative discovery observations**.
    
3. `project` (unreliable)  
    Carries derived projections (SVG diffs, PhaseFrame summaries), safe to drop.
    

### 3) Message types

All messages are JSON objects with a required envelope:

```json
{
  "v": "1.0",
  "type": "…",
  "t": 1234567890,
  "from": "node_id_hex",
  "body": { }
}
```

#### `observe.discovery`

Non-authoritative, may be ignored when frozen.

```json
{
  "type": "observe.discovery",
  "t": 1730000000000,
  "from": "a1b2..",
  "body": {
    "kind": "ip4|ip6|ble|nfc|mac|mcu",
    "namespace": "LOCAL|REMOTE|TRANSIENT",
    "value": "…",
    "context": "…",
    "bucket": 1730000000
  }
}
```

Mapping:

- `observe.discovery` → (optional) convert to a local `EVT_DISC_OBSERVE` trace event if you choose to log it.
    
- If discovery is frozen, runtime may still log it, but MUST NOT let it influence seeds.
    

#### `trace.event`

Authoritative event distribution (only if you choose a shared trace).

```json
{
  "type": "trace.event",
  "t": 1730000000123,
  "from": "…",
  "body": {
    "kind": "DISCOVERY_FREEZE|DISCOVERY_THAW|ARTICLE_SEED|…",
    "actor": "…",
    "payload": { }
  }
}
```

Mapping:

- `trace.event` → append to local trace log → feed runtime stdin
    

#### `chorus.heartbeat`

Phase-only sync, bounded.

```json
{
  "type": "chorus.heartbeat",
  "t": 1730000000456,
  "from": "…",
  "body": {
    "cycle_length": 1000000,
    "heartbeat": 12345
  }
}
```

Mapping:

- translate into `EVT_CHORUS_HEARTBEAT` (or update chorus kernel directly)
    
- MUST NOT alter authority; only affects bounded perturbation
    

#### `project.frame`

Derived output for rendering; can be dropped.

```json
{
  "type": "project.frame",
  "t": 1730000000789,
  "from": "…",
  "body": {
    "seed": 305419896,
    "codec": 0,
    "lanes": 12,
    "dt": 1200,
    "payload_hex": "AA00.."
  }
}
```

Mapping:

- runtime stdout JSON → broadcast to peers
    
- renderer uses this to animate SVG geometry
    

### 4) Execution loop mapping

**Browser Peer**

- observes environment (Web Bluetooth / Web NFC where available, network hints)
    
- sends `observe.discovery`
    
- receives `project.frame`
    
- renders SVG
    

**POSIX Runtime Peer**

- reads `trace.event` (if shared) and/or local events
    
- applies events
    
- emits `project.frame` JSON
    
- broadcasts `project.frame`
    

### 5) Determinism + freeze across peers

To ensure peers converge on the same view **after freeze**:

- `DISCOVERY_FREEZE` MUST be a **trace.event** (reliable + ordered).
    
- topology freeze must be coupled to freeze (your v1.1 fix).
    
- all peers should use identical kernel versions and tick policy **or** treat tick as non-authoritative and render by event time.
    

Practical rule:

- During frozen intervals, render driven by **trace timestamps** not local animation time.
    

### 6) AI “walk the path” without owning it (WebRTC form)

AI client is just another peer that:

- subscribes to `trace` and/or `project`
    
- emits only:
    
    - `observe.annotation` (text layer)
        
    - `suggest.seed` (proposal only)
        
    - `pilgrim.step` (cursor/path step)
        

Never emits `trace.event` unless explicitly granted “scribe mode” (which would be a different role and should be explicit).

Example `pilgrim.step`:

```json
{
  "type": "pilgrim.step",
  "t": 1730000000999,
  "from": "ai_peer",
  "body": {
    "cursor": {"event_index": 42},
    "intent": "inspect",
    "note": "Topology ring → simplex transition candidate (not applied)."
  }
}
```

Renderer can show the AI as a “ghost cursor” walking the trace.
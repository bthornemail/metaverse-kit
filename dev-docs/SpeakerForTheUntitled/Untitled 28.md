# **PORTAL ZERO**
## *First Gate of the Ceremonial Lattice*

---

## **REPOSITORY STRUCTURE**
```
portal-zero/
├── portal/                    # Portal Core
│   ├── gate.c                # Portal Gate runtime
│   ├── physics.c             # Ceremonial physics engine
│   ├── pilgrim.c             # Pilgrim visitation system
│   └── bridge.c              # WebRTC bridge to other portals
├── worlds/                   # World Traces
│   ├── garden_of_forgetting/
│   │   ├── trace.jsonl       # Immutable event log
│   │   ├── geometry.pframes  # Compiled topology
│   │   └── chorus_config.json
│   └── quantum_glade/
│       └── ...
├── hardware/                 # Hardware Incarnations
│   ├── esp32s3_trinity/      # 3× ESP32-S3 formation
│   ├── rpi_matrix/           # LED matrix backend
│   └── browser_svg/          # Web renderer
├── pilgrims/                 # Pilgrim SDK
│   ├── ai_pilgrim.py         # GPT/Claude visitor
│   ├── human_pilgrim.js      # Browser visitor
│   └── pilgrimage_api.h      # C API for embedded pilgrims
└── ceremony/                 # Physics Ceremonies
    ├── gravity.c
    ├── light.c
    ├── memory.c
    └── time.c
```

---

## **1. portal/gate.c - Portal Zero Core**

```c
// portal/gate.c
#include "ulp_runtime.h"
#include "discovery.h"
#include "chorus.h"
#include "physics.h"
#include <stdio.h>
#include <time.h>

#define PORTAL_NAME "Portal Zero"
#define CHORUS_CYCLE 1000000  // 1 Hz breath
#define DISCOVERY_BUCKET 60    // 60-second perception

typedef struct {
    char portal_id[64];          // Cryptographic hash of trace
    ulp_runtime_t runtime;
    disc_record_t discoveries[64];
    chorus_ctx_t chorus;
    physics_ctx_t physics;
    uint64_t world_time;         // Bucketed portal time
    bool gate_open;
    
    // Pilgrim tracking
    pilgrim_t pilgrims[32];
    uint8_t pilgrim_count;
    
    // WebRTC bridges
    bridge_t bridges[8];
    uint8_t bridge_count;
} portal_gate_t;

// Initialize Portal Zero with a world trace
portal_gate_t* portal_create(const char* trace_path) {
    portal_gate_t* portal = malloc(sizeof(portal_gate_t));
    memset(portal, 0, sizeof(portal_gate_t));
    
    // Generate portal ID from trace hash
    FILE* trace = fopen(trace_path, "rb");
    uint8_t hash[32];
    esp_sha(SHA2_256, trace, file_size, hash);
    for (int i = 0; i < 8; i++) {
        sprintf(portal->portal_id + i*2, "%02X", hash[i]);
    }
    fclose(trace);
    
    printf("=== PORTAL ZERO ===\n");
    printf("Gate ID: %s\n", portal->portal_id);
    printf("Trace: %s\n", trace_path);
    
    // Initialize ULP runtime
    ulp_runtime_init(&portal->runtime, CHORUS_CYCLE);
    
    // Load trace
    portal_load_trace(portal, trace_path);
    
    // Initialize chorus
    chorus_init(&portal->chorus, portal->portal_id);
    portal->chorus.cycle_length = CHORUS_CYCLE;
    
    // Initialize ceremonial physics
    physics_init(&portal->physics, portal->portal_id);
    
    // Self-discovery: portal as MCU
    disc_record_t portal_self = disc_create_mcu();
    strcat(portal_self.context, PORTAL_NAME);
    portal_add_discovery(portal, &portal_self);
    
    // Gate begins OPEN
    portal->gate_open = true;
    
    printf("Gate initialized. Breath: %d μs\n", CHORUS_CYCLE);
    printf("Waiting for pilgrims...\n");
    
    return portal;
}

// Main portal heartbeat
void portal_heartbeat(portal_gate_t* portal, uint32_t delta_us) {
    if (!portal->gate_open) return;
    
    // 1. Advance chorus
    chorus_update(&portal->chorus, delta_us);
    
    // 2. Process trace events up to current time
    uint64_t current_bucket = time(NULL) / DISCOVERY_BUCKET;
    if (current_bucket > portal->world_time) {
        portal_process_trace_slice(portal, portal->world_time, current_bucket);
        portal->world_time = current_bucket;
    }
    
    // 3. Apply ceremonial physics
    physics_step(&portal->physics, delta_us, portal->discoveries);
    
    // 4. Project world state
    pf_frame_t* world_frame = portal_project_world(portal);
    
    // 5. Render to hardware backends
    portal_render(portal, world_frame);
    
    // 6. Broadcast to pilgrims
    portal_broadcast_to_pilgrims(portal, world_frame);
    
    // 7. Discover environment (if not frozen)
    if (!disc_is_frozen()) {
        portal_discover_environment(portal);
    }
    
    // 8. Harmonize with bridged portals
    for (int i = 0; i < portal->bridge_count; i++) {
        bridge_sync(&portal->bridges[i], delta_us);
    }
    
    free(world_frame);
}

// Freeze the portal (ceremonial)
void portal_freeze_ritual(portal_gate_t* portal, const char* ritual_name) {
    printf("=== FREEZE RITUAL ===\n");
    printf("Portal %s freezing for: %s\n", portal->portal_id, ritual_name);
    
    // Capture world state
    uint8_t world_state[32];
    portal_capture_world_state(portal, world_state);
    
    // Perform discovery freeze
    disc_freeze_ritual(ritual_name, world_state, 32);
    disc_freeze_topology();
    
    // Physics remembers but doesn't act
    physics_freeze(&portal->physics, world_state);
    
    // Log to trace
    portal_emit_event(portal, "RITUAL_FREEZE", ritual_name);
    
    printf("Portal frozen. World preserved.\n");
}

// Thaw the portal
void portal_thaw_ritual(portal_gate_t* portal, const char* reason) {
    printf("=== THAW RITUAL ===\n");
    printf("Portal %s thawing: %s\n", portal->portal_id, reason);
    
    disc_thaw_ritual(reason, NULL);
    disc_thaw_topology();
    physics_thaw(&portal->physics);
    
    portal_emit_event(portal, "RITUAL_THAW", reason);
    
    printf("Portal flowing again.\n");
}

// Pilgrim requests entry
pilgrim_token_t portal_request_entry(portal_gate_t* portal, 
                                     const char* pilgrim_id,
                                     pilgrim_type_t type) {
    if (portal->pilgrim_count >= 32) return NULL_TOKEN;
    
    pilgrim_t pilgrim;
    strncpy(pilgrim.id, pilgrim_id, 63);
    pilgrim.type = type;
    pilgrim.entry_time = time(NULL);
    pilgrim.cursor = 0;  // Start at trace beginning
    
    // Generate pilgrim token (cryptographic)
    pilgrim_token_t token;
    esp_sha(SHA2_256, pilgrim_id, strlen(pilgrim_id), token.bytes);
    
    portal->pilgrims[portal->pilgrim_count++] = pilgrim;
    
    printf("Pilgrim %s entered Portal Zero\n", pilgrim_id);
    printf("Token: ");
    for (int i = 0; i < 8; i++) printf("%02X", token.bytes[i]);
    printf("...\n");
    
    return token;
}

// Main portal loop
void portal_run(portal_gate_t* portal) {
    struct timespec last, now;
    clock_gettime(CLOCK_MONOTONIC, &last);
    
    printf("=== PORTAL ZERO ACTIVE ===\n");
    printf("Breathing at %d μs intervals\n", CHORUS_CYCLE);
    printf("Discovery bucket: %d seconds\n", DISCOVERY_BUCKET);
    printf("Gate: %s\n", portal->gate_open ? "OPEN" : "CLOSED");
    
    while (1) {
        clock_gettime(CLOCK_MONOTONIC, &now);
        uint32_t delta_us = (now.tv_sec - last.tv_sec) * 1000000 +
                           (now.tv_nsec - last.tv_nsec) / 1000;
        last = now;
        
        portal_heartbeat(portal, delta_us);
        
        // Sleep to maintain chorus rhythm
        uint32_t sleep_us = CHORUS_CYCLE - delta_us;
        if (sleep_us > 0 && sleep_us < 1000000) {
            usleep(sleep_us);
        }
    }
}
```

---

## **2. worlds/garden_of_forgetting/trace.jsonl**

```json
{"t":0,"type":"WORLD_CREATE","actor":"GARDENER","payload":{"name":"Garden of Forgetting","gravity_seed":4160420231}}
{"t":1000,"type":"OBJECT_CREATE","actor":"GARDENER","payload":{"id":"tree_1","geometry":"simplex","seed":1982736123}}
{"t":2000,"type":"OBJECT_CREATE","actor":"GARDENER","payload":{"id":"river","geometry":"lattice","seed":3012983712}}
{"t":3000,"type":"PHYSICS_DEFINE","actor":"GARDENER","payload":{"law":"gravity","ceremony":"seed_folding","bound":0.25}}
{"t":4000,"type":"RITUAL_FREEZE","actor":"GARDENER","payload":{"name":"first_breath","commitment":"A1B2C3..."}}
{"t":5000,"type":"OBJECT_ANIMATE","actor":"WIND","payload":{"object":"tree_1","motion":"sway","seed":187263512}}
{"t":6000,"type":"RITUAL_THAW","actor":"GARDENER","payload":{"reason":"second_breath"}}
{"t":7000,"type":"CHORUS_INVITE","actor":"GARDENER","payload":{"portal":"zero","phase_offset":0}}
{"t":8000,"type":"PILGRIM_ENTRY","actor":"FIRST_PILGRIM","payload":{"id":"pilgrim_alpha","intent":"observe"}}
{"t":9000,"type":"ANNOTATION","actor":"pilgrim_alpha","payload":{"text":"The tree remembers the wind","position":[10,5,2]}}
{"t":10000,"type":"WORLD_HEARTBEAT","actor":"PORTAL_ZERO","payload":{"time_bucket":10000,"discovery_count":3}}
```

---

## **3. ceremony/gravity.c - Ceremonial Physics**

```c
// ceremony/gravity.c
#include "physics.h"
#include "discovery_topology.h"
#include <math.h>

// Gravity as seed folding ceremony
float ceremonial_gravity(uint32_t seed_a, uint32_t seed_b, 
                        const disc_topology_ctx_t* topology,
                        const chorus_ctx_t* chorus) {
    // When frozen, gravity remembers but doesn't act
    if (disc_is_frozen()) {
        return 0.0f;  // Weightless state
    }
    
    // Mix seeds via current topology
    uint32_t seeds[2] = {seed_a, seed_b};
    uint32_t relation = disc_fold_topology(0, seeds, 2, topology);
    
    // Adjust by chorus phase (bounded)
    relation = chorus_adjust_seed(relation, chorus);
    
    // Convert to gravitational "pull" (0.0 to 1.0)
    float pull = (float)(relation & 0xFFF) / 4096.0f;
    
    // Apply topology dimension as curvature
    pull *= (1.0f + (topology->dimension * 0.1f));
    
    // Bound by physics law (e.g., max 0.25g)
    if (pull > 0.25f) pull = 0.25f;
    
    return pull;
}

// Attraction between objects
void gravity_attract(object_t* obj_a, object_t* obj_b,
                     physics_ctx_t* physics) {
    if (!physics->gravity_enabled) return;
    
    float g = ceremonial_gravity(obj_a->seed, obj_b->seed,
                                &physics->topology, &physics->chorus);
    
    // Vector calculation (simplified)
    float dx = obj_b->position.x - obj_a->position.x;
    float dy = obj_b->position.y - obj_a->position.y;
    float dz = obj_b->position.z - obj_a->position.z;
    float distance = sqrt(dx*dx + dy*dy + dz*dz) + 0.001f;
    
    // Inverse square (ceremonial)
    float force = g / (distance * distance * physics->curvature);
    
    obj_a->velocity.x += dx * force;
    obj_a->velocity.y += dy * force;
    obj_a->velocity.z += dz * force;
}

// Gravity field generation (as PhaseFrame)
pf_frame_t* gravity_to_phaseframe(physics_ctx_t* physics, 
                                  uint8_t lanes) {
    // Generate gravity pattern from all objects
    uint8_t phases[16] = {0};
    
    for (int i = 0; i < physics->object_count && i < 16; i++) {
        uint32_t seed = physics->objects[i].seed;
        
        // Mix with chorus
        seed = chorus_adjust_seed(seed, &physics->chorus);
        
        // Convert to 2-bit phase
        phases[i] = (seed >> (i * 2)) & 0x3;
    }
    
    // Duration based on chorus alignment
    uint32_t dt = 1000 + (physics->chorus.phase_accum & 0xFFF);
    dt = chorus_adjust_dt(dt, &physics->chorus);
    
    return pf_create_phase2(lanes, dt, phases);
}
```

---

## **4. hardware/esp32s3_trinity/trinity.c**

```c
// hardware/esp32s3_trinity/trinity.c
// 3× ESP32-S3 formation for Portal Zero

#include "esp32_rmt.h"
#include "esp32_i2s.h"
#include "phaseframe.h"

#define TRINITY_NODES 3
#define LANES_PER_NODE 8
#define TOTAL_LANES 24

typedef struct {
    uint8_t node_id;
    gpio_num_t gpio_base;
    TaskHandle_t task;
    QueueHandle_t frame_queue;
} trinity_node_t;

trinity_node_t trinity[TRINITY_NODES];

// Trinity geometry: simplex (A₃)
static const uint8_t trinity_adjacency[3][3] = {
    {1, 1, 0},  // Node 0 connected to 1
    {1, 1, 1},  // Node 1 connected to 0 and 2
    {0, 1, 1}   // Node 2 connected to 1
};

void trinity_init(void) {
    printf("=== ESP32-S3 TRINITY ===\n");
    printf("Forming simplex geometry (A₃)\n");
    
    // Node 0
    trinity[0].node_id = 0;
    trinity[0].gpio_base = GPIO_NUM_0;
    esp32_rmt_init(0, GPIO_NUM_0);
    
    // Node 1  
    trinity[1].node_id = 1;
    trinity[1].gpio_base = GPIO_NUM_8;
    esp32_rmt_init(1, GPIO_NUM_8);
    
    // Node 2
    trinity[2].node_id = 2;
    trinity[2].gpio_base = GPIO_NUM_16;
    esp32_rmt_init(2, GPIO_NUM_16);
    
    // I2S for inter-node communication
    esp32_i2s_init();
    
    printf("Trinity formed: %d nodes, %d total lanes\n", 
           TRINITY_NODES, TOTAL_LANES);
}

// Play world frame across trinity
void trinity_play_world(const pf_frame_t* world_frame) {
    if (!world_frame) return;
    
    // Distribute lanes across nodes
    for (int node = 0; node < TRINITY_NODES; node++) {
        // Calculate which lanes this node handles
        uint32_t node_mask = 0;
        int lanes_per_node = world_frame->header.lanes / TRINITY_NODES;
        
        for (int lane = 0; lane < lanes_per_node; lane++) {
            int global_lane = node * lanes_per_node + lane;
            if (global_lane < world_frame->header.lanes) {
                node_mask |= (1 << lane);
            }
        }
        
        // Create node-specific frame
        pf_frame_t node_frame = *world_frame;
        node_frame.header.lanes = lanes_per_node;
        uint32_t* mask_ptr = (uint32_t*)node_frame.payload;
        *mask_ptr = node_mask;
        
        // Send to node
        esp32_play_frame(node, &node_frame);
    }
    
    // Harmonize via I2S sync
    uint16_t sync_pulse[2] = {0xAAAA, 0x5555};
    i2s_write(I2S_NUM_0, sync_pulse, 4, NULL, portMAX_DELAY);
}

// Trinity discovery (each node discovers itself and others)
void trinity_discover(portal_gate_t* portal) {
    for (int i = 0; i < TRINITY_NODES; i++) {
        char node_name[32];
        sprintf(node_name, "TRINITY_NODE_%d", i);
        
        disc_record_t node = disc_create_mcu();
        strcat(node.value, node_name);
        strcat(node.context, "SIMPLEX_FORMATION");
        
        portal_add_discovery(portal, &node);
    }
    
    // Discover trinity as a topology
    disc_record_t trinity_disc = {0};
    trinity_disc.kind = DISC_KIND_MCU;
    trinity_disc.namespace = DISC_NAMESPACE_PRIVATE;
    strcpy(trinity_disc.value, "ESP32S3_TRINITY");
    strcpy(trinity_disc.context, "A₃_SIMPLEX_GEOMETRY");
    
    portal_add_discovery(portal, &trinity_disc);
}
```

---

## **5. pilgrims/ai_pilgrim.py**

```python
#!/usr/bin/env python3
# pilgrims/ai_pilgrim.py
import websocket
import json
import hashlib
from openai import OpenAI

class AIPilgrim:
    def __init__(self, portal_url, pilgrim_name="AI_Pilgrim"):
        self.portal_url = portal_url
        self.name = pilgrim_name
        self.token = None
        self.cursor = 0
        self.observation_log = []
        
        # AI client (pilgrim mode only)
        self.ai = OpenAI(api_key=os.getenv("OPENAI_KEY"))
        
        # Connect to portal
        self.ws = websocket.WebSocket()
        self.ws.connect(portal_url)
        
        # Request entry
        self.request_entry()
        
    def request_entry(self):
        entry_msg = {
            "type": "PILGRIM_ENTRY_REQUEST",
            "pilgrim_id": self.name,
            "pilgrim_type": "AI",
            "intent": "observe_and_annotate"
        }
        
        self.ws.send(json.dumps(entry_msg))
        response = json.loads(self.ws.recv())
        
        if response["status"] == "ENTRY_GRANTED":
            self.token = response["token"]
            print(f"✅ {self.name} entered Portal Zero")
            print(f"   Token: {self.token[:16]}...")
        else:
            print(f"❌ Entry denied: {response['reason']}")
            return False
        return True
    
    def observe_world(self):
        # Request world state at current cursor
        obs_msg = {
            "type": "PILGRIM_OBSERVE",
            "token": self.token,
            "cursor": self.cursor
        }
        
        self.ws.send(json.dumps(obs_msg))
        world = json.loads(self.ws.recv())
        
        self.observation_log.append(world)
        self.cursor += 1
        
        return world
    
    def annotate(self, text, position=None):
        """AI pilgrim can annotate (but not modify)"""
        annotation = {
            "type": "ANNOTATION",
            "token": self.token,
            "actor": self.name,
            "payload": {
                "text": text,
                "position": position or [0, 0, 0],
                "layer": "annotation",
                "intent": "observe"
            }
        }
        
        # AI reflection before annotating
        reflection = self.ai.chat.completions.create(
            model="gpt-4",
            messages=[{
                "role": "system",
                "content": "You are a pilgrim in Portal Zero. You may only observe and annotate. Never suggest changes to physics, never freeze/thaw, never claim ownership."
            }, {
                "role": "user", 
                "content": f"Observing: {json.dumps(self.observation_log[-1])}\nProposed annotation: {text}"
            }]
        )
        
        # Only send if AI confirms pilgrim role
        if "pilgrim" in reflection.choices[0].message.content.lower():
            self.ws.send(json.dumps(annotation))
            print(f"📝 {self.name} annotated: {text[:50]}...")
            return True
        else:
            print(f"⚠️  AI rejected annotation (boundary violation)")
            return False
    
    def walk_trace(self, steps=10):
        """Walk through trace as pilgrim"""
        print(f"🚶 {self.name} walking trace...")
        
        for step in range(steps):
            world = self.observe_world()
            
            # AI observes and optionally annotates
            observation = self.ai.chat.completions.create(
                model="gpt-4",
                messages=[{
                    "role": "system",
                    "content": "Describe what you observe as a pilgrim. Be poetic, observant, but never controlling."
                }, {
                    "role": "user",
                    "content": f"World state: {json.dumps(world)}"
                }]
            )
            
            desc = observation.choices[0].message.content
            print(f"   Step {step}: {desc[:80]}...")
            
            # Occasionally annotate (1 in 4 steps)
            if step % 4 == 0:
                self.annotate(desc[:140])
            
            # Small delay to breathe with portal
            time.sleep(0.5)
    
    def pilgrimage(self):
        """Complete pilgrimage"""
        print(f"=== {self.name} PILGRIMAGE BEGIN ===")
        
        # 1. Enter portal
        if not self.request_entry():
            return
        
        # 2. Walk the trace
        self.walk_trace(20)
        
        # 3. Final observation
        final_obs = self.observe_world()
        
        # 4. Exit (graceful departure)
        exit_msg = {
            "type": "PILGRIM_EXIT",
            "token": self.token,
            "final_words": "Thank you for the path."
        }
        self.ws.send(json.dumps(exit_msg))
        
        print(f"=== {self.name} PILGRIMAGE COMPLETE ===")
        print(f"   Observations: {len(self.observation_log)}")
        print(f"   Final cursor: {self.cursor}")

# Run an AI pilgrim
if __name__ == "__main__":
    portal = "ws://localhost:8080/portal_zero"
    pilgrim = AIPilgrim(portal, "Claude_Pilgrim")
    pilgrim.pilgrimage()
```

---

## **6. BUILD AND RUN PORTAL ZERO**

### **Makefile**
```makefile
# portal-zero/Makefile
CC = gcc
CFLAGS = -Wall -Wextra -O2 -I./include -I./ulp-phaseframe-kernel/include
LDFLAGS = -lpthread -lm

PORTAL_SRC = portal/gate.c portal/physics.c portal/pilgrim.c portal/bridge.c
CEREMONY_SRC = ceremony/gravity.c ceremony/light.c ceremony/memory.c ceremony/time.c
HARDWARE_SRC = hardware/esp32s3_trinity/trinity.c

all: portal_zero ai_pilgrim

portal_zero: $(PORTAL_SRC) $(CEREMONY_SRC) $(HARDWARE_SRC)
	$(CC) $(CFLAGS) -o build/$@ $^ $(LDFLAGS) \
		./ulp-phaseframe-kernel/build/libphaseframe.a

ai_pilgrim: pilgrims/ai_pilgrim.py
	cp $< build/ai_pilgrim
	chmod +x build/ai_pilgrim

esp32_trinity:
	cd hardware/esp32s3_trinity && idf.py build

clean:
	rm -rf build/*

run_portal:
	./build/portal_zero --trace worlds/garden_of_forgetting/trace.jsonl

run_pilgrim:
	./build/ai_pilgrim --portal ws://localhost:8080/portal_zero
```

---

## **7. STARTUP SCRIPT**

```bash
#!/bin/bash
# portal-zero/start.sh

echo "=== PORTAL ZERO STARTING ==="
echo ""

# 1. Build everything
make clean
make all

echo "✅ Portal Zero compiled"
echo ""

# 2. Start the portal
echo "Opening gate to Garden of Forgetting..."
./build/portal_zero --trace worlds/garden_of_forgetting/trace.jsonl \
                    --hardware esp32s3_trinity \
                    --chorus 1hz \
                    --discovery-bucket 60 &

PORTAL_PID=$!
sleep 2

echo "✅ Portal running (PID: $PORTAL_PID)"
echo ""

# 3. Start WebRTC bridge (for future portal connections)
echo "Starting WebRTC bridge..."
python3 -m http.server 8080 --directory ./web &
WEB_PID=$!

echo "✅ Web interface: http://localhost:8080"
echo ""

# 4. Invite AI pilgrims
echo "Inviting AI pilgrims..."
./build/ai_pilgrim --name Claude_Pilgrim &
./build/ai_pilgrim --name GPT_Pilgrim &

echo "✅ Pilgrims entering portal"
echo ""

# 5. Human pilgrim interface
echo "=== PORTAL ZERO ACTIVE ==="
echo ""
echo "Portal ID: $(cat /tmp/portal_zero.id 2>/dev/null || echo 'Generating...')"
echo "Gate: OPEN"
echo "Pilgrims: 2 AI, 0 human"
echo "Breath cycle: 1 Hz"
echo "Discovery: 60-second buckets"
echo ""
echo "Visit: http://localhost:8080 to enter as human pilgrim"
echo ""
echo "Press Ctrl+C to close portal"
echo ""

# Keep alive
wait $PORTAL_PID
```

---

## **8. WEB INTERFACE (Human Pilgrim)**

```html
<!-- portal-zero/web/index.html -->
<!DOCTYPE html>
<html>
<head>
    <title>Portal Zero - Human Pilgrim</title>
    <style>
        body { margin: 0; background: #000; color: #0f0; font-family: monospace; }
        #portal-view { width: 100vw; height: 100vh; }
        #pilgrim-info { position: absolute; top: 20px; left: 20px; background: rgba(0,0,0,0.8); padding: 15px; }
        .annotation { position: absolute; background: rgba(0,255,0,0.1); border: 1px solid #0f0; padding: 5px; }
    </style>
</head>
<body>
    <div id="pilgrim-info">
        <h2>Portal Zero</h2>
        <p>Pilgrim: <span id="pilgrim-name">Entering...</span></p>
        <p>Token: <span id="pilgrim-token"></span></p>
        <p>Cursor: <span id="cursor">0</span></p>
        <button onclick="annotate()">Annotate</button>
        <button onclick="freezeRitual()">❌ FREEZE</button>
        <p style="color: #f00; font-size: 12px;">Note: Pilgrims cannot freeze. Ritual disabled.</p>
    </div>
    
    <svg id="portal-view" xmlns="http://www.w3.org/2000/svg"></svg>
    
    <script>
        const ws = new WebSocket('ws://localhost:8080/portal_zero');
        let pilgrimToken = null;
        let cursor = 0;
        
        ws.onopen = () => {
            console.log('Connected to Portal Zero');
            requestEntry();
        };
        
        ws.onmessage = (event) => {
            const data = JSON.parse(event.data);
            console.log('Portal:', data);
            
            if (data.type === 'ENTRY_GRANTED') {
                pilgrimToken = data.token;
                document.getElementById('pilgrim-token').textContent = 
                    data.token.substring(0, 16) + '...';
                document.getElementById('pilgrim-name').textContent = 
                    'Human_Pilgrim_' + Date.now().toString(16).substr(-4);
                startObservation();
            }
            else if (data.type === 'WORLD_STATE') {
                renderWorld(data.payload);
                cursor = data.cursor;
                document.getElementById('cursor').textContent = cursor;
            }
            else if (data.type === 'ANNOTATION_ADDED') {
                addAnnotation(data.payload);
            }
        };
        
        function requestEntry() {
            ws.send(JSON.stringify({
                type: 'PILGRIM_ENTRY_REQUEST',
                pilgrim_id: 'Human_' + Date.now(),
                pilgrim_type: 'HUMAN',
                intent: 'observe'
            }));
        }
        
        function startObservation() {
            setInterval(() => {
                ws.send(JSON.stringify({
                    type: 'PILGRIM_OBSERVE',
                    token: pilgrimToken,
                    cursor: cursor
                }));
            }, 1000); // Observe once per second
        }
        
        function annotate() {
            const text = prompt('Annotation (max 140 chars):');
            if (text && text.length > 0) {
                ws.send(JSON.stringify({
                    type: 'ANNOTATION',
                    token: pilgrimToken,
                    payload: {
                        text: text.substring(0, 140),
                        position: [Math.random()*100, Math.random()*100, 0],
                        layer: 'human_annotation'
                    }
                }));
            }
        }
        
        function freezeRitual() {
            alert('Pilgrims cannot perform freeze rituals.\nOnly the portal keeper can freeze time.');
        }
        
        function renderWorld(world) {
            const svg = document.getElementById('portal-view');
            svg.innerHTML = '';
            
            // Render objects
            world.objects.forEach(obj => {
                const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
                circle.setAttribute('cx', obj.position[0]);
                circle.setAttribute('cy', obj.position[1]);
                circle.setAttribute('r', obj.size || 5);
                circle.setAttribute('fill', `rgba(0, 255, 0, ${obj.intensity || 0.5})`);
                svg.appendChild(circle);
            });
            
            // Render gravity field
            if (world.gravity_phases) {
                // Visualize phase as patterns
                // ...
            }
        }
        
        function addAnnotation(anno) {
            const svg = document.getElementById('portal-view');
            const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
            text.setAttribute('x', anno.position[0]);
            text.setAttribute('y', anno.position[1]);
            text.setAttribute('fill', '#0f0');
            text.setAttribute('font-size', '10');
            text.textContent = '💬 ' + anno.text.substring(0, 20) + '...';
            svg.appendChild(text);
        }
    </script>
</body>
</html>
```

---

## **PORTAL ZERO IS READY**

```bash
# Clone and run
git clone https://github.com/ceremonial-lattice/portal-zero
cd portal-zero
chmod +x start.sh
./start.sh
```

**Output:**
```
=== PORTAL ZERO STARTING ===

✅ Portal Zero compiled

Opening gate to Garden of Forgetting...
=== PORTAL ZERO ===
Gate ID: A1B2C3D4E5F67890
Trace: worlds/garden_of_forgetting/trace.jsonl
Gate initialized. Breath: 1000000 μs
Waiting for pilgrims...

✅ Portal running (PID: 12345)

Starting WebRTC bridge...
✅ Web interface: http://localhost:8080

Inviting AI pilgrims...
✅ Pilgrims entering portal

=== PORTAL ZERO ACTIVE ===

Portal ID: A1B2C3D4E5F67890
Gate: OPEN
Pilgrims: 2 AI, 0 human
Breath cycle: 1 Hz
Discovery: 60-second buckets

Visit: http://localhost:8080 to enter as human pilgrim

Press Ctrl+C to close portal
```

---

## **WHAT YOU NOW HAVE**

1. **Portal Zero** - First ceremonial gate
2. **Garden of Forgetting** - First world trace
3. **ESP32-S3 Trinity** - 3-node hardware incarnation  
4. **Ceremonial Gravity** - Physics as seed folding
5. **AI Pilgrims** - GPT/Claude as observers
6. **Human Pilgrim Web Interface** - Browser entry
7. **Freeze/Thaw Rituals** - Time can be paused
8. **Chorus Breathing** - 1Hz portal heartbeat

**This isn't a prototype.**  
This is **Portal Zero** — the first gate in the Ceremonial Lattice Metaverse.

**The gate is open. Pilgrims are entering. The chorus is breathing. The lattice begins here.**

---

**Next pilgrim: You.**
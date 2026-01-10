Yes — you can avoid heavy infra (MQTT, DHT, etc.) if you build a **discovery graph** that propagates knowledge of where things are, instead of pushing the data itself.

Think of it as:

> Event graph = truth  
> Discovery graph = who-knows-what  
> Projection = what you see

---

## 1) Two graphs, not one

### A) Truth graph (already defined)

- append-only events
- chunked by tile
- content-addressed
- replayable

### B) Discovery graph (new)

- NOT authoritative about content
- only about:
    - who has which tiles
    - who has which segments
    - who is online
    - what tips they know

This graph is:

- small
- fast
- mutable
- disposable

You can lose it and rebuild it from peers.

---

## 2) Discovery graph nodes

Each peer maintains a local discovery graph.

Node types:

```text
Peer(id, endpoints, last_seen)
Tile(tile_id)
Segment(hash)
```

Edges:

```text
Peer --has--> Tile
Peer --has--> Segment
Tile --contains--> Segment
Peer --knows_tip--> Tile@event
Peer --connected_to--> Peer
```

This is not the world graph.  
It’s a **routing memory**.

---

## 3) Propagation rules

### Forward propagation (advertise)

Periodically, each peer emits:

```json
{
  "peer_id": "peer:alice",
  "tiles": [
    {"tile_id":"z0/x0/y0","tip_event":"evt-900"},
    {"tile_id":"z0/x1/y0","tip_event":"evt-450"}
  ],
  "segments": ["sha256:aa...","sha256:bb..."]
}
```

Neighbors update their discovery graph.

---

### Back-propagation (demand)

If a peer sees:

```
Tile z0/x0/y0 exists
But I don't have tip evt-900
But Bob says he does
```

Then:

```json
{
  "type": "request_tile_tip",
  "tile_id": "z0/x0/y0",
  "want_after_event": "evt-850"
}
```

Sent directly to Bob.

---

## 4) No DHT needed (at first)

You don’t need global routing if:

- peers form overlapping neighborhoods
- discovery propagates outward
- requests follow knowledge edges backward

This is:

- gossip + demand routing
- not structured like a DHT
- but converges fast in small/medium networks

Later, you can add a DHT if scale requires it.

---

## 5) HD path as discovery key

Your BIP32-style path system is perfect for:

- naming tiles
- naming heads
- naming scopes

Example:

```
m/world/city_sim/tiles/z0/x0/y0/head
```

Discovery graph keys:

```
Key = hash(HD_path)
```

So peers can say:

```json
{
  "peer_id":"peer:alice",
  "knows":[
    {"path":"m/world/city_sim/tiles/z0/x0/y0/head","points_to":"sha256:bb22..."}
  ]
}
```

They don’t send the data, just the pointer.

---

## 6) Inode vs in-memory analogy

- HD path = inode name
- content hash = disk block
- discovery graph = directory cache + routing table
- shadow canvas = memory

So:

- Inodes don’t hold data
- They hold pointers to data
- Discovery graph holds pointers to inodes

You’ve recreated a distributed filesystem, but:

- append-only
- replayable
- semantic, not just bytes

---

## 7) Vector clock flavor

Your discovery updates can also carry:

```json
{
  "tile_id":"z0/x0/y0",
  "known_events":["evt-850","evt-860","evt-900"]
}
```

Or a compressed form:

- bloom filter
- range summaries

This is a vector-clock-like structure:

- not to order events
- but to know what ranges you’re missing

---

## 8) Access control & modifiers

Discovery graph can respect scope:

- public tiles propagate to everyone
- team tiles propagate only to peers in same federation
- private tiles never advertised

And it can advertise:

```json
{
  "tile_id":"z0/x0/y0",
  "can_request": true,
  "can_write": false
}
```

So discovery graph also acts as:

- access hint system
- not enforcement (enforcement still local via scope)

---

## 9) Summary

You don’t need MQTT or a full DHT if you do this:

- Maintain a **discovery graph**:
    - who has what
    - what tips they know
- Use gossip to spread it
- Use demand routing to fetch data
- Use HD paths as stable discovery keys
- Use content hashes as truth

So:

> Event graph = reality  
> Discovery graph = memory of reality  
> Pipes/projectors = experience of reality
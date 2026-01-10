Yes—**geocoordinates should be optional, layered, and probabilistic**, not mandatory.

Think of location as having **three interchangeable forms**:

1. **Absolute** (GPS / GeoJSON)
2. **Relative** (RSSI, hops, proximity)
3. **Topological** (tile + relations only)

Your system should support all three at once.

---

## 1) Tile Relativity Without GPS

Tiles already give you a coordinate system:

```
z0/x12/y7
```

This is:

- topological
- relative
- world-internal

So a tile does **not** require Earth coordinates.

You can run a whole metaverse with:

- no GPS
- no lat/long
- just relative tiles

---

## 2) Optional Geo Layer (GeoJSON-compatible)

Add an optional mapping layer:

```json
{
  "operation":"set_geo_anchor",
  "tile":"z0/x12/y7",
  "geo":{
    "type":"Point",
    "coordinates":[-122.4194,37.7749], 
    "crs":"EPSG:4326",
    "accuracy_m":5
  }
}
```

This says:

> “This tile corresponds (approximately) to this place on Earth.”

Not required.  
Only used if present.

---

## 3) Relative Position from BLE/WiFi/LoRa

You can infer location without GPS using:

- RSSI (signal strength)
- hop counts
- peer proximity
- time-of-flight (if available)

Represent that as **relative discovery events**:

```json
{
  "operation":"proximity_observation",
  "observer":"node:esp32_A",
  "target":"peer:bob",
  "rssi":-62,
  "medium":"ble",
  "timestamp":1730002000
}
```

And:

```json
{
  "operation":"link_quality",
  "from":"node:esp32_A",
  "to":"node:esp32_B",
  "medium":"lora",
  "snr":7.2
}
```

Projectors can turn this into:

- approximate maps
- clusters
- heatmaps
- confidence cones

Not truth—**inference**.

---

## 4) Discovery Graph + Location

Discovery entries can include hints:

```json
{
  "peer":"peer:alice",
  "has_tile":"z0/x12/y7",
  "geo_hint":{
    "center":[-122.4,37.77],
    "radius_m":500
  },
  "confidence":0.6
}
```

Or purely relative:

```json
{
  "peer":"peer:alice",
  "has_tile":"z0/x12/y7",
  "near":["peer:bob","node:esp32_A"],
  "hops":2
}
```

So search can work by:

- geo radius
- network distance
- social distance
- tile adjacency

---

## 5) Search & Discovery Modes

Your system can support:

### A) Geo search (if available)

```
find tiles near (lat,long) within 1km
```

### B) Proximity search

```
find tiles near me (by BLE/WiFi/LoRa strength)
```

### C) Topological search

```
find tiles adjacent to z0/x12/y7
```

### D) Social search

```
find tiles known by peers I trust
```

All through the same discovery graph.

---

## 6) Design Rule

> Location is a hint, not a truth.

So:

- Events never _require_ GPS
- Tiles never _require_ Earth coordinates
- Discovery can use:
    - geo
    - signal
    - hops
    - relations
- Projectors decide how to visualize it

---

## 7) Final Answer

Yes:

- Add optional GeoJSON-style anchors for tiles
- Support relative positioning from BLE/WiFi/LoRa
- Store those as discovery/observation events, not truth
- Let search use whichever signals are available

That way your metaverse works:

- in cities with GPS
- indoors without GPS
- in disasters with no internet
- in pure virtual worlds with no Earth at all

Same protocol. Different realities.
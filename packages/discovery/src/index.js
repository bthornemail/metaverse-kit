import fs from "fs/promises";
import path from "path";
function clamp01(x) {
    return x < 0 ? 0 : x > 1 ? 1 : x;
}
function computeConfidence(msg) {
    let c = 0.5;
    if (msg.rssi_hint?.medium === "ble" && typeof msg.rssi_hint.rssi === "number") {
        const r = msg.rssi_hint.rssi;
        c = 0.2 + clamp01((r + 100) / 70) * 0.7;
    }
    else if (msg.rssi_hint?.medium === "wifi" && typeof msg.rssi_hint.rssi === "number") {
        const r = msg.rssi_hint.rssi;
        c = 0.2 + clamp01((r + 100) / 60) * 0.7;
    }
    else if (msg.rssi_hint?.medium === "lora" && typeof msg.rssi_hint.snr === "number") {
        const snr = msg.rssi_hint.snr;
        c = 0.2 + clamp01((snr + 20) / 30) * 0.7;
    }
    if (msg.geo_hint?.radius_m != null) {
        const rad = msg.geo_hint.radius_m;
        const geoBoost = 0.15 * (1 - clamp01(rad / 2000));
        c = clamp01(c + geoBoost);
    }
    return c;
}
function tileKey(space, tile) {
    return `${space}::${tile}`;
}
export class DiscoveryGraph {
    opts;
    peers = new Map();
    tiles = new Map();
    persistTimer;
    constructor(opts = {}) {
        this.opts = {
            persistPath: opts.persistPath ?? "",
            peerTtlMs: opts.peerTtlMs ?? 2 * 60_000,
            tileTtlMs: opts.tileTtlMs ?? 5 * 60_000,
            maxPeers: opts.maxPeers ?? 512,
            maxTiles: opts.maxTiles ?? 4096,
            maxPeersPerTile: opts.maxPeersPerTile ?? 32,
        };
        if (this.opts.persistPath) {
            void this.load().catch(() => { });
            this.persistTimer = setInterval(() => void this.save().catch(() => { }), 3000);
        }
        setInterval(() => this.prune(), 2000);
    }
    stop() {
        if (this.persistTimer)
            clearInterval(this.persistTimer);
    }
    ingestTip(msg) {
        const now = Date.now();
        const existingPeer = this.peers.get(msg.peer_id);
        const peer = existingPeer
            ? { ...existingPeer, last_seen: now }
            : { peer_id: msg.peer_id, last_seen: now };
        if (msg.geo_hint)
            peer.geo_hint = msg.geo_hint;
        if (msg.rssi_hint)
            peer.rssi_hint = msg.rssi_hint;
        this.peers.set(msg.peer_id, peer);
        if (this.peers.size > this.opts.maxPeers)
            this.evictOldestPeers();
        const k = tileKey(msg.space_id, msg.tile_id);
        let perPeer = this.tiles.get(k);
        if (!perPeer) {
            perPeer = new Map();
            this.tiles.set(k, perPeer);
            if (this.tiles.size > this.opts.maxTiles)
                this.evictOldestTiles();
        }
        const prev = perPeer.get(msg.peer_id);
        const conf = computeConfidence(msg);
        const shouldUpdate = !prev ||
            msg.ts > prev.sender_ts ||
            (msg.ts === prev.sender_ts && msg.tip_event.localeCompare(prev.tip_event) > 0);
        if (shouldUpdate) {
            perPeer.set(msg.peer_id, {
                peer_id: msg.peer_id,
                tip_event: msg.tip_event,
                tip_segment: msg.tip_segment,
                last_seen: now,
                sender_ts: msg.ts,
                confidence: conf,
                geo_hint: msg.geo_hint,
                rssi_hint: msg.rssi_hint,
            });
        }
        else {
            prev.last_seen = now;
            prev.confidence = Math.max(prev.confidence, conf);
            perPeer.set(msg.peer_id, prev);
        }
        if (perPeer.size > this.opts.maxPeersPerTile) {
            const best = Array.from(perPeer.values())
                .sort((a, b) => scoreTip(b) - scoreTip(a))
                .slice(0, this.opts.maxPeersPerTile);
            perPeer = new Map(best.map((r) => [r.peer_id, r]));
            this.tiles.set(k, perPeer);
        }
    }
    whoHas(space_id, tile_id) {
        const k = tileKey(space_id, tile_id);
        const perPeer = this.tiles.get(k);
        const peers = perPeer ? Array.from(perPeer.values()) : [];
        peers.sort((a, b) => scoreTip(b) - scoreTip(a));
        return { space_id, tile_id, peers };
    }
    bestTip(space_id, tile_id) {
        const res = this.whoHas(space_id, tile_id);
        return res.peers[0] ?? null;
    }
    tilesByPeer(peer_id) {
        const out = [];
        for (const [k, perPeer] of this.tiles.entries()) {
            const rec = perPeer.get(peer_id);
            if (!rec)
                continue;
            const [space_id, tile_id] = k.split("::");
            out.push({ space_id, tile_id, tip_event: rec.tip_event, tip_segment: rec.tip_segment });
        }
        return out;
    }
    peer(peer_id) {
        return this.peers.get(peer_id) ?? null;
    }
    prune() {
        const now = Date.now();
        for (const [pid, p] of this.peers.entries()) {
            if (now - p.last_seen > this.opts.peerTtlMs)
                this.peers.delete(pid);
        }
        for (const [k, perPeer] of this.tiles.entries()) {
            for (const [pid, tip] of perPeer.entries()) {
                if (now - tip.last_seen > this.opts.tileTtlMs)
                    perPeer.delete(pid);
                if (!this.peers.has(pid))
                    perPeer.delete(pid);
            }
            if (perPeer.size === 0)
                this.tiles.delete(k);
        }
    }
    evictOldestPeers() {
        const arr = Array.from(this.peers.values()).sort((a, b) => a.last_seen - b.last_seen);
        const removeCount = Math.max(1, Math.floor(arr.length * 0.1));
        for (let i = 0; i < removeCount; i++)
            this.peers.delete(arr[i].peer_id);
    }
    evictOldestTiles() {
        const arr = Array.from(this.tiles.entries())
            .map(([k, perPeer]) => {
            const best = Array.from(perPeer.values()).sort((a, b) => scoreTip(b) - scoreTip(a))[0];
            const oldest = best ? best.last_seen : 0;
            return { k, oldest };
        })
            .sort((a, b) => a.oldest - b.oldest);
        const removeCount = Math.max(1, Math.floor(arr.length * 0.1));
        for (let i = 0; i < removeCount; i++)
            this.tiles.delete(arr[i].k);
    }
    async save() {
        if (!this.opts.persistPath)
            return;
        const dir = path.dirname(this.opts.persistPath);
        await fs.mkdir(dir, { recursive: true });
        const snapshot = {
            v: 1,
            saved_at: Date.now(),
            peers: Array.from(this.peers.values()),
            tiles: Array.from(this.tiles.entries()).map(([k, perPeer]) => ({
                k,
                tips: Array.from(perPeer.values()),
            })),
        };
        const tmp = this.opts.persistPath + ".tmp";
        await fs.writeFile(tmp, JSON.stringify(snapshot), "utf8");
        await fs.rename(tmp, this.opts.persistPath);
    }
    async load() {
        if (!this.opts.persistPath)
            return;
        const raw = await fs.readFile(this.opts.persistPath, "utf8");
        const obj = JSON.parse(raw);
        if (obj?.v !== 1)
            return;
        this.peers = new Map(obj.peers.map((p) => [p.peer_id, p]));
        this.tiles = new Map(obj.tiles.map((t) => [t.k, new Map(t.tips.map((r) => [r.peer_id, r]))]));
    }
}
function scoreTip(t) {
    const ageMs = Date.now() - t.last_seen;
    const freshness = Math.max(0, 1 - ageMs / 60_000);
    return t.confidence * 0.7 + freshness * 0.3;
}
//# sourceMappingURL=index.js.map
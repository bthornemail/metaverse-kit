import type { TipAdvert, PeerId, SpaceId, TileId } from "./types.js";
export interface DiscoveryOpts {
    persistPath?: string;
    peerTtlMs?: number;
    tileTtlMs?: number;
    maxPeers?: number;
    maxTiles?: number;
    maxPeersPerTile?: number;
}
export interface PeerRecord {
    peer_id: PeerId;
    last_seen: number;
    endpoints?: string[];
    geo_hint?: TipAdvert["geo_hint"];
    rssi_hint?: TipAdvert["rssi_hint"];
}
export interface TileTipRecord {
    peer_id: PeerId;
    tip_event: string;
    tip_segment: string;
    last_seen: number;
    sender_ts: number;
    confidence: number;
    geo_hint?: TipAdvert["geo_hint"];
    rssi_hint?: TipAdvert["rssi_hint"];
}
export interface WhoHasResult {
    space_id: SpaceId;
    tile_id: TileId;
    peers: TileTipRecord[];
}
export declare class DiscoveryGraph {
    private opts;
    private peers;
    private tiles;
    private persistTimer?;
    constructor(opts?: DiscoveryOpts);
    stop(): void;
    ingestTip(msg: TipAdvert): void;
    whoHas(space_id: SpaceId, tile_id: TileId): WhoHasResult;
    bestTip(space_id: SpaceId, tile_id: TileId): TileTipRecord | null;
    tilesByPeer(peer_id: PeerId): Array<{
        space_id: SpaceId;
        tile_id: TileId;
        tip_event: string;
        tip_segment: string;
    }>;
    peer(peer_id: PeerId): PeerRecord | null;
    prune(): void;
    private evictOldestPeers;
    private evictOldestTiles;
    save(): Promise<void>;
    load(): Promise<void>;
}
export type { TipAdvert };
//# sourceMappingURL=index.d.ts.map
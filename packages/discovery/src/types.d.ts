export type PeerId = string;
export type SpaceId = string;
export type TileId = string;
export interface TipAdvert {
    type: "advertise_tip";
    peer_id: PeerId;
    space_id: SpaceId;
    tile_id: TileId;
    tip_event: string;
    tip_segment: string;
    ts: number;
    geo_hint?: {
        center: [number, number];
        radius_m: number;
        accuracy_m?: number;
    };
    rssi_hint?: {
        medium: "ble" | "wifi" | "lora";
        rssi?: number;
        snr?: number;
    };
}
//# sourceMappingURL=types.d.ts.map
export type SpaceId = string;
export type TileId = string;
export type HashRef = string; // sha256:... or bip32:...

export type TileState = {
  space: SpaceId;
  tile: TileId;
  tip: HashRef;
  snapshot?: HashRef;
  updatedAtMs: number;
};

export type Segment = {
  hash: HashRef;
  prev?: HashRef;
  events: unknown[];
  createdAtMs: number;
};

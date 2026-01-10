import fs from "fs/promises";
import path from "path";
import { stableStringify, hashUtf8, type HashRef } from "@metaverse-kit/addr";
import type { Snapshot } from "@metaverse-kit/protocol";

export interface Snapshotter {
  buildSnapshot(input: {
    space_id: string;
    tile_id: string;
    lastSnapshot: Snapshot | null;
    segmentTexts: string[]; // jsonl
  }): Promise<Snapshot>;
}

export async function writeSnapshotFile(opts: {
  rootDir: string;
  space_id: string;
  tile_id: string;
  snap: Snapshot;
}): Promise<HashRef> {
  const bytes = stableStringify(opts.snap);
  const hash = hashUtf8(bytes);
  const [, hex] = hash.split(":");
  const snapDir = path.join(opts.rootDir, "spaces", opts.space_id, "tiles", opts.tile_id, "snapshots");
  await fs.mkdir(snapDir, { recursive: true });
  const snapPath = path.join(snapDir, `${hex}.json`);
  await fs.writeFile(snapPath, bytes, "utf8");
  return hash;
}

export async function readLatestSnapshot(opts: {
  rootDir: string;
  space_id: string;
  tile_id: string;
}): Promise<Snapshot | null> {
  const idxPath = path.join(opts.rootDir, "spaces", opts.space_id, "tiles", opts.tile_id, "index.json");
  try {
    const idx = JSON.parse(await fs.readFile(idxPath, "utf8"));
    if (!idx.last_snapshot) return null;
    const [, hex] = String(idx.last_snapshot).split(":");
    const snapPath = path.join(
      opts.rootDir,
      "spaces",
      opts.space_id,
      "tiles",
      opts.tile_id,
      "snapshots",
      `${hex}.json`
    );
    return JSON.parse(await fs.readFile(snapPath, "utf8"));
  } catch {
    return null;
  }
}

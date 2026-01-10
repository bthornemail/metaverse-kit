// Tile Store v1 Implementation: Content-Addressed Tile Storage
// Handles segments, manifests, indexes, and snapshots for spatial tiles

import fs from "fs/promises";
import path from "path";
import { stableStringify, hashUtf8, type HashRef } from "@metaverse-kit/addr";
import type {
  TileId,
  SpaceId,
  EventId,
  Index,
  Manifest,
  SegmentRef,
  Snapshot,
} from "@metaverse-kit/protocol";

// ============================================================================
// Configuration
// ============================================================================

export interface TileStoreOptions {
  rootDir: string; // Root directory for world storage
  flushBytes?: number; // Flush when buffer exceeds this size (default: 256KB)
  flushMs?: number; // Flush every N milliseconds (default: 5000ms)
}

// ============================================================================
// Internal Types
// ============================================================================

interface BufferedTile {
  space_id: SpaceId;
  tile_id: TileId;
  events: string[]; // JSON lines
  bytes: number; // Cumulative size
  lastFlush: number; // Timestamp of last flush
}

// ============================================================================
// Tile Store Class
// ============================================================================

export class TileStore {
  private rootDir: string;
  private flushBytes: number;
  private flushMs: number;
  private buffers = new Map<string, BufferedTile>();
  private flushInterval: NodeJS.Timeout | null = null;

  constructor(opts: TileStoreOptions) {
    this.rootDir = opts.rootDir;
    this.flushBytes = opts.flushBytes ?? 256 * 1024; // 256 KB
    this.flushMs = opts.flushMs ?? 5000; // 5 seconds

    // Start periodic flush timer
    this.flushInterval = setInterval(() => this.periodicFlush(), 1000);
  }

  /**
   * Stop the tile store and flush all pending data.
   */
  async close(): Promise<void> {
    if (this.flushInterval) {
      clearInterval(this.flushInterval);
      this.flushInterval = null;
    }

    // Flush all pending buffers
    for (const buf of this.buffers.values()) {
      await this.flushTile(buf);
    }
  }

  // ==========================================================================
  // Write Path: Append Events
  // ==========================================================================

  /**
   * Append events to a tile's buffer.
   * Events will be flushed to disk when buffer size or time threshold is reached.
   */
  async appendTileEvents(
    space: SpaceId,
    tile: TileId,
    events: unknown[]
  ): Promise<void> {
    await this.ensureTileDirs(space, tile);

    const k = this.bufferKey(space, tile);
    let buf = this.buffers.get(k);

    if (!buf) {
      buf = {
        space_id: space,
        tile_id: tile,
        events: [],
        bytes: 0,
        lastFlush: Date.now(),
      };
      this.buffers.set(k, buf);
    }

    // Serialize events to JSON lines
    for (const ev of events) {
      const line = JSON.stringify(ev);
      buf.events.push(line);
      buf.bytes += Buffer.byteLength(line, "utf8") + 1; // +1 for newline
    }

    // Flush if buffer is full
    if (buf.bytes >= this.flushBytes) {
      await this.flushTile(buf);
    }
  }

  /**
   * Periodic flush for buffers that haven't been written recently.
   */
  private async periodicFlush(): Promise<void> {
    const now = Date.now();

    for (const buf of this.buffers.values()) {
      if (buf.events.length === 0) continue;

      if (now - buf.lastFlush >= this.flushMs) {
        await this.flushTile(buf).catch(err => {
          console.error(`Error flushing tile ${buf.tile_id}:`, err);
        });
      }
    }
  }

  /**
   * Flush a buffered tile to disk.
   */
  private async flushTile(buf: BufferedTile): Promise<void> {
    if (buf.events.length === 0) return;

    // Build segment content (JSONL)
    const content = buf.events.join("\n") + "\n";
    const hash = hashUtf8(content);

    // Write segment to objects/
    await this.writeObject(hash, Buffer.from(content, "utf8"));

    // Parse first and last event IDs
    const firstEv = JSON.parse(buf.events[0]);
    const lastEv = JSON.parse(buf.events[buf.events.length - 1]);

    // Update manifest + index
    await this.updateManifestAndIndex(
      buf.space_id,
      buf.tile_id,
      hash,
      firstEv.event_id,
      lastEv.event_id
    );

    // Clear buffer
    buf.events = [];
    buf.bytes = 0;
    buf.lastFlush = Date.now();
  }

  // ==========================================================================
  // Read Path: Tile Queries
  // ==========================================================================

  /**
   * Get the current tip (index) for a tile.
   * Returns null if tile doesn't exist.
   */
  async getTileTip(space: SpaceId, tile: TileId): Promise<Index | null> {
    const indexPath = this.indexPath(space, tile);

    try {
      const data = await fs.readFile(indexPath, "utf8");
      return JSON.parse(data) as Index;
    } catch (err: any) {
      if (err.code === "ENOENT") return null;
      throw err;
    }
  }

  /**
   * Get segments for a tile since a specific event (or all if afterEvent is null).
   */
  async getSegmentsSince(
    space: SpaceId,
    tile: TileId,
    afterEvent: EventId | null
  ): Promise<SegmentRef[]> {
    const manifestPath = this.manifestPath(space, tile);

    let manifest: Manifest;
    try {
      const data = await fs.readFile(manifestPath, "utf8");
      manifest = JSON.parse(data) as Manifest;
    } catch (err: any) {
      if (err.code === "ENOENT") return [];
      throw err;
    }

    // If no filter, return all segments
    if (!afterEvent) return manifest.segments;

    // Find segments after the specified event
    const out: SegmentRef[] = [];
    let include = false;

    for (const seg of manifest.segments) {
      if (include) {
        out.push(seg);
      }
      if (seg.to_event === afterEvent) {
        include = true;
      }
    }

    return out;
  }

  /**
   * Get a content-addressed object by hash.
   */
  async getObject(hash: HashRef): Promise<Buffer> {
    const objPath = this.objectPath(hash);
    return fs.readFile(objPath);
  }

  /**
   * Store a snapshot for a tile.
   */
  async putSnapshot(space: SpaceId, tile: TileId, snapshot: Snapshot): Promise<HashRef> {
    const content = stableStringify(snapshot);
    const hash = hashUtf8(content);

    await this.writeObject(hash, Buffer.from(content, "utf8"));

    // Update index to point to this snapshot
    const index = await this.getTileTip(space, tile);
    if (index) {
      index.last_snapshot = hash;
      index.snapshot_event = snapshot.at_event;
      await this.writeIndex(space, tile, index);
    }

    return hash;
  }

  /**
   * Get a snapshot by hash.
   */
  async getSnapshot(hash: HashRef): Promise<Snapshot> {
    const data = await this.getObject(hash);
    return JSON.parse(data.toString("utf8")) as Snapshot;
  }

  // ==========================================================================
  // Internal: Manifest and Index Management
  // ==========================================================================

  private async updateManifestAndIndex(
    space: SpaceId,
    tile: TileId,
    segHash: HashRef,
    firstEventId: EventId,
    lastEventId: EventId
  ): Promise<void> {
    // Load or create manifest
    const manifestPath = this.manifestPath(space, tile);
    let manifest: Manifest;

    try {
      const data = await fs.readFile(manifestPath, "utf8");
      manifest = JSON.parse(data) as Manifest;
    } catch (err: any) {
      if (err.code === "ENOENT") {
        manifest = { tile_id: tile, segments: [] };
      } else {
        throw err;
      }
    }

    // Append new segment reference
    manifest.segments.push({
      hash: segHash,
      from_event: firstEventId,
      to_event: lastEventId,
    });

    // Write manifest atomically
    await fs.writeFile(manifestPath, stableStringify(manifest), "utf8");

    // Update index
    const index: Index = {
      tile_id: tile,
      tip_event: lastEventId,
      tip_segment: segHash,
      updated_at: Date.now(),
    };

    await this.writeIndex(space, tile, index);
  }

  private async writeIndex(space: SpaceId, tile: TileId, index: Index): Promise<void> {
    const indexPath = this.indexPath(space, tile);
    await fs.writeFile(indexPath, stableStringify(index), "utf8");
  }

  // ==========================================================================
  // Internal: Object Storage
  // ==========================================================================

  private async writeObject(hash: HashRef, content: Buffer): Promise<void> {
    const objPath = this.objectPath(hash);
    await fs.mkdir(path.dirname(objPath), { recursive: true });
    await fs.writeFile(objPath, content);
  }

  // ==========================================================================
  // Internal: Path Helpers
  // ==========================================================================

  private bufferKey(space: SpaceId, tile: TileId): string {
    return `${space}::${tile}`;
  }

  private tileDir(space: SpaceId, tile: TileId): string {
    return path.join(this.rootDir, "spaces", space, "tiles", tile);
  }

  private manifestPath(space: SpaceId, tile: TileId): string {
    return path.join(this.tileDir(space, tile), "manifest.json");
  }

  private indexPath(space: SpaceId, tile: TileId): string {
    return path.join(this.tileDir(space, tile), "index.json");
  }

  private objectPath(hash: HashRef): string {
    const [algo, hex] = hash.split(":");
    return path.join(this.rootDir, "objects", algo, hex.slice(0, 2), hex.slice(2));
  }

  private async ensureTileDirs(space: SpaceId, tile: TileId): Promise<void> {
    const base = this.tileDir(space, tile);
    await fs.mkdir(path.join(base, "snapshots"), { recursive: true });
  }
}

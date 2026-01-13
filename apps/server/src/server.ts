// Metaverse Kit Server: HTTP API for Tile Sync and Event Ingestion
// Provides endpoints for tile tips, segments, objects, and event appending

import http from "http";
import url from "url";
import path from "path";
import { WebSocketServer } from "ws";
import { TileStore } from "@metaverse-kit/tilestore";
import { validateWorldEvent } from "@metaverse-kit/protocol";
import { normalizeEvent } from "@metaverse-kit/nf";
import type { SpaceId, TileId, EventId, PresenceUpdate } from "@metaverse-kit/protocol";
import { startDiscovery } from "./discovery.js";
import { initExt32Registry, listExt32Packs, registerExt32Pack, validateExt32Pack } from "./ext32_registry.js";

// ============================================================================
// Configuration
// ============================================================================

const PORT = parseInt(process.env.PORT || "8080", 10);
const WORLD_DIR = process.env.WORLD || "./world";
const PEER_ID = process.env.PEER_ID || "peer:local";

console.log(`Initializing Metaverse Kit Server`);
console.log(`  World directory: ${WORLD_DIR}`);
console.log(`  Port: ${PORT}`);

// ============================================================================
// Initialize Tile Store
// ============================================================================

const store = new TileStore({
  rootDir: WORLD_DIR,
  flushBytes: 256 * 1024, // 256 KB
  flushMs: 5000, // 5 seconds
});

initExt32Registry(WORLD_DIR);

const { graph: discoveryGraph, udp: discoveryUdp } = startDiscovery({
  persistPath: path.join(WORLD_DIR, "discovery.json"),
  peerId: PEER_ID,
});

const wss = new WebSocketServer({ noServer: true });
const presenceByActor = new Map<string, PresenceUpdate>();
const clientInfo = new Map<any, { space_id?: SpaceId; actor_id?: string; sentInitial?: boolean }>();

function actorKey(spaceId: SpaceId, actorId: string) {
  return `${spaceId}::${actorId}`;
}

function broadcastPresence(origin: any, presence: PresenceUpdate) {
  const payload = JSON.stringify({ type: "presence", payload: presence });
  for (const [client, info] of clientInfo.entries()) {
    if (client === origin) continue;
    if (info.space_id !== presence.space_id) continue;
    if (client.readyState === 1) {
      client.send(payload);
    }
  }
}

function sendInitialPresence(client: any, spaceId: SpaceId, actorId?: string) {
  const presences = [];
  for (const presence of presenceByActor.values()) {
    if (presence.space_id !== spaceId) continue;
    if (actorId && presence.actor_id === actorId) continue;
    presences.push({ type: "presence", payload: presence });
  }
  if (presences.length > 0 && client.readyState === 1) {
    client.send(JSON.stringify({ type: "presence_batch", payload: presences }));
  }
}

// Graceful shutdown
process.on("SIGINT", async () => {
  console.log("\nShutting down gracefully...");
  discoveryGraph.stop();
  discoveryUdp.sock.close();
  wss.close();
  await store.close();
  process.exit(0);
});

process.on("SIGTERM", async () => {
  console.log("\nShutting down gracefully...");
  discoveryGraph.stop();
  discoveryUdp.sock.close();
  wss.close();
  await store.close();
  process.exit(0);
});

// ============================================================================
// Helper Functions
// ============================================================================

function json(res: http.ServerResponse, obj: unknown, code = 200): void {
  res.writeHead(code, {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
  });
  res.end(JSON.stringify(obj));
}

function error(res: http.ServerResponse, message: string, code = 400): void {
  json(res, { error: message }, code);
}

async function readBody(req: http.IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", (chunk) => (body += chunk));
    req.on("end", () => resolve(body));
    req.on("error", reject);
  });
}

// ============================================================================
// HTTP Server
// ============================================================================

const server = http.createServer(async (req, res) => {
  const u = url.parse(req.url || "", true);
  const pathname = u.pathname || "";

  // CORS preflight
  if (req.method === "OPTIONS") {
    res.writeHead(204, {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    });
    res.end();
    return;
  }

  console.log(`${req.method} ${pathname}`);

  try {
    // ========================================================================
    // GET /health - Health check
    // ========================================================================
    if (pathname === "/health" && req.method === "GET") {
      return json(res, { status: "ok", world: WORLD_DIR });
    }

    // ========================================================================
    // GET /tile_tip?space_id=...&tile_id=...
    // ========================================================================
    if (pathname === "/tile_tip" && req.method === "GET") {
      const space_id = u.query.space_id as SpaceId | undefined;
      const tile_id = u.query.tile_id as TileId | undefined;

      if (!space_id || !tile_id) {
        return error(res, "Missing space_id or tile_id query parameters");
      }

      const tip = await store.getTileTip(space_id, tile_id);

      if (!tip) {
        return json(res, { error: "Tile not found" }, 404);
      }

      return json(res, tip);
    }

    // ========================================================================
    // GET /ext32/packs
    // ========================================================================
    if (pathname === "/ext32/packs" && req.method === "GET") {
      return json(res, { packs: listExt32Packs() });
    }

    // ========================================================================
    // POST /ext32/packs
    // Body: { pack }
    // ========================================================================
    if (pathname === "/ext32/packs" && req.method === "POST") {
      const body = await readBody(req);
      const payload = JSON.parse(body) as { pack: unknown };
      if (!payload.pack || typeof payload.pack !== "object") {
        return error(res, "pack must be an object");
      }
      const problems = validateExt32Pack(payload.pack);
      if (problems.length > 0) {
        return error(res, `Invalid pack: ${problems.join("; ")}`);
      }
      registerExt32Pack(payload.pack as any);
      return json(res, { ok: true });
    }

    // ========================================================================
    // POST /segments_since
    // Body: { space_id, tile_id, after_event }
    // ========================================================================
    if (pathname === "/segments_since" && req.method === "POST") {
      const body = await readBody(req);
      const payload = JSON.parse(body) as {
        space_id: SpaceId;
        tile_id: TileId;
        after_event: EventId | null;
      };

      const { space_id, tile_id, after_event } = payload;

      if (!space_id || !tile_id) {
        return error(res, "Missing space_id or tile_id in request body");
      }

      const segments = await store.getSegmentsSince(
        space_id,
        tile_id,
        after_event ?? null
      );

      return json(res, { tile_id, segments });
    }

    // ========================================================================
    // GET /object/:hash
    // ========================================================================
    if (pathname.startsWith("/object/") && req.method === "GET") {
      const hash = decodeURIComponent(pathname.split("/").pop()!);

      if (!hash || !hash.includes(":")) {
        return error(res, "Invalid hash format");
      }

      try {
        const bytes = await store.getObject(hash as any);
        res.writeHead(200, {
          "Content-Type": "application/octet-stream",
          "Access-Control-Allow-Origin": "*",
        });
        res.end(bytes);
      } catch (err: any) {
        if (err.code === "ENOENT") {
          return error(res, "Object not found", 404);
        }
        throw err;
      }

      return;
    }

    // ========================================================================
    // POST /append_events
    // Body: { space_id, tile_id, events: [...] }
    // ========================================================================
    if (pathname === "/append_events" && req.method === "POST") {
      const body = await readBody(req);
      const payload = JSON.parse(body) as {
        space_id: SpaceId;
        tile_id: TileId;
        events: unknown[];
      };

      const { space_id, tile_id, events } = payload;

      if (!space_id || !tile_id || !Array.isArray(events)) {
        return error(
          res,
          "Request body must include space_id, tile_id, and events array"
        );
      }

      if (events.length === 0) {
        return json(res, { ok: true, appended: 0 });
      }

      // Validate and normalize events
      const normalized = [];
      for (let i = 0; i < events.length; i++) {
        try {
          const ev = validateWorldEvent(events[i]);

          // Verify space_id and tile match
          if (ev.space_id !== space_id) {
            return error(
              res,
              `Event ${i}: space_id mismatch (expected ${space_id}, got ${ev.space_id})`
            );
          }
          if (ev.tile !== tile_id) {
            return error(
              res,
              `Event ${i}: tile mismatch (expected ${tile_id}, got ${ev.tile})`
            );
          }

          normalized.push(normalizeEvent(ev));
        } catch (err: any) {
          return error(res, `Event ${i} validation failed: ${err.message}`);
        }
      }

      // Append to tile store
      await store.appendTileEvents(space_id, tile_id, normalized);

      return json(res, { ok: true, appended: normalized.length });
    }

    // ========================================================================
    // GET /who_has?space_id=...&tile_id=...
    // ========================================================================
    if (pathname === "/who_has" && req.method === "GET") {
      const space_id = u.query.space_id as SpaceId | undefined;
      const tile_id = u.query.tile_id as TileId | undefined;

      if (!space_id || !tile_id) {
        return error(res, "Missing space_id or tile_id query parameters");
      }

      return json(res, discoveryGraph.whoHas(space_id, tile_id));
    }

    // ========================================================================
    // GET /best_tip?space_id=...&tile_id=...
    // ========================================================================
    if (pathname === "/best_tip" && req.method === "GET") {
      const space_id = u.query.space_id as SpaceId | undefined;
      const tile_id = u.query.tile_id as TileId | undefined;

      if (!space_id || !tile_id) {
        return error(res, "Missing space_id or tile_id query parameters");
      }

      return json(res, discoveryGraph.bestTip(space_id, tile_id) ?? { ok: false });
    }

    // ========================================================================
    // GET /peer_tiles?peer_id=...
    // ========================================================================
    if (pathname === "/peer_tiles" && req.method === "GET") {
      const peer_id = u.query.peer_id as string | undefined;

      if (!peer_id) {
        return error(res, "Missing peer_id query parameter");
      }

      return json(res, { peer_id, tiles: discoveryGraph.tilesByPeer(peer_id) });
    }

    // ========================================================================
    // Unknown route
    // ========================================================================
    return error(res, `Unknown route: ${pathname}`, 404);
  } catch (err: any) {
    console.error("Server error:", err);
    return error(res, `Internal server error: ${err.message}`, 500);
  }
});

server.on("upgrade", (req, socket, head) => {
  const pathname = url.parse(req.url || "").pathname;
  if (pathname !== "/presence") {
    socket.destroy();
    return;
  }

  wss.handleUpgrade(req, socket, head, (ws) => {
    wss.emit("connection", ws, req);
  });
});

wss.on("connection", (ws) => {
  clientInfo.set(ws, {});

  ws.on("message", (raw) => {
    let msg: any;
    try {
      msg = JSON.parse(raw.toString());
    } catch {
      return;
    }

    if (msg?.type === "hello" && typeof msg.space_id === "string" && typeof msg.actor_id === "string") {
      const info = clientInfo.get(ws) ?? {};
      info.space_id = msg.space_id;
      info.actor_id = msg.actor_id;
      if (!info.sentInitial) {
        sendInitialPresence(ws, msg.space_id, msg.actor_id);
        info.sentInitial = true;
      }
      clientInfo.set(ws, info);
      return;
    }

    if (msg?.type === "presence" && msg.payload) {
      const presence = msg.payload as PresenceUpdate;
      if (!presence.space_id || !presence.actor_id) return;

      const info = clientInfo.get(ws) ?? {};
      info.space_id = presence.space_id;
      info.actor_id = presence.actor_id;
      if (!info.sentInitial) {
        sendInitialPresence(ws, presence.space_id, presence.actor_id);
        info.sentInitial = true;
      }
      clientInfo.set(ws, info);

      presenceByActor.set(actorKey(presence.space_id, presence.actor_id), presence);
      broadcastPresence(ws, presence);
    }
  });

  ws.on("close", () => {
    const info = clientInfo.get(ws);
    if (info?.space_id && info.actor_id) {
      presenceByActor.delete(actorKey(info.space_id, info.actor_id));
    }
    clientInfo.delete(ws);
  });
});

// ============================================================================
// Start Server
// ============================================================================

server.listen(PORT, () => {
  console.log(`\n✓ Metaverse Kit Server running on http://localhost:${PORT}`);
  console.log("\nAvailable endpoints:");
  console.log("  GET  /health");
  console.log("  GET  /tile_tip?space_id=...&tile_id=...");
  console.log("  GET  /ext32/packs");
  console.log("  POST /ext32/packs");
  console.log("  POST /segments_since");
  console.log("  GET  /object/:hash");
  console.log("  POST /append_events");
  console.log("  GET  /who_has?space_id=...&tile_id=...");
  console.log("  GET  /best_tip?space_id=...&tile_id=...");
  console.log("  GET  /peer_tiles?peer_id=...");
  console.log("  WS   /presence");
  console.log("\nPress Ctrl+C to stop\n");
});

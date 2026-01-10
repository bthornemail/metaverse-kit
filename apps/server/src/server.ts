// Metaverse Kit Server: HTTP API for Tile Sync and Event Ingestion
// Provides endpoints for tile tips, segments, objects, and event appending

import http from "http";
import url from "url";
import { TileStore } from "@metaverse-kit/tilestore";
import { validateWorldEvent } from "@metaverse-kit/protocol";
import { normalizeEvent } from "@metaverse-kit/nf";
import type { SpaceId, TileId, EventId } from "@metaverse-kit/protocol";

// ============================================================================
// Configuration
// ============================================================================

const PORT = parseInt(process.env.PORT || "8080", 10);
const WORLD_DIR = process.env.WORLD || "./world";

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

// Graceful shutdown
process.on("SIGINT", async () => {
  console.log("\nShutting down gracefully...");
  await store.close();
  process.exit(0);
});

process.on("SIGTERM", async () => {
  console.log("\nShutting down gracefully...");
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
    // Unknown route
    // ========================================================================
    return error(res, `Unknown route: ${pathname}`, 404);
  } catch (err: any) {
    console.error("Server error:", err);
    return error(res, `Internal server error: ${err.message}`, 500);
  }
});

// ============================================================================
// Start Server
// ============================================================================

server.listen(PORT, () => {
  console.log(`\n✓ Metaverse Kit Server running on http://localhost:${PORT}`);
  console.log("\nAvailable endpoints:");
  console.log("  GET  /health");
  console.log("  GET  /tile_tip?space_id=...&tile_id=...");
  console.log("  POST /segments_since");
  console.log("  GET  /object/:hash");
  console.log("  POST /append_events");
  console.log("\nPress Ctrl+C to stop\n");
});

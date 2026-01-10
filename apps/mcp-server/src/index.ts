import express from "express";
import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/index.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { TileStore } from "./tilestore.js";

const PORT = Number(process.env.PORT ?? 8787);
const BASE_URL = process.env.BASE_URL ?? `http://localhost:${PORT}`;

const store = new TileStore();

const mcp = new McpServer({
  name: "ulp-tilestore",
  version: "0.1.0",
});

mcp.tool(
  "get_tile_state",
  "Get current tip/snapshot for a given {space,tile}.",
  {
    space: z.string(),
    tile: z.string(),
  },
  async ({ space, tile }) => {
    const st = store.getTileState(space, tile);
    return {
      content: [{ type: "text", text: JSON.stringify(st, null, 2) }],
    };
  }
);

mcp.tool(
  "get_segments_since",
  "Get segments walking backwards from a tip hash (for peer sync).",
  {
    tip: z.string(),
    max: z.number().int().min(1).max(256).optional(),
  },
  async ({ tip, max }) => {
    const segs = store.getSegmentsSince(tip, max ?? 64);
    return {
      content: [{ type: "text", text: JSON.stringify(segs, null, 2) }],
    };
  }
);

mcp.tool(
  "summarize_tile",
  "Return a human summary of the last N segments (derived, non-authoritative).",
  {
    space: z.string(),
    tile: z.string(),
    segments: z.number().int().min(1).max(64).default(10),
  },
  async ({ space, tile, segments }) => {
    const st = store.getTileState(space, tile);
    const segs = store.getSegmentsSince(st.tip, segments);
    const summary = {
      space,
      tile,
      tip: st.tip,
      segmentCount: segs.length,
      hint: "Provide these segments to the model for summarization.",
    };
    return { content: [{ type: "text", text: JSON.stringify(summary, null, 2) }] };
  }
);

const app = express();
app.use(express.json({ limit: "2mb" }));

const transports = new Map<string, StreamableHTTPServerTransport>();

function getOrCreateTransport(sessionId?: string) {
  let t = sessionId ? transports.get(sessionId) : undefined;

  if (!t) {
    t = new StreamableHTTPServerTransport({
      sessionIdGenerator: () => crypto.randomUUID(),
    });

    t.onSessionId?.((id: string) => transports.set(id, t!));
    mcp.connect?.(t);

    t.onClose?.(() => {
      for (const [k, v] of transports.entries()) {
        if (v === t) transports.delete(k);
      }
    });
  }

  return t;
}

app.all("/mcp", async (req, res) => {
  try {
    const sessionId = req.header("Mcp-Session-Id") ?? undefined;
    const transport = getOrCreateTransport(sessionId);
    await transport.handleRequest?.(req, res);
  } catch (err: any) {
    res.status(500).json({ error: String(err?.message ?? err) });
  }
});

app.get("/", (_req, res) => {
  res.type("text/plain").send(
    [
      "ULP Tile MCP Server",
      `MCP endpoint: ${BASE_URL}/mcp`,
      "",
      "Try with the example client or MCP Inspector.",
    ].join("\n")
  );
});

app.listen(PORT, () => {
  console.log(`MCP Streamable HTTP server listening: ${BASE_URL}/mcp`);
});

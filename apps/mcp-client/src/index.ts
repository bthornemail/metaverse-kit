import { banner } from "./print.js";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";

const MCP_URL = process.env.MCP_URL ?? "http://localhost:8787/mcp";

async function main() {
  banner("MCP Client → ULP Tile Store");

  const transport = new StreamableHTTPClientTransport({ url: MCP_URL });
  const client = new Client({
    name: "ulp-client",
    version: "0.1.0",
  });

  await client.connect(transport);

  const tools = await client.listTools();
  console.log("Tools:", tools.tools.map((t: any) => t.name));

  banner("Call get_tile_state");
  const state = await client.callTool("get_tile_state", {
    space: "demo",
    tile: "z0/x0/y0",
  });
  console.log(state);

  banner("Call summarize_tile");
  const summary = await client.callTool("summarize_tile", {
    space: "demo",
    tile: "z0/x0/y0",
    segments: 5,
  });
  console.log(summary);

  await client.close?.();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

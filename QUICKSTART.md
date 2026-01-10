# Metaverse Kit - Quick Start Guide

Get the distributed infinite canvas metaverse running in **under 5 minutes**!

## Prerequisites

- Node.js >= 18.0.0
- npm >= 9.0.0

## Installation

```bash
# Clone the repository (if not already done)
cd /data/data/com.termux/files/home/metaverse-kit

# Install dependencies (already done if you see this)
npm install

# Build all packages
npm run build
```

## Running the System

You need **two terminals** - one for the server, one for the client.

### Terminal 1: Start the Server

```bash
# Create world directory
mkdir -p world

# Start the server
node apps/server/dist/server.js

# Or with auto-reload during development:
# npm run dev:server
```

The server will start on **http://localhost:8080**

You should see:
```
✓ Metaverse Kit Server running on http://localhost:8080

Available endpoints:
  GET  /health
  GET  /tile_tip?space_id=...&tile_id=...
  POST /segments_since
  GET  /object/:hash
  POST /append_events
```

### Terminal 2: Start the Client

```bash
# Start the development server
npm run dev:client

# Or navigate to the client directory first:
# cd apps/client
# npm run dev
```

The client will start on **http://localhost:3000**

You should see:
```
  VITE v5.0.0  ready in XXX ms

  ➜  Local:   http://localhost:3000/
```

## Using the Application

1. **Open your browser** to http://localhost:3000

2. **You'll see an infinite canvas** with:
   - Grid background
   - Toolbar in top-left (Select / Rectangle tools)
   - Status bar in bottom-right

3. **Try these interactions:**

   **Pan the canvas:**
   - Click "Select" tool (or press it if not active)
   - Click and drag anywhere on the canvas to move around

   **Zoom:**
   - Use mouse wheel to zoom in/out
   - Zoom is centered on your mouse position

   **Draw a rectangle:**
   - Click "Rectangle" tool
   - Click and drag on the canvas to draw a rectangle
   - Release to create it
   - The rectangle is sent to the server and persisted!

   **Reload the page:**
   - Press F5 or refresh
   - Your rectangles are still there! (loaded from the server)

## Architecture in Action

What's happening behind the scenes:

1. **Client draws rectangle** → Creates a `create_node` event
2. **Event sent to server** → POST /append_events
3. **Server validates** → Checks invariants and scope
4. **Server normalizes** → Adds root invariants
5. **Server stores** → Appends to tile segment (JSONL file)
6. **Server flushes** → Writes segment to `world/objects/sha256/...`
7. **Server updates** → Updates `manifest.json` and `index.json`
8. **Client reloads** → Fetches tip, segments, and rebuilds state
9. **Shadow canvas materializes** → Applies events deterministically
10. **Canvas renders** → Draws rectangles from state

## File System

After creating some rectangles, check the world directory:

```bash
tree world/

world/
├── objects/
│   └── sha256/
│       └── ab/
│           └── cdef123...  # Your event segments
└── spaces/
    └── demo/
        └── tiles/
            └── z0/
                └── x0/
                    └── y0/
                        ├── index.json     # Tip pointer
                        ├── manifest.json  # Segment list
                        └── snapshots/     # (empty for now)
```

## Inspecting the Data

### View the manifest

```bash
cat world/spaces/demo/tiles/z0/x0/y0/manifest.json | jq
```

### View an event segment

```bash
# Get the hash from manifest.json
HASH="sha256:abc..."

# View the segment (it's JSONL - one event per line)
cat world/objects/sha256/${HASH:7:2}/${HASH:9}
```

You'll see your events in human-readable JSON!

## Multi-User Testing

To test multi-user collaboration:

1. Open **two browser tabs** to http://localhost:3000
2. Draw rectangles in one tab
3. **Refresh the other tab** - you'll see the rectangles!

(Real-time WebSocket sync is planned for v1)

## Troubleshooting

### "Cannot find module" errors

Make sure all packages are built:
```bash
npm run build
```

### "Port already in use"

Change the port in the environment:
```bash
# Server
PORT=8081 node apps/server/dist/server.js

# Client - edit apps/client/vite.config.ts
```

### "Tile not found" on first load

This is normal! The tile is created on the first event. Just try drawing a rectangle.

### Canvas is blank

1. Check browser console for errors
2. Verify server is running (check http://localhost:8080/health)
3. Check that the server proxy is working (Vite should proxy API calls)

## Next Steps

- **Add more shapes**: Extend the protocol with new primitives
- **Implement snapshots**: Add periodic snapshot generation
- **Add layers**: Use different layers (layout, physics, presentation)
- **Multi-tile support**: Implement viewport-based tile subscription
- **Real-time sync**: Add WebSocket for live collaboration
- **3D view**: Add Three.js projection
- **Timeline replay**: Scrub through history

## Development Tips

### Watch mode for rapid iteration

```bash
# Terminal 1: Server with auto-reload
npm run dev:server

# Terminal 2: Client with hot-reload
npm run dev:client
```

Now you can edit code and see changes instantly!

### Debugging

- **Server logs**: Check the terminal running the server
- **Client logs**: Open browser DevTools (F12) → Console
- **Network tab**: See all API requests/responses
- **React DevTools**: Install browser extension for React debugging

### Clean slate

To start fresh:
```bash
# Remove all data
rm -rf world/

# Restart server (it will recreate directory structure)
```

## Have Fun!

You're now running a fully functional distributed metaverse with:
- ✅ Append-only event traces
- ✅ Content-addressed storage
- ✅ Deterministic replay
- ✅ Infinite canvas
- ✅ Multi-user collaboration (via refresh)
- ✅ Local-first architecture

This is the foundation for AR/VR, physics, sensors, and more!

---

**Questions? Issues?**

Check CLAUDE.md for development guidance or the dev-docs/ folder for architecture details.

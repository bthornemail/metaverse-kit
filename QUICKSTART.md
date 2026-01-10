# Metaverse Kit - Quick Start Guide

Get the distributed infinite canvas metaverse running in **under 5 minutes**!

## Prerequisites

- Node.js >= 18.0.0
- npm >= 9.0.0

## Installation

```bash
# Clone the repository
git clone https://github.com/bthornemail/metaverse-kit.git
cd metaverse-kit

# Install dependencies
npm install

# Build all packages
npm run build
```

## Running the System

You need **two terminals** - one for the server, one for the client.

### Terminal 1: Start the Server

```bash
# Create world directory + dotfiles
npm run mv-init -- --world world --space demo

# Start the server
npm run mv-host -- --world world

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
  GET  /who_has?space_id=...&tile_id=...
  GET  /best_tip?space_id=...&tile_id=...
  GET  /peer_tiles?peer_id=...
  WS   /presence
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
   - Timeline scrubber at the bottom
   - 2D/3D view toggle (top-right)
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

   **Presence cursors:**
   - Open a second browser tab
   - Move your mouse to see live cursors (WebSocket `/presence`)

   **Timeline scrubber:**
   - Drag the timeline slider to scrub history
   - Release to return to live view

   **3D view:**
   - Toggle to 3D view to see meshes/GLB/OBJ renders

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
7. **Server updates** → Updates `manifest.json` and `index.json` + optional snapshot
8. **Client reloads** → Fetches snapshot + segments since snapshot
9. **Shadow canvas materializes** → Applies events deterministically
10. **Canvas renders** → Draws rectangles + media projections

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
                        └── snapshots/     # Periodic snapshots
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
3. Watch cursors update live via WebSocket
4. Refresh the other tab to reload the latest segments

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

## Licensing

This repository uses project-specific licenses. Review both before reuse or redistribution:
- Architecture Preservation License (APL): `docs/licenses/architecture-preservation-license.md`
- Hitecture Preservation License (HPL): `docs/licenses/hitecture-preservation-license.md`

- **Add more shapes**: Extend the protocol with new primitives
- **Add richer media**: SVG/PDF/HTML/MP4/WAV rendering refinements
- **Add layers**: Use different layers (layout, physics, presentation)
- **Multi-tile support**: Implement viewport-based tile subscription
- **Real-time sync**: Add event streaming (beyond cursors)
- **3D view**: Add camera controls + lighting polish
- **Timeline replay**: Add snapshot-aware range queries

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
- ✅ Multi-user presence cursors
- ✅ Timeline scrubber
- ✅ 2D/3D projections
- ✅ Local-first architecture

This is the foundation for AR/VR, physics, sensors, and more!

---

**Questions? Issues?**

Check CLAUDE.md for development guidance or the dev-docs/ folder for architecture details.

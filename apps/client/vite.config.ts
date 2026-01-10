import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000,
    proxy: {
      '/health': 'http://localhost:8080',
      '/tile_tip': 'http://localhost:8080',
      '/segments_since': 'http://localhost:8080',
      '/object': 'http://localhost:8080',
      '/append_events': 'http://localhost:8080',
    },
  },
  resolve: {
    alias: {
      '@metaverse-kit/protocol': '/../../packages/protocol/src',
      '@metaverse-kit/shadow-canvas': '/../../packages/shadow-canvas/src',
    },
  },
});

import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const BACKEND = 'http://localhost:5164';
// const BACKEND = 'https://reliefconnect-api.azurewebsites.net';

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    // Fix: leaflet.markercluster is a UMD plugin whose browser-global branch calls
    // factory(globalThis.L). Rolldown (Vite 8) outputs ESM chunks where `module` is
    // undefined, so the CJS branch is never taken and globalThis.L is never set →
    // ReferenceError: L is not defined at startup.
    // Solution: prepend an ESM import of leaflet + globalThis.L assignment to the
    // markercluster source so the global is set before the UMD IIFE executes.
    {
      name: 'fix-leaflet-markercluster-umd',
      transform(code: string, id: string) {
        const normalizedId = id.replace(/\\/g, '/');
        if (!normalizedId.endsWith('/node_modules/leaflet.markercluster/dist/leaflet.markercluster.js')) {
          return null;
        }

        return {
          code: `import _L from 'leaflet';\nif (typeof globalThis !== 'undefined') globalThis.L = _L;\n` + code,
          map: null,
        };
      },
    },
  ],
  server: {
    // Allow VS Code dev tunnels (devtunnels.ms) and GitHub Codespaces
    allowedHosts: ['.devtunnels.ms', '.github.dev', '.githubpreview.dev'],
    proxy: {
      '/api': {
        target: BACKEND,
        changeOrigin: true,
        configure: (proxy) => {
          proxy.on('error', (_err, _req, res) => {
            // res can be ServerResponse or Socket depending on the request type
            const httpRes = res as import('http').ServerResponse;
            if (typeof httpRes.writeHead === 'function' && !httpRes.headersSent) {
              httpRes.writeHead(503, { 'Content-Type': 'application/json' });
              httpRes.end(JSON.stringify({ message: 'Backend starting, please wait…' }));
            }
          });
        },
      },
      '/hubs': {
        target: BACKEND,
        changeOrigin: true,
        ws: true,
        configure: (proxy) => {
          proxy.on('error', () => { /* suppress ECONNREFUSED noise while backend boots */ });
        },
      },
      '/health': { target: BACKEND, changeOrigin: true },
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules')) {
            if (id.includes('react') || id.includes('react-dom') || id.includes('react-router-dom')) {
              return 'react-vendor';
            }
            if (id.includes('leaflet')) {
              return 'map-vendor';
            }
          }
        },
      },
    },
  },
})

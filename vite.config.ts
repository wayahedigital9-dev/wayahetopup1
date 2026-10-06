import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig } from 'vite';

import apiApp from './api/index.js';

export default defineConfig(() => {
  const port = 7844;

  return {
    plugins: [
      react(),
      tailwindcss(),
      {
        name: 'api-server-middleware',
        configureServer(server) {
          server.middlewares.use((req, res, next) => {
            const url = req.url || '';
            if (
              url.startsWith('/api') ||
              url.startsWith('/health') ||
              url.startsWith('/callback') ||
              url.startsWith('/webhook')
            ) {
              return (apiApp as any)(req, res, next);
            }
            next();
          });
        },
      },
    ],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      port,
      host: true,
      allowedHosts: true as const,
      proxy: {
        '/api': {
          target: 'http://127.0.0.1:4000',
          changeOrigin: true,
          secure: false,
        },
        '/health': {
          target: 'http://127.0.0.1:4000',
          changeOrigin: true,
        },
      },
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Ignore backend, dist, logs, and temp files to prevent false reload flickering
      watch: process.env.DISABLE_HMR === 'true' ? null : {
        ignored: [
          '**/backend/**',
          '**/dist/**',
          '**/.git/**',
          '**/*.log',
          '**/scratch/**',
          '**/.system_generated/**',
        ],
      },
    },
    build: {
      chunkSizeWarningLimit: 2000,
      rollupOptions: {
        output: {
          manualChunks(id) {
            if (id.includes('node_modules/lucide-react')) {
              return 'vendor-icons';
            }
            if (id.includes('node_modules/react') || id.includes('node_modules/react-dom') || id.includes('node_modules/scheduler')) {
              return 'vendor-react';
            }
          },
        },
      },
    },
  };
});

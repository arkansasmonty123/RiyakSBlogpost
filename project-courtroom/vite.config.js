import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath, URL } from 'node:url';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  server: {
    proxy: {
      '/api/local-llm': {
        target: 'http://127.0.0.1:8081',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/local-llm/, '/v1/chat/completions'),
      },
      '/api/saves': { target: 'http://127.0.0.1:8787', changeOrigin: true },
      '/api/health': { target: 'http://127.0.0.1:8787', changeOrigin: true },
      '/api/audit': { target: 'http://127.0.0.1:8787', changeOrigin: true },
    },
  },
  preview: {
    proxy: {
      '/api/local-llm': {
        target: 'http://127.0.0.1:8081',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/local-llm/, '/v1/chat/completions'),
      },
      '/api/saves': { target: 'http://127.0.0.1:8787', changeOrigin: true },
      '/api/health': { target: 'http://127.0.0.1:8787', changeOrigin: true },
      '/api/audit': { target: 'http://127.0.0.1:8787', changeOrigin: true },
    },
  },
});

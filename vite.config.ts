import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  base: './',
  server: {
    port: 5173,
    strictPort: true,
    proxy: {
      // Proxy requests to Riot's Live Client API, bypassing the self-signed SSL cert
      '/riot-api': {
        target: 'https://127.0.0.1:2999',
        changeOrigin: true,
        secure: false, // Accept Riot's self-signed certificate
        rewrite: (path) => path.replace(/^\/riot-api/, ''),
      },
    },
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
  },
});

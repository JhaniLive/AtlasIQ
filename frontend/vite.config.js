import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import cesium from 'vite-plugin-cesium';

export default defineConfig({
  plugins: [react(), cesium()],
  server: {
    port: 5173,
    proxy: {
      '/health': 'http://localhost:8000',
      '/countries': 'http://localhost:8000',
      '/recommendations': 'http://localhost:8000',
      '/chat': 'http://localhost:8000',
      '/resolve-place': 'http://localhost:8000',
    },
  },
});

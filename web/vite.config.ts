import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tsconfigPaths from 'vite-tsconfig-paths';

export default defineConfig({
  plugins: [react(), tsconfigPaths()],
  // Use relative paths so the build works with Electron's file:// protocol
  base: './',
  resolve: {
    alias: [
      { find: '@', replacement: '/src' },
      { find: '@dashboard', replacement: '/src/pages/dashboard' }
    ]
  },
  // Required headers for ffmpeg.wasm SharedArrayBuffer support
  server: {
    headers: {
      'Cross-Origin-Opener-Policy': 'same-origin',
      'Cross-Origin-Embedder-Policy': 'require-corp',
    }
  },
  optimizeDeps: {
    exclude: ['@ffmpeg/ffmpeg', '@ffmpeg/util']
  }
});

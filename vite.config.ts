import { defineConfig } from 'vite';

export default defineConfig({
  base: '/m3-expressive-map-app/',
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    target: 'es2022',
    sourcemap: false,
    cssCodeSplit: true,
    chunkSizeWarningLimit: 900,
  },
});

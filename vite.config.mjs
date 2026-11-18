import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import { fileURLToPath } from 'node:url';

export default defineConfig({
  root: fileURLToPath(new URL('./frontend', import.meta.url)),
  plugins: [vue()],
  build: { outDir: '../dist', emptyOutDir: true },
  server: { proxy: { '/api': 'http://127.0.0.1:3000' } },
  test: { environment: 'jsdom', include: ['../tests/ui.test.js'], maxWorkers: 1 }
});

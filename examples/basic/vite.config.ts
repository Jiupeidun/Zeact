import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const exampleRoot = fileURLToPath(new URL('.', import.meta.url));

export default defineConfig({
  root: exampleRoot,
  plugins: [react()],
  resolve: {
    alias: {
      '@kertin/zeact/chat': resolve(exampleRoot, '../../src/chat/index.ts'),
      '@kertin/zeact/trade': resolve(exampleRoot, '../../src/trade/index.ts'),
      '@kertin/zeact/live': resolve(exampleRoot, '../../src/live/index.ts'),
    },
  },
});

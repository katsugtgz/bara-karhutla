import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  base: process.env.BASE_PATH || '/',
  plugins: [react()],
  build: {
    target: 'es2022',
    rollupOptions: {
      input: {
        index: 'index.html',
        kisah: 'kisah/index.html',
        metode: 'metode/index.html',
      },
    },
  },
});

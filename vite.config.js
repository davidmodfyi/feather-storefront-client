import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api': {
        target: 'https://api.featherstorefront.com',
        changeOrigin: true,
        secure: true,
        // Don't rewrite paths - this is important
        rewrite: (path) => path
      },
    },
  },
});
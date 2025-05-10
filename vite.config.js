import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api': {
        target: process.env.NODE_ENV === 'production' 
          ? 'https://api.featherstorefront.com'
          : 'http://localhost:4000',
        changeOrigin: true,
        secure: true,
        rewrite: (path) => path
      },
    },
  },
});
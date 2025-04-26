import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api': {
        target: 'https://api.featherstorefront.com', // your API server
        changeOrigin: true,
        secure: true,
      },
    },
  },
});

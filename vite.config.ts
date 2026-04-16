import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  // Required for GitHub Pages — assets are served from /cambio-frontend/
  base: '/cambio-frontend/',
  server: {
    proxy: {
      // Proxy WebSocket connections to the PartyKit dev server in development.
      '/party': {
        target: 'http://localhost:1999',
        changeOrigin: true,
        ws: true,
      },
    },
  },
})

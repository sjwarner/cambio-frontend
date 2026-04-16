import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
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

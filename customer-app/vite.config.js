import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Customer mobile app. Runs next to the brand dashboard (5173) and shares the same backend.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5174,
    host: true, // reachable from a phone on the same Wi-Fi
    proxy: { '/api': 'http://localhost:5000' },
  },
})

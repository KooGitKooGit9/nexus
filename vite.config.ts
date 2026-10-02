import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import path from 'node:path'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: { '@': path.resolve(import.meta.dirname, 'src') },
  },
  server: {
    port: 5199,
    strictPort: true,
    proxy: {
      '/api': 'http://localhost:5200',
      '/ws': { target: 'ws://localhost:5200', ws: true },
    },
    // The backend's SQLite/uploads live under server/ — don't trigger page reloads for them
    watch: { ignored: ['**/server/**'] },
  },
})

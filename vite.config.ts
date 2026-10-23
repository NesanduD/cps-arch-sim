import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: { // proxy - send /simulate requests to the backend server to prevent CORS issues
      '/simulate': {
        target: 'http://127.0.0.1:8000', 
        changeOrigin: true,
      },
    },
  },
})
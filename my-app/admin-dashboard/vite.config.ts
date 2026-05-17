import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const proxyTarget =
    env.VITE_PROXY_TARGET || 'https://abhyati-food-customer-app.onrender.com'

  return {
    plugins: [react()],
    server: {
      port: 5174,
      proxy: {
        '/api': {
          target: proxyTarget,
          changeOrigin: true
        }
      }
    }
  }
})

import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const hmrPort = env.VITE_HMR_CLIENT_PORT ? Number(env.VITE_HMR_CLIENT_PORT) : undefined

  return {
    plugins: [react()],
    server: {
      port: 5173,
      allowedHosts: true,
      hmr: hmrPort ? { clientPort: hmrPort } : true,
      proxy: {
        '/api': {
          target: 'http://localhost:3000',
          changeOrigin: true,
        },
        // Notification service WebSocket  (/notifications/socket.io → localhost:3004/socket.io)
        '/notifications': {
          target: 'http://localhost:3004',
          changeOrigin: true,
          ws: true,
          rewrite: (path) => path.replace(/^\/notifications/, ''),
          configure: (proxy) => { proxy.on('error', () => {}); },
        },
        // Bluetooth WebSocket — now served by location-service (port 3003)
        '/bluetooth-ws': {
          target: 'http://localhost:3003',
          changeOrigin: true,
          ws: true,
          rewrite: (path) => path.replace(/^\/bluetooth-ws/, ''),
          configure: (proxy) => { proxy.on('error', () => {}); },
        },
        // Random Connect service WebSocket + REST  (/rc → localhost:3007)
        '/rc': {
          target: 'http://localhost:3007',
          changeOrigin: true,
          ws: true,
          rewrite: (path) => path.replace(/^\/rc/, ''),
          configure: (proxy) => { proxy.on('error', () => {}); },
        },
      },
    },
    resolve: {
      alias: {
        '@': '/src',
      },
    },
  }
})

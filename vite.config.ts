import path from 'path'
import { defineConfig, loadEnv, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

function platformAuthDev(): Plugin {
  let env: Record<string, string> = {}

  return {
    name: 'platform-auth-dev',
    config(_, { mode }) {
      env = loadEnv(mode, process.cwd(), 'VITE_')
    },
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        if (req.url === '/__/firebase/init.json') {
          res.setHeader('Content-Type', 'application/json')
          res.end(
            JSON.stringify({
              apiKey: env.VITE_FIREBASE_API_KEY,
              authDomain: env.VITE_FIREBASE_AUTH_DOMAIN,
              projectId: env.VITE_FIREBASE_PROJECT_ID,
              appId: env.VITE_FIREBASE_APP_ID,
              storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET,
              messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID,
              measurementId: env.VITE_FIREBASE_MEASUREMENT_ID,
            }),
          )
          return
        }

        const urlPath = req.url?.split('?')[0]

        if (urlPath?.startsWith('/assets/')) {
          const homePort = env.VITE_HOME_DEV_PORT || '5173'
          res.writeHead(302, { Location: `http://localhost:${homePort}${req.url}` })
          res.end()
          return
        }

        if (urlPath === '/' || urlPath === '') {
          const homePort = env.VITE_HOME_DEV_PORT || '5173'
          const query = req.url?.includes('?') ? req.url.slice(req.url.indexOf('?')) : ''
          res.writeHead(302, { Location: `http://localhost:${homePort}${query}` })
          res.end()
          return
        }

        next()
      })
    },
  }
}

export default defineConfig({
  base: '/admin/vendors/',
  build: { outDir: 'dist/admin/vendors' },
  plugins: [platformAuthDev(), tailwindcss(), react()],
  resolve: {
    dedupe: ['react', 'react-dom'],
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    fs: {
      allow: ['.', '../haderach-home'],
    },
    proxy: {
      '/agent/api': {
        target: 'http://localhost:8080',
        rewrite: (path) => path.replace(/^\/agent\/api/, ''),
      },
    },
  },
})

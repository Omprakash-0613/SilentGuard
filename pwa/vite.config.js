import fs from 'node:fs'
import { fileURLToPath } from 'node:url'
import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

function injectFirebaseMessagingSwConfig(firebaseMessagingSwConfig) {
  const swPath = new URL('./public/firebase-messaging-sw.js', import.meta.url)
  const distSwPath = new URL('./dist/firebase-messaging-sw.js', import.meta.url)

  const renderServiceWorker = () =>
    fs
      .readFileSync(swPath, 'utf8')
      .replace('__FIREBASE_MESSAGING_SW_CONFIG__', firebaseMessagingSwConfig)

  return {
    name: 'inject-firebase-messaging-sw-config',
    apply: 'build',
    writeBundle() {
      if (!fs.existsSync(distSwPath)) return
      fs.writeFileSync(distSwPath, renderServiceWorker())
    },
  }
}

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const rootDir = fileURLToPath(new URL('.', import.meta.url))
  const env = loadEnv(mode, rootDir, '')
  const firebaseMessagingSwConfig = JSON.stringify({
    apiKey: env.VITE_FIREBASE_API_KEY || '',
    authDomain: env.VITE_FIREBASE_AUTH_DOMAIN || '',
    projectId: env.VITE_FIREBASE_PROJECT_ID || '',
    storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET || '',
    messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID || '',
    appId: env.VITE_FIREBASE_APP_ID || '',
  })

  return {
    define: {
      __FIREBASE_MESSAGING_SW_CONFIG__: firebaseMessagingSwConfig,
    },
    build: {
      chunkSizeWarningLimit: 3000,
    },
    plugins: [
      react(),
      VitePWA({
        registerType: 'autoUpdate',
        includeAssets: ['favicon.ico', 'icons/*.png'],

        manifest: {
          name: 'SilentGuard',
          short_name: 'SilentGuard',
          description: 'Passive audio crisis detection for hotels',
          theme_color: '#0a0a0f',
          background_color: '#0a0a0f',
          display: 'standalone',
          orientation: 'portrait',
          start_url: '/',
          scope: '/',
          icons: [
            {
              src: '/icons/icon-192x192.png',
              sizes: '192x192',
              type: 'image/png',
            },
            {
              src: '/icons/icon-512x512.png',
              sizes: '512x512',
              type: 'image/png',
              purpose: 'any maskable',
            },
          ],
        },

        workbox: {
          maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
          // Don't precache the firebase messaging SW (it's registered separately)
          navigateFallbackDenylist: [/^\/firebase-messaging-sw\.js$/],
          // Runtime caching for YAMNet model files
          runtimeCaching: [
            {
              urlPattern: /^https:\/\/tfhub\.dev\/.*/i,
              handler: 'CacheFirst',
              options: {
                cacheName: 'yamnet-model-cache',
                expiration: {
                  maxEntries: 50,
                  maxAgeSeconds: 30 * 24 * 60 * 60, // 30 days
                },
                cacheableResponse: {
                  statuses: [0, 200],
                },
              },
            },
            {
              urlPattern: /^https:\/\/www\.gstatic\.com\/firebasejs\/.*/i,
              handler: 'CacheFirst',
              options: {
                cacheName: 'firebase-sdk-cache',
                expiration: {
                  maxEntries: 10,
                  maxAgeSeconds: 30 * 24 * 60 * 60,
                },
                cacheableResponse: {
                  statuses: [0, 200],
                },
              },
            },
            {
              urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
              handler: 'StaleWhileRevalidate',
              options: {
                cacheName: 'google-fonts-stylesheets',
              },
            },
            {
              urlPattern: /^https:\/\/fonts\.gstatic\.com\/.*/i,
              handler: 'CacheFirst',
              options: {
                cacheName: 'google-fonts-webfonts',
                expiration: {
                  maxEntries: 10,
                  maxAgeSeconds: 365 * 24 * 60 * 60, // 1 year
                },
                cacheableResponse: {
                  statuses: [0, 200],
                },
              },
            },
          ],
        },
      }),
      injectFirebaseMessagingSwConfig(firebaseMessagingSwConfig),
    ],
  }
})

import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import path from 'path'

export default defineConfig({
  build: {
    chunkSizeWarningLimit: 700,
    rollupOptions: { output: { manualChunks: { react: ['react', 'react-dom', 'react-router-dom'], query: ['@tanstack/react-query', 'axios', 'zustand'], charts: ['recharts'], motion: ['framer-motion'], markdown: ['react-markdown', 'remark-gfm'], icons: ['lucide-react'] } } },
  },
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'apple-touch-icon.png'],
      manifest: {
        name: 'Lernvo',
        short_name: 'Lernvo',
        description: 'Plateforme de formation et de développement des compétences',
        theme_color: '#0f1923',
        background_color: '#0f1923',
        display: 'standalone',
        orientation: 'portrait',
        start_url: '/',
        scope: '/',
        categories: ['education', 'business'],
        icons: [
          { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png' },
          { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        skipWaiting: true,
        clientsClaim: true,
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
        navigateFallback: '/index.html',
        navigateFallbackDenylist: [/^\/api/],
        runtimeCaching: [
          // API calls are NEVER cached by the service worker: authenticated, per-user data must not
          // survive in Cache Storage on shared devices (LRN-21). Offline = shell only.
          {
            urlPattern: /\/api\//i,
            handler: 'NetworkOnly',
          },
          // Google Fonts stylesheets
          {
            urlPattern: /^https:\/\/fonts\.googleapis\.com/,
            handler: 'StaleWhileRevalidate',
            options: {
              cacheName: 'google-fonts-stylesheets',
            },
          },
          // Google Fonts webfont files
          {
            urlPattern: /^https:\/\/fonts\.gstatic\.com/,
            handler: 'CacheFirst',
            options: {
              cacheName: 'google-fonts-webfonts',
              expiration: { maxEntries: 20, maxAgeSeconds: 60 * 60 * 24 * 365 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          // Images
          {
            urlPattern: /\.(?:png|jpg|jpeg|svg|gif|webp|ico)$/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'images-cache',
              expiration: { maxEntries: 60, maxAgeSeconds: 60 * 60 * 24 * 30 }, // 30d
            },
          },
        ],
      },
    }),
  ],
  resolve: {
    alias: { '@': path.resolve(__dirname, './src') },
  },
  server: {
    host: '127.0.0.1',
    port: 3000,
    strictPort: true,
    proxy: {
      '/api': { target: 'http://127.0.0.1:4000', changeOrigin: true },
      '/uploads': { target: 'http://127.0.0.1:4000', changeOrigin: true },
    },
  },
})

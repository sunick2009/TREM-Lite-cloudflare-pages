import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  root: '.',
  publicDir: 'public',
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    rollupOptions: {
      input: 'index.html',
    },
  },
  resolve: {
    alias: {
      '@web': '/src-web',
    },
  },
  plugins: [
    VitePWA({
      registerType: 'prompt',
      injectRegister: 'script',
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,webmanifest}'],
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/lb\.exptech\.dev\/api\/v1\/map\/tiles\//,
            handler: 'CacheFirst',
            options: {
              cacheName: 'map-tiles',
              expiration: { maxAgeSeconds: 3600, maxEntries: 500 },
            },
          },
          {
            urlPattern: /^https:\/\/glyphs\.geolonia\.com\//,
            handler: 'CacheFirst',
            options: {
              cacheName: 'map-glyphs',
              expiration: { maxAgeSeconds: 86400, maxEntries: 50 },
            },
          },
        ],
      },
      manifest: {
        name: 'TREM-Lite Web',
        short_name: 'TREM Web',
        description: 'Taiwan Real-time Earthquake Monitoring - Web Version',
        display: 'standalone',
        start_url: '/',
        theme_color: '#1a1a1a',
        background_color: '#1a1a1a',
        lang: 'zh-TW',
        icons: [
          { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' },
        ],
      },
    }),
  ],
  server: {
    port: 5173,
    host: true,
    proxy: {
      // Local-only proxy for endpoints that restrict CORS to production origins.
      // Only active during `npm run dev:web` and `npm run preview:web`.
      '/local-api': {
        target: 'https://api.core-tyo1.exptech.dev',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/local-api/, ''),
      },
    },
  },
  preview: {
    proxy: {
      '/local-api': {
        target: 'https://api.core-tyo1.exptech.dev',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/local-api/, ''),
      },
    },
  },
});

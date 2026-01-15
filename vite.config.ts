import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      // On gère l’update via `virtual:pwa-register` côté app (reload auto)
      injectRegister: null,
      includeAssets: ['logo.png', 'apple-touch-icon.png', 'pwa-192.png', 'pwa-512.png'],
      workbox: {
        cleanupOutdatedCaches: true,
        clientsClaim: true,
        skipWaiting: true
      },
      manifest: {
        name: 'TravelU',
        short_name: 'TravelU',
        description: "Planifiez, collaborez et profitez pleinement de vos voyages en groupe.",
        start_url: '/',
        scope: '/',
        display: 'standalone',
        background_color: '#F9F7F3',
        theme_color: '#F9F7F3',
        lang: 'fr',
        icons: [
          {
            src: '/pwa-192.png',
            sizes: '192x192',
            type: 'image/png'
          },
          {
            src: '/pwa-512.png',
            sizes: '512x512',
            type: 'image/png'
          }
        ]
      }
    })
  ],
  optimizeDeps: {
    exclude: ['lucide-react'],
    include: ['@react-google-maps/api'],
  },
});

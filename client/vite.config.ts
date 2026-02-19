import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import path from 'path';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icons/*.svg'],
      manifest: {
        name: 'Vibe Remote',
        short_name: 'Vibe',
        description: 'Mobile-first agentic coding gateway',
        start_url: '/',
        display: 'standalone',
        orientation: 'portrait',
        theme_color: '#000000',
        background_color: '#000000',
        categories: ['developer', 'productivity'],
        icons: [
          { src: '/icons/icon-192.svg', sizes: '192x192', type: 'image/svg+xml' },
          { src: '/icons/icon-512.svg', sizes: '512x512', type: 'image/svg+xml' },
          { src: '/icons/icon-maskable-192.svg', sizes: '192x192', type: 'image/svg+xml', purpose: 'maskable' },
          { src: '/icons/icon-maskable-512.svg', sizes: '512x512', type: 'image/svg+xml', purpose: 'maskable' },
        ],
        shortcuts: [
          {
            name: 'New Chat',
            short_name: 'Chat',
            url: '/',
            icons: [{ src: '/icons/icon-192.svg', sizes: '192x192' }],
          },
          {
            name: 'Review Diff',
            short_name: 'Diff',
            url: '/diff',
            icons: [{ src: '/icons/icon-192.svg', sizes: '192x192' }],
          },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/api\./i,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'api-cache',
              expiration: {
                maxEntries: 50,
                maxAgeSeconds: 60 * 60, // 1 hour
              },
            },
          },
        ],
      },
      devOptions: {
        enabled: true,
      },
    }),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@shared': path.resolve(__dirname, '../shared'),
    },
  },
  server: {
    port: 5173,
    host: '0.0.0.0',
    proxy: {
      '/api': {
        target: process.env.VITE_API_URL || 'http://localhost:3000',
        changeOrigin: true,
      },
      '/ws': {
        target: (process.env.VITE_API_URL || 'http://localhost:3000').replace('http', 'ws'),
        ws: true,
      },
    },
  },
});

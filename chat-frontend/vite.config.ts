import path from 'path'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
      },
      manifest: {
        name: 'Mental Help Chat',
        short_name: 'MHG Chat',
        start_url: '/chat',
        display: 'standalone',
        theme_color: '#7c8db0',
        background_color: '#ffffff',
        icons: [
          { src: '/icons/icon-192x192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icons/icon-512x512.png', sizes: '512x512', type: 'image/png' },
          { src: '/icons/icon-512x512-maskable.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      devOptions: { enabled: false },
    }),
  ],
  base: '/',
  resolve: {
    alias: {
      '@': '/src',
      ...(process.env.LOCAL_COMMON
        ? { '@mentalhelpglobal/chat-frontend-common': path.resolve(__dirname, '../chat-frontend-common/src') }
        : {}),
    },
  },
  build: {
    commonjsOptions: {
      include: [/chat-types/, /chat-frontend-common/, /node_modules/],
    },
  },
})

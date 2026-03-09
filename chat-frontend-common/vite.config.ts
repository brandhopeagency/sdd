import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import dts from 'vite-plugin-dts'
import { resolve } from 'path'

export default defineConfig({
  plugins: [
    react(),
    dts({ rollupTypes: true }),
  ],
  build: {
    lib: {
      entry: resolve(__dirname, 'src/index.ts'),
      formats: ['es'],
      fileName: 'index',
    },
    rollupOptions: {
      external: [
        'react',
        'react-dom',
        'react/jsx-runtime',
        'react-router-dom',
        'zustand',
        'zustand/middleware',
        'i18next',
        'i18next-browser-languagedetector',
        'react-i18next',
        'lucide-react',
      ],
    },
    commonjsOptions: {
      include: [/chat-types/, /node_modules/],
    },
  },
})

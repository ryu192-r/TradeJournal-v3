import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { sentryVitePlugin } from "@sentry/vite-plugin"
import { fileURLToPath } from 'url'
import { dirname, resolve } from 'path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    process.env.SENTRY_DSN ? sentryVitePlugin({
      authToken: process.env.SENTRY_AUTH_TOKEN,
      org: process.env.SENTRY_ORG,
      project: process.env.SENTRY_PROJECT,
    }) : null,
  ].filter(Boolean),
  resolve: {
    alias: {
      '@': resolve(__dirname, './src'),
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules/recharts') || id.includes('node_modules/d3-') || id.includes('node_modules/victory-vendor') || id.includes('node_modules/@reduxjs') || id.includes('node_modules/immer') || id.includes('node_modules/decimal.js-light') || id.includes('node_modules/eventemitter3')) {
            return 'vendor-recharts'
          }
          if (id.includes('node_modules/framer-motion') || id.includes('node_modules/motion-')) {
            return 'vendor-motion'
          }
          if (id.includes('node_modules/zod') || id.includes('node_modules/react-hook-form') || id.includes('node_modules/@hookform')) {
            return 'vendor-forms'
          }
          if (id.includes('node_modules/axios')) {
            return 'vendor-http'
          }
        },
      },
    },
  },
})

import { fileURLToPath, URL } from 'node:url'

import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import vueDevTools from 'vite-plugin-vue-devtools'

// https://vite.dev/config/
// Detect GitHub Pages environment to set correct base path automatically
const repoName = process.env.GITHUB_REPOSITORY?.split('/')?.[1] || ''
const isCI = process.env.GITHUB_ACTIONS === 'true'

export default defineConfig({
  plugins: [
    vue(),
    vueDevTools(),
  ],
  // For GitHub Pages project pages, assets should be served from /<repo>/
  base: isCI && repoName ? `/${repoName}/` : '/',
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url))
    },
  },
})

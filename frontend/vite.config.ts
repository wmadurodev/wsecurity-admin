import { fileURLToPath, URL } from 'node:url'

import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import type { Plugin } from 'vite'
import { defineConfig } from 'vitest/config'

/** BFF local (RNF-OPE-04): o Vite repassa as rotas do servidor e o navegador vê uma só origem (5174). */
const BFF = process.env.BFF_URL ?? 'http://localhost:9200'
const BFF_ROUTES = ['/bff', '/oauth2', '/login', '/no-access', '/pages']

/**
 * O sonner injeta um <style> ao carregar, o que a CSP sem 'unsafe-inline' bloqueia (RNF-SEG-04, Q-07). O CSS dele é
 * importado como arquivo (src/main.tsx) e a injeção vira uma função vazia.
 */
function sonnerWithoutInlineStyles(): Plugin {
  return {
    name: 'sonner-sem-estilo-inline',
    enforce: 'pre',
    transform(code, id) {
      if (!id.includes('/node_modules/sonner/dist/')) {
        return null
      }
      return {
        code: code.replace('function __insertCSS(code) {', 'function __insertCSS(code) {\n  return;'),
        map: null,
      }
    },
  }
}

// A SPA é construída direto em target/classes/static, de onde o BFF a serve (DEC-10, RNF-TEC-04).
export default defineConfig({
  plugins: [sonnerWithoutInlineStyles(), react(), tailwindcss()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  server: {
    port: 5174,
    strictPort: true,
    // Host preservado (localhost:5174) e X-Forwarded-*: o BFF monta as URLs de retorno do login com a origem do Vite.
    proxy: Object.fromEntries(BFF_ROUTES.map((route) => [route, { target: BFF, changeOrigin: false, xfwd: true }])),
  },
  build: {
    outDir: '../target/classes/static',
    emptyOutDir: true,
    assetsDir: 'assets',
    rollupOptions: {
      output: {
        entryFileNames: 'assets/[name]-[hash].js',
        chunkFileNames: 'assets/[name]-[hash].js',
        assetFileNames: 'assets/[name]-[hash][extname]',
      },
    },
  },
  test: {
    environment: 'jsdom',
    globals: false,
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.test.{ts,tsx}'],
  },
})

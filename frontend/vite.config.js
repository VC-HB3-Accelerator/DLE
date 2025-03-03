import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import polyfillNode from 'rollup-plugin-polyfill-node'
import path from 'path'

export default defineConfig({
  plugins: [
    vue(),
    polyfillNode({
      include: ['buffer', 'process', 'util']
    })
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
      buffer: 'buffer/'
    }
  },
  define: {
    'global': 'globalThis',
    'process.env': {}
  },
  build: {
    rollupOptions: {
      plugins: [
        polyfillNode()
      ]
    }
  },
  optimizeDeps: {
    esbuildOptions: {
      loader: {
        '.js': 'jsx'
      }
    }
  },
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:8000',
        changeOrigin: true
      }
    }
  }
}) 
import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import polyfillNode from 'rollup-plugin-polyfill-node';
import { fileURLToPath } from 'url';
import path, { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Host `yarn dev`: имя dapp-backend не резолвится. По умолчанию — nginx :9000 (compose).
// Прямо в backend: VITE_API_PROXY=http://172.x.x.x:8000 или http://dapp-backend:8000 (из сети Docker).
const apiProxyTarget = process.env.VITE_API_PROXY || 'http://127.0.0.1:9000';

export default defineConfig({
  plugins: [
    vue(),
    polyfillNode({
      include: ['buffer', 'process', 'util'],
    }),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
      '@shared': path.resolve(__dirname, '../shared'),
      buffer: 'buffer/',
    },
  },
  define: {
    global: 'globalThis',
    'process.env': {},
  },
  build: {
    rollupOptions: {
      plugins: [polyfillNode()],
      output: {
        manualChunks: undefined,
        chunkFileNames: 'assets/[name]-[hash].js',
        entryFileNames: 'assets/[name]-[hash].js',
        assetFileNames: 'assets/[name]-[hash].[ext]',
      },
    },
    chunkSizeWarningLimit: 1000,
  },
  optimizeDeps: {
    esbuildOptions: {
      loader: {
        '.js': 'jsx',
      },
    },
  },
  server: {
    port: 5173,
    host: '0.0.0.0',
    allowedHosts: ['dapp-frontend', 'localhost', '127.0.0.1', 'hb3-accelerator.com'],
    force: true,
    proxy: {
      '/api': {
        target: apiProxyTarget,
        changeOrigin: true,
        secure: false,
        credentials: true,
        rewrite: (path) => path,
        ws: true,
      },
      '/compile-contracts': {
        target: apiProxyTarget,
        changeOrigin: true,
        secure: false,
        credentials: true,
        rewrite: (path) => path,
      },
      '/v': {
        target: apiProxyTarget,
        changeOrigin: true,
        secure: false,
      },
      '/ws': {
        target: apiProxyTarget,
        ws: true,
        changeOrigin: true,
        secure: false,
        credentials: true,
        rewrite: (path) => path,
        configure: (proxy, options) => {
          proxy.on('error', (err, req, res) => {
            // Игнорируем ошибки ECONNREFUSED при старте сервера - это нормально
            if (err.code === 'ECONNREFUSED' || err.message.includes('ECONNREFUSED')) {
              // Не логируем как ошибку - это нормальное поведение при рестарте сервера
              // Фронтенд автоматически переподключится
              return;
            }
            console.log('WebSocket proxy error:', err.message);
          });
          proxy.on('proxyReqWs', (proxyReq, req, socket) => {
            // Убираем избыточное логирование - это происходит слишком часто
            // console.log('WebSocket proxy request to:', req.url);
          });
          proxy.on('proxyResWs', (proxyRes, req, socket) => {
            // Убираем избыточное логирование
            // console.log('WebSocket proxy response:', proxyRes.statusCode);
          });
        }
      },
    },
    watch: {
      usePolling: true,
      interval: 1000,
      ignored: ['**/node_modules/**', '**/.git/**', '**/dist/**', '**/.idea/**', '**/.vscode/**']
    },
    hmr: false
  },
});

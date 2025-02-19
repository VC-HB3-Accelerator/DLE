import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

export default defineConfig({
  plugins: [vue({
    template: {
      compilerOptions: {
        // Указываем Vue, что appkit-* компоненты являются кастомными элементами
        isCustomElement: (tag) => tag.startsWith('appkit-')
      }
    }
  })]
}) 
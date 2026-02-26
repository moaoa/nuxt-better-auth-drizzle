import { defineConfig } from 'vitest/config'
import vue from '@vitejs/plugin-vue'
import { resolve } from 'path'

export default defineConfig({
  plugins: [vue()],
  test: {
    globals: true,
    environment: 'happy-dom',
    include: ['tests/**/*.test.ts'],
    setupFiles: ['./tests/setup.ts'],
    alias: {
      '~~/': resolve(__dirname, './') + '/',
      '~/': resolve(__dirname, './app/') + '/',
      '#imports': resolve(__dirname, './tests/__mocks__/imports.ts'),
      'h3': resolve(__dirname, './tests/__mocks__/h3.ts'),
    },
  },
  resolve: {
    alias: {
      '~~/': resolve(__dirname, './') + '/',
      '~/': resolve(__dirname, './app/') + '/',
      '#imports': resolve(__dirname, './tests/__mocks__/imports.ts'),
      'h3': resolve(__dirname, './tests/__mocks__/h3.ts'),
    },
  },
})

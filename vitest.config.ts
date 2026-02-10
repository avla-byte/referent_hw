import { defineConfig } from 'vitest/config'
import tsconfig from './tsconfig.json'

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
  },
  resolve: {
    alias: tsconfig.compilerOptions.paths,
  },
})


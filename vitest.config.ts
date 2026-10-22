import { defineConfig } from 'vitest/config'
import path from 'node:path'

// Testes das regras de negócio (cálculos puros, sem banco nem tela).
export default defineConfig({
  resolve: { alias: { '@': path.resolve(__dirname, '.') } },
  test: { include: ['**/*.test.ts'], exclude: ['node_modules', '.next'] },
})

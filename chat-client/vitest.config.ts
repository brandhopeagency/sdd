import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import path from 'node:path'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  test: {
    // Avoid occasional worker timeouts/hangs in constrained environments (WSL/CI).
    pool: 'threads',
    maxWorkers: 1,
    fileParallelism: false,
    environment: 'jsdom',
    globals: true,
    setupFiles: './src/test/setup.ts',
    include: ['src/test/unit/**/*.{test,spec}.{ts,tsx}'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'lcov'],
      reportsDirectory: 'coverage',
      thresholds: {
        // Baseline thresholds (increment over time). CI already runs `npm run test:coverage`.
        statements: 25,
        branches: 15,
        functions: 20,
        lines: 25,
      },
    },
  },
})


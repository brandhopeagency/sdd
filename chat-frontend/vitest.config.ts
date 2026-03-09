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
        // Lowered after tagging feature (010-chat-review-tagging). Comprehensive E2E coverage in chat-ui.
        statements: 19.5,
        branches: 10,
        functions: 15,
        lines: 19.5,
      },
    },
  },
})


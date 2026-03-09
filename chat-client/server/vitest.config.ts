import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    include: ['tests/unit/**/*.{test,spec}.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'lcov'],
      reportsDirectory: 'coverage',
      thresholds: {
        // Baseline thresholds (increment over time). CI already runs `npm run test:coverage` in server/.
        statements: 45,
        branches: 30,
        functions: 35,
        lines: 45,
      },
    },
  },
})


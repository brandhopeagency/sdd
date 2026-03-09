/**
 * Vite plugin: env-check
 *
 * Validates that VITE_API_URL is set and not a localhost value when
 * building for non-development modes. Prevents silent fallback to
 * localhost:3001 in deployed environments.
 *
 * @see specs/008-e2e-test-standards/contracts/vite-env-check-contract.md
 */

// Vite plugins run in Node.js context; declare process for browser-targeted tsconfig
declare const process: { env: Record<string, string | undefined> }

import type { Plugin } from 'vite'

export function envCheck(): Plugin {
  return {
    name: 'vite-plugin-env-check',
    configResolved(config) {
      // Only check during build (not serve) and for non-development modes
      if (config.command !== 'build' || config.mode === 'development') {
        return
      }

      const apiUrl = process.env.VITE_API_URL

      if (!apiUrl || apiUrl.trim() === '') {
        throw new Error(
          `[vite-plugin-env-check] ERROR: VITE_API_URL is required for non-development builds.\n\n` +
            `  Current value: (not set)\n` +
            `  Expected: A fully-qualified URL (e.g., https://chat-backend-dev-xxx.run.app)\n\n` +
            `  To fix:\n` +
            `    export VITE_API_URL="https://your-backend-url"\n` +
            `    npm run build\n\n` +
            `  For local development, use 'npm run dev' instead (localhost fallback is OK).\n`
        )
      }

      if (apiUrl.includes('localhost') || apiUrl.includes('127.0.0.1')) {
        throw new Error(
          `[vite-plugin-env-check] ERROR: VITE_API_URL must not point to localhost for non-development builds.\n\n` +
            `  Current value: ${apiUrl}\n` +
            `  Expected: A fully-qualified URL (e.g., https://chat-backend-dev-xxx.run.app)\n\n` +
            `  To fix:\n` +
            `    export VITE_API_URL="https://your-backend-url"\n` +
            `    npm run build\n\n` +
            `  For local development, use 'npm run dev' instead (localhost fallback is OK).\n`
        )
      }
    },
  }
}

/**
 * Runtime configuration for the shared library.
 *
 * Consuming apps MUST call `configureApi()` before any API calls are made.
 * This avoids baking environment-specific URLs into the library at build time.
 */

interface LibraryConfig {
  apiUrl: string;
  workbenchApiUrl?: string;
}

const DEFAULT_CONFIG: LibraryConfig = {
  apiUrl: 'http://localhost:3001',
};

let _config: LibraryConfig = { ...DEFAULT_CONFIG };
let _configured = false;

export function configureApi(config: LibraryConfig): void {
  _config = {
    ...config,
    apiUrl: config.apiUrl.replace(/\/$/, ''),
    workbenchApiUrl: config.workbenchApiUrl?.replace(/\/$/, ''),
  };
  _configured = true;
}

export function getConfiguredApiUrl(): string {
  if (!_configured && typeof window !== 'undefined') {
    console.warn(
      '[@mentalhelpglobal/chat-frontend-common] configureApi() was not called. Using default API URL.',
    );
  }
  return _config.apiUrl;
}

export function getConfiguredWorkbenchApiUrl(): string {
  return _config.workbenchApiUrl || _config.apiUrl;
}

export function isConfigured(): boolean {
  return _configured;
}

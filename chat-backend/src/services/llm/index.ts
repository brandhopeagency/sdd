import type { LlmClient } from './types';
import { MockLlmClient } from './mock';
import { VertexLlmClient } from './vertex';

export type LlmProviderName = 'vertex' | 'mock';

function getProviderName(): LlmProviderName {
  const explicit = (process.env.LLM_PROVIDER || '').toLowerCase();
  if (explicit === 'vertex') return 'vertex';
  if (explicit === 'mock') return 'mock';

  // Auto-pick: if Vertex project is configured, try Vertex; else mock.
  const hasVertexProject =
    !!process.env.VERTEX_PROJECT_ID || !!process.env.GOOGLE_CLOUD_PROJECT || !!process.env.GCLOUD_PROJECT;
  return hasVertexProject ? 'vertex' : 'mock';
}

let singleton: LlmClient | null = null;
let resolvedProvider: LlmProviderName | null = null;

export function getLlmClient(): LlmClient {
  if (singleton) return singleton;

  const provider = getProviderName();
  resolvedProvider = provider;
  singleton = provider === 'vertex' ? new VertexLlmClient() : new MockLlmClient();
  return singleton;
}

export function getResolvedLlmProviderName(): LlmProviderName {
  // Ensure we resolve the provider consistently with getLlmClient()
  if (resolvedProvider) return resolvedProvider;
  resolvedProvider = getProviderName();
  return resolvedProvider;
}

export * from './types';
export * from './json';


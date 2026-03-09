import type { LlmClient, LlmGenerateOptions, LlmMessage } from './types';

/**
 * Mock LLM client for local/dev environments without Vertex config.
 * This is intentionally simple and deterministic.
 */
export class MockLlmClient implements LlmClient {
  async generateText(messages: LlmMessage[], _options?: LlmGenerateOptions): Promise<string> {
    const lastUser = [...messages].reverse().find((m) => m.role === 'user')?.content || '';

    // If caller asks for JSON, try to provide a minimal valid array.
    const wantsJson = messages.some((m) => m.content.toLowerCase().includes('output') && m.content.toLowerCase().includes('json'));
    if (wantsJson || lastUser.toLowerCase().includes('json')) {
      return JSON.stringify(
        [
          {
            role: 'system',
            content:
              'MEMORY (mock): No Vertex config available. This is placeholder memory; enable Vertex to generate real aggregated facts and state timeline.',
            meta: { kind: 'other', updatedAt: new Date().toISOString() }
          }
        ],
        null,
        2
      );
    }

    return 'Вітаю! Я поруч і готовий підтримати. Як ви себе почуваєте сьогодні?';
  }
}


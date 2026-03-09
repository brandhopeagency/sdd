import type { LlmClient, LlmGenerateOptions, LlmMessage } from './types';

/**
 * Mock LLM client for local/dev environments without Vertex config.
 * This is intentionally simple and deterministic.
 */
export class MockLlmClient implements LlmClient {
  async generateText(messages: LlmMessage[], options?: LlmGenerateOptions): Promise<string> {
    const lastUser = [...messages].reverse().find((m) => m.role === 'user')?.content || '';

    // Return JSON only when the caller explicitly requests JSON output mode.
    // Some natural-language prompts mention "JSON" as context while still expecting plain text.
    if (options?.responseFormat === 'json') {
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


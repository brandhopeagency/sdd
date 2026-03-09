/// <reference types="vitest/globals" />

import { describe, expect, it } from 'vitest';
import { MockLlmClient } from '../../src/services/llm/mock';

describe('MockLlmClient', () => {
  it('returns plain text even if prompt mentions JSON', async () => {
    const client = new MockLlmClient();
    const result = await client.generateText([
      {
        role: 'user',
        content: 'Use MEMORY (JSON) as context and reply with a short greeting only.'
      }
    ]);

    expect(typeof result).toBe('string');
    expect(result).toContain('Вітаю');
    expect(result.trim().startsWith('[')).toBe(false);
  });

  it('returns JSON only when responseFormat=json is explicitly requested', async () => {
    const client = new MockLlmClient();
    const result = await client.generateText(
      [{ role: 'user', content: 'Summarize memory blocks.' }],
      { responseFormat: 'json' }
    );

    const parsed = JSON.parse(result);
    expect(Array.isArray(parsed)).toBe(true);
    expect(parsed[0]?.role).toBe('system');
  });
});

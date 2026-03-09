export type LlmRole = 'system' | 'user' | 'assistant';

export interface LlmMessage {
  role: LlmRole;
  content: string;
}

export interface LlmGenerateOptions {
  temperature?: number;
  maxOutputTokens?: number;
  topP?: number;
  /**
   * Hint to the provider about desired output.
   * Providers may ignore it; call-sites should still validate/parse.
   */
  responseFormat?: 'text' | 'json';
}

export interface LlmClient {
  /**
   * Generate plain text from a list of chat messages.
   */
  generateText(messages: LlmMessage[], options?: LlmGenerateOptions): Promise<string>;
}


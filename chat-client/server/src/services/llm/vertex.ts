import type { LlmClient, LlmGenerateOptions, LlmMessage } from './types';

function normalizeVertexModelId(model: string): string {
  const m = (model || '').trim();
  if (!m) return m;
  // Vertex SDK expects a "Model Garden model ID" like "gemini-2.5-flash-lite"
  // (or a full resource name). Our configs often use Model Garden IDs in the
  // "publishers/google/models/<id>" form, so strip to the actual id.
  if (m.includes('/')) return m.split('/').pop() || m;
  return m;
}

function getVertexConfig() {
  return {
    project: process.env.VERTEX_PROJECT_ID || process.env.GOOGLE_CLOUD_PROJECT || process.env.GCLOUD_PROJECT,
    location: process.env.VERTEX_LOCATION || 'us-central1',
    // Prefer explicit publisher model id (Model Garden shows e.g. "publishers/google/models/gemini-2.5-flash-lite").
    model: normalizeVertexModelId(process.env.VERTEX_MODEL || 'publishers/google/models/gemini-2.5-flash-lite')
  };
}

function toVertexRole(role: 'user' | 'assistant'): 'user' | 'model' {
  return role === 'assistant' ? 'model' : 'user';
}

export class VertexLlmClient implements LlmClient {
  async generateText(messages: LlmMessage[], options?: LlmGenerateOptions): Promise<string> {
    const { project, location, model } = getVertexConfig();
    if (!project) {
      throw new Error('VERTEX_PROJECT_ID (or GOOGLE_CLOUD_PROJECT) is not set');
    }

    // Lazy import so local dev without deps can still run with Mock provider.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const vertexMod: any = await import('@google-cloud/vertexai');
    const VertexAI = vertexMod.VertexAI || vertexMod.default?.VertexAI || vertexMod.default;
    if (!VertexAI) {
      throw new Error('Failed to load @google-cloud/vertexai VertexAI export');
    }

    const vertexAi = new VertexAI({ project, location });

    const systemText = messages
      .filter((m) => m.role === 'system')
      .map((m) => m.content)
      .join('\n\n');

    const modelClient = vertexAi.getGenerativeModel({
      model,
      ...(systemText
        ? {
            systemInstruction: {
              parts: [{ text: systemText }]
            }
          }
        : {})
    });

    const nonSystem = messages.filter((m) => m.role !== 'system');
    const contents = nonSystem.map((m) => ({
      role: toVertexRole(m.role === 'assistant' ? 'assistant' : 'user'),
      parts: [{ text: m.content }]
    }));

    const generationConfig: Record<string, unknown> = {
      temperature: options?.temperature ?? 0.2,
      maxOutputTokens: options?.maxOutputTokens ?? 2048,
      topP: options?.topP ?? 0.95
    };
    if (options?.responseFormat === 'json') {
      // Supported by Gemini models in Vertex; ignored if unsupported.
      generationConfig.responseMimeType = 'application/json';
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result: any = await modelClient.generateContent({
      contents,
      generationConfig
    });

    const parts = result?.response?.candidates?.[0]?.content?.parts;
    const text = Array.isArray(parts) ? parts.map((p: any) => p.text || '').join('') : '';
    return (text || '').trim();
  }
}


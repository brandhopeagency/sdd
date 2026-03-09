/**
 * Utilities for extracting JSON from LLM output.
 * We keep this defensive because providers sometimes wrap JSON in Markdown fences.
 */

export function extractFirstJsonArray(text: string): unknown[] {
  const trimmed = (text || '').trim();
  if (!trimmed) throw new Error('Empty LLM output');

  // Fast path: output is directly a JSON array.
  if (trimmed.startsWith('[')) {
    return JSON.parse(trimmed) as unknown[];
  }

  // Try to strip ```json ... ``` fences.
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  if (fenced?.[1]) {
    const inner = fenced[1].trim();
    if (inner.startsWith('[')) return JSON.parse(inner) as unknown[];
  }

  // Fallback: find the first [ ... ] block (best-effort).
  const start = trimmed.indexOf('[');
  const end = trimmed.lastIndexOf(']');
  if (start >= 0 && end > start) {
    const slice = trimmed.slice(start, end + 1);
    return JSON.parse(slice) as unknown[];
  }

  throw new Error('Could not extract JSON array from LLM output');
}


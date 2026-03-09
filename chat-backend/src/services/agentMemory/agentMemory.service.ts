import type { AgentMemorySystemMessage } from '../../types/agentMemory';
import type { StoredConversation } from '../../types/conversation';
import { getAgentMemorySystemMessages, saveAgentMemorySystemMessages } from '../gcs.service';
import { extractFirstJsonArray, getLlmClient, getResolvedLlmProviderName, type LlmMessage } from '../llm';
import { buildAgentMemoryAggregationPrompt, buildInitialAssistantMessagePrompt } from './prompts';

function isUuid(value: string): boolean {
  // Simple UUID v4-ish check (also accepts other UUID versions)
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
}

/**
 * Memory is only enabled for authenticated users (UUID principals).
 * Guest users must not have memory persisted or injected.
 */
export function isMemoryEnabledPrincipal(principalId: string | null): principalId is string {
  return typeof principalId === 'string' && isUuid(principalId);
}

type MemoryKind = 'facts' | 'preferences' | 'state_timeline' | 'other';

function detectKind(m: AgentMemorySystemMessage): MemoryKind {
  const kind = m?.meta?.kind ? String(m.meta.kind).toLowerCase() : '';
  if (kind === 'facts') return 'facts';
  if (kind === 'preferences') return 'preferences';
  if (kind === 'state_timeline' || kind === 'state timeline' || kind === 'state-timeline') return 'state_timeline';

  const content = (m.content || '').trim();
  if (/^memory:\s*facts\b/i.test(content)) return 'facts';
  if (/^memory:\s*preferences\b/i.test(content)) return 'preferences';
  if (/^memory:\s*state\s*timeline\b/i.test(content)) return 'state_timeline';
  return 'other';
}

function maxUpdatedAt(msgs: AgentMemorySystemMessage[]): string | undefined {
  let max: string | undefined;
  for (const m of msgs) {
    const ts = m?.meta?.updatedAt;
    if (typeof ts !== 'string' || !ts) continue;
    if (!max || new Date(ts).getTime() > new Date(max).getTime()) max = ts;
  }
  return max;
}

function stripHeader(content: string, headerRe: RegExp): string {
  const m = content.match(headerRe);
  if (!m) return content;
  return content.slice(m[0].length).trim();
}

function compactFacts(msgs: AgentMemorySystemMessage[]): AgentMemorySystemMessage | null {
  if (msgs.length === 0) return null;

  const kv = new Map<string, string>();
  const free = new Set<string>();

  for (const m of msgs) {
    const raw = (m.content || '').trim();
    const withoutHeader = stripHeader(raw, /^memory:\s*facts(?:\s*\(fallback\))?\s*:\s*/i);
    const tokens = withoutHeader
      .split(/(?:\s*•\s*|\s*;\s*|\s*\|\s*)/g)
      .map((t) => t.trim())
      .filter(Boolean);

    for (const t of tokens) {
      const idx = t.indexOf(':');
      if (idx > 0) {
        const k = t.slice(0, idx).trim();
        const v = t.slice(idx + 1).trim();
        if (k && v) kv.set(k, v);
        else if (t) free.add(t);
      } else {
        free.add(t);
      }
    }
  }

  const parts: string[] = [];
  for (const [k, v] of Array.from(kv.entries()).sort(([a], [b]) => a.localeCompare(b))) {
    parts.push(`${k}: ${v}`);
  }
  for (const t of Array.from(free.values()).sort((a, b) => a.localeCompare(b))) {
    parts.push(t);
  }

  if (parts.length === 0) return null;

  return {
    role: 'system',
    content: `MEMORY: Facts: ${parts.join(' • ')}`,
    meta: { kind: 'facts', updatedAt: maxUpdatedAt(msgs) }
  };
}

function compactPreferences(msgs: AgentMemorySystemMessage[]): AgentMemorySystemMessage | null {
  if (msgs.length === 0) return null;

  const set = new Set<string>();
  for (const m of msgs) {
    const raw = (m.content || '').trim();
    const withoutHeader = stripHeader(raw, /^memory:\s*preferences\s*:\s*/i);
    const tokens = withoutHeader
      .split(/(?:\s*•\s*|\s*;\s*|\s*\|\s*)/g)
      .map((t) => t.trim())
      .filter(Boolean);
    for (const t of tokens) set.add(t);
  }

  const parts = Array.from(set.values()).sort((a, b) => a.localeCompare(b));
  if (parts.length === 0) return null;
  return {
    role: 'system',
    content: `MEMORY: Preferences: ${parts.join(' • ')}`,
    meta: { kind: 'preferences', updatedAt: maxUpdatedAt(msgs) }
  };
}

function parseTimelineLines(content: string): string[] {
  const raw = (content || '').trim();
  const withoutHeader = stripHeader(raw, /^memory:\s*state\s*timeline\s*:\s*/i);
  return withoutHeader
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.length > 0);
}

function lineTimeKey(line: string): number | null {
  // Expected: "- 2026-01-01T...: ..."
  const m = line.match(/^\-\s*([0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9:.]+Z?)\s*:/);
  if (!m) return null;
  const t = Date.parse(m[1]);
  return Number.isFinite(t) ? t : null;
}

function compactStateTimeline(msgs: AgentMemorySystemMessage[]): AgentMemorySystemMessage | null {
  if (msgs.length === 0) return null;

  const set = new Map<string, number>(); // line -> timeKey for ordering
  for (const m of msgs) {
    for (const line of parseTimelineLines(m.content)) {
      const key = lineTimeKey(line);
      set.set(line, key ?? -1);
    }
  }

  const lines = Array.from(set.entries())
    .sort((a, b) => (a[1] ?? -1) - (b[1] ?? -1))
    .map(([line]) => line);

  const tail = lines.slice(-20);
  if (tail.length === 0) return null;

  const normalizedLines = tail.map((l) => (l.startsWith('-') ? l : `- ${l}`));
  return {
    role: 'system',
    content: `MEMORY: State timeline:\n${normalizedLines.join('\n')}`,
    meta: { kind: 'state_timeline', updatedAt: maxUpdatedAt(msgs) }
  };
}

function compactMemory(memory: AgentMemorySystemMessage[]): AgentMemorySystemMessage[] {
  const facts: AgentMemorySystemMessage[] = [];
  const prefs: AgentMemorySystemMessage[] = [];
  const timeline: AgentMemorySystemMessage[] = [];
  const other: AgentMemorySystemMessage[] = [];

  const seenOther = new Set<string>();
  for (const m of memory) {
    const kind = detectKind(m);
    if (kind === 'facts') facts.push(m);
    else if (kind === 'preferences') prefs.push(m);
    else if (kind === 'state_timeline') timeline.push(m);
    else {
      const key = (m.content || '').trim();
      if (!key) continue;
      if (seenOther.has(key)) continue;
      seenOther.add(key);
      other.push(m);
    }
  }

  const out: AgentMemorySystemMessage[] = [];
  const f = compactFacts(facts);
  if (f) out.push(f);
  const p = compactPreferences(prefs);
  if (p) out.push(p);
  const t = compactStateTimeline(timeline);
  if (t) out.push(t);

  // Keep any other memory entries, but bounded.
  out.push(...other.slice(-10));
  return out;
}

function normalizeSystemMessages(raw: unknown[]): AgentMemorySystemMessage[] {
  const out: AgentMemorySystemMessage[] = [];

  const isNoDataPlaceholder = (text: string) =>
    /(?:немає даних|нет данных|no data)/i.test(text);

  const isRecapLike = (text: string, kind?: string) => {
    if (kind && String(kind).toLowerCase() === 'recap') return true;
    if (/^memory:\s*recap\b/i.test(text)) return true;
    // Guardrail: do not store transcript-like content (chat history) in memory.
    if (/\bUSER\s*:|\bASSISTANT\s*:/i.test(text)) return true;
    return false;
  };

  for (const item of raw) {
    if (!item || typeof item !== 'object') continue;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const m: any = item;
    if (m.role !== 'system') continue;
    if (typeof m.content !== 'string') continue;

    const content = String(m.content || '').trim();
    if (!content) continue;

    const kind = m?.meta?.kind ? String(m.meta.kind) : undefined;
    if (isNoDataPlaceholder(content)) continue;
    if (isRecapLike(content, kind)) continue;

    out.push({
      role: 'system',
      content,
      meta: m.meta && typeof m.meta === 'object' ? m.meta : undefined
    });
  }

  return out;
}

export async function loadAgentMemory(principalId: string): Promise<AgentMemorySystemMessage[]> {
  if (!isMemoryEnabledPrincipal(principalId)) return [];
  const memory = await getAgentMemorySystemMessages(principalId);
  // Ensure role/content are sane even if stored file was old/dirty.
  const filtered = memory
    .map((m) => ({ ...m, role: 'system' as const, content: (m.content || '').trim() }))
    .filter((m) => m.content.length > 0)
    // Backward-compat: strip legacy recap/transcript-like entries and empty placeholders.
    .filter((m) => {
      const content = (m.content || '').trim();
      if (!content) return false;
      if (/(?:немає даних|нет данных|no data)/i.test(content)) return false;
      const kind = m?.meta?.kind ? String(m.meta.kind) : '';
      if (kind.toLowerCase() === 'recap') return false;
      if (/^memory:\s*recap\b/i.test(content)) return false;
      if (/\bUSER\s*:|\bASSISTANT\s*:/i.test(content)) return false;
      return true;
    });

  // Also compact to avoid showing multiple near-duplicate blocks across sessions.
  return compactMemory(filtered);
}

function buildFallbackFactsMemory(existingMemory: AgentMemorySystemMessage[], conversation: StoredConversation): AgentMemorySystemMessage[] {
  const userMessages = conversation.messages
    .filter((m) => m.role === 'user')
    .map((m) => String(m.content || '').trim())
    .filter((t) => t.length > 0);

  const userText = userMessages.join('\n');

  // --- Heuristic extraction (best-effort, multilingual-ish) ---
  const extractName =
    userText.match(/(?:мене звати|моє ім['’]я|меня зовут|my name is|i am)\s+([^\n.,!?:;]{2,64})/i)?.[1]?.trim() ||
    userText.match(/\bя\s+([A-ZА-ЯІЇЄ][A-Za-zА-Яа-яІіЇїЄє'’_-]{1,40})\b/u)?.[1]?.trim() ||
    null;

  const extractAge =
    userText.match(/(?:мені|мне)\s+(\d{1,3})\s*(?:роки|років|лет)\b/i)?.[1] ||
    userText.match(/\b(\d{1,3})\s*years old\b/i)?.[1] ||
    userText.match(/\bi am\s+(\d{1,3})\b/i)?.[1] ||
    null;

  const extractJob =
    userText.match(/(?:я працюю(?:\s+як)?|працюю\s+як|работаю(?:\s+как)?|i work as|i'm an?|i am an?)\s+([^\n.,!?:;]{2,96})/i)?.[1]?.trim() ||
    userText.match(/(?:я\s+)(програміст|программист|розробник|разработчик|qa|тестувальник|тестировщик|лікар|врач|психолог|психотерапевт|викладач|учитель|студент)/i)?.[1]?.trim() ||
    null;

  const facts: string[] = [];
  if (extractName) facts.push(`Ім'я: ${extractName}`);
  if (extractAge) facts.push(`Вік: ${extractAge}`);
  if (extractJob) facts.push(`Професія: ${extractJob}`);

  const base = [...existingMemory];

  const hasContent = (needle: string) =>
    base.some((m) => typeof m.content === 'string' && m.content.trim() === needle.trim());

  if (facts.length > 0) {
    const factsLine = `MEMORY: Facts: ${facts.join(' • ')}`;
    if (!hasContent(factsLine)) base.push({
      role: 'system',
      content: factsLine,
      meta: { kind: 'facts' }
    });
  }

  // Keep memory bounded (oldest items first) to avoid unbounded growth in fallback mode.
  return base.slice(-20);
}

function mergeMemory(existing: AgentMemorySystemMessage[], updated: AgentMemorySystemMessage[]): AgentMemorySystemMessage[] {
  const out: AgentMemorySystemMessage[] = [];
  const seen = new Set<string>();

  const add = (m: AgentMemorySystemMessage) => {
    const key = (m.content || '').trim();
    if (!key) return;
    if (seen.has(key)) return;
    seen.add(key);
    out.push(m);
  };

  // Prefer updated ordering, but never drop existing entries unless explicitly removed.
  for (const m of updated) add(m);
  for (const m of existing) add(m);

  return out;
}

export async function updateAgentMemoryOnSessionEnd(input: {
  principalId: string | null;
  conversation: StoredConversation;
}): Promise<{ savedPath: string; messageCount: number } | null> {
  const { principalId, conversation } = input;
  if (!isMemoryEnabledPrincipal(principalId)) return null;

  const existingMemory = await loadAgentMemory(principalId);
  let memoryToSave: AgentMemorySystemMessage[] = existingMemory;
  const provider = getResolvedLlmProviderName();
  const llmModelRaw = process.env.VERTEX_MODEL || null;
  const llmModel = llmModelRaw && llmModelRaw.includes('/') ? (llmModelRaw.split('/').pop() || llmModelRaw) : llmModelRaw;
  const llmLocation = process.env.VERTEX_LOCATION || null;
  let aggregatedBy: 'llm' | 'fallback' = 'fallback';

  try {
    if (provider !== 'vertex') {
      throw new Error(`LLM provider is '${provider}' (expected 'vertex')`);
    }

    const prompt = buildAgentMemoryAggregationPrompt({ existingMemory, conversation });
    const llm = getLlmClient();
    const llmMessages: LlmMessage[] = [
      {
        role: 'system',
        content:
          'You are a strict JSON generator. Output must be valid JSON only, no markdown, no explanations.'
      },
      { role: 'user', content: prompt }
    ];

    // Retry a couple times before falling back (Vertex transient errors happen).
    let rawText = '';
    let lastErr: unknown = null;
    for (let attempt = 1; attempt <= 2; attempt++) {
      try {
        rawText = await llm.generateText(llmMessages, { responseFormat: 'json', temperature: 0.1, maxOutputTokens: 2048 });
        lastErr = null;
        break;
      } catch (e) {
        lastErr = e;
        await new Promise((r) => setTimeout(r, 250 * attempt));
      }
    }
    if (lastErr) throw lastErr;

    const parsed = extractFirstJsonArray(rawText);
    const updatedMemory = normalizeSystemMessages(parsed);

    // If model returned nothing valid, keep existing memory (do not wipe).
    // If it returned something, MERGE with existing to avoid accidental loss of older facts.
    memoryToSave = updatedMemory.length > 0 ? mergeMemory(existingMemory, updatedMemory) : existingMemory;
    aggregatedBy = 'llm';
  } catch (e) {
    // If LLM is not configured/available (e.g., Vertex model access), fall back to a minimal deterministic extractor
    // so memory "works" in dev without external dependencies.
    console.warn('[AgentMemory] LLM aggregation failed; using fallback memory extractor:', {
      provider,
      model: llmModel,
      location: llmLocation,
      error: e
    });
    memoryToSave = buildFallbackFactsMemory(existingMemory, conversation);
    aggregatedBy = 'fallback';
  }

  // Always compact before saving to prevent duplicate blocks across sessions.
  memoryToSave = compactMemory(memoryToSave);

  // Stamp meta.updatedAt for entries that don't have it.
  const nowIso = new Date().toISOString();
  const stamped = memoryToSave.map((m) => ({
    ...m,
    meta: {
      ...(m.meta || {}),
      updatedAt: (m.meta && m.meta.updatedAt) || nowIso,
      aggregatedBy,
      llmProvider: provider,
      llmModel: llmModel || undefined,
      llmLocation: llmLocation || undefined,
      sourceSessionId: (m.meta && m.meta.sourceSessionId) || conversation.sessionId,
      languageCode: (m.meta && m.meta.languageCode) || conversation.metadata.languageCode
    }
  }));

  const savedPath = await saveAgentMemorySystemMessages(principalId, stamped);
  return { savedPath, messageCount: stamped.length };
}

export async function generateInitialAssistantMessage(input: {
  principalId: string | null;
  languageCode: string;
}): Promise<{ memory: AgentMemorySystemMessage[]; initialAssistantMessage: string | null }> {
  const { principalId, languageCode } = input;
  if (!isMemoryEnabledPrincipal(principalId)) return { memory: [], initialAssistantMessage: null };

  const memory = await loadAgentMemory(principalId);
  if (memory.length === 0) return { memory, initialAssistantMessage: null };

  const llm = getLlmClient();
  const prompt = buildInitialAssistantMessagePrompt({ memory, languageCode });
  const text = await llm.generateText([{ role: 'user', content: prompt }], { temperature: 0.4, maxOutputTokens: 256 });
  const cleaned = (text || '').trim();

  return { memory, initialAssistantMessage: cleaned || null };
}

function formatSurveyMemoryContent(input: {
  instanceId: string;
  instanceTitle: string;
  schemaSnapshot: any;
  answers: Array<{ questionId: string; value: string | string[] | boolean | null; visible?: boolean }>;
  completedAt: string | null;
}): string {
  const { instanceId, instanceTitle, schemaSnapshot, answers, completedAt } = input;
  const questions: any[] = Array.isArray(schemaSnapshot?.questions) ? schemaSnapshot.questions : [];

  const answerByQid = new Map<string, { value: any; visible: boolean }>();
  for (const a of answers || []) {
    answerByQid.set(String(a.questionId), {
      value: a.value,
      visible: a.visible !== false,
    });
  }

  const fmt = (v: any) => {
    if (v === null || v === undefined || v === '') return '(no answer)';
    if (Array.isArray(v)) return v.slice().map(String).sort((a, b) => a.localeCompare(b)).join(', ') || '(no answer)';
    if (typeof v === 'boolean') return v ? 'true' : 'false';
    return String(v);
  };

  const ordered = questions
    .slice()
    .sort((a, b) => (Number(a?.order ?? 0) - Number(b?.order ?? 0)) || String(a?.id ?? '').localeCompare(String(b?.id ?? '')));

  const lines: string[] = [];
  for (const q of ordered) {
    const qid = String(q?.id ?? '');
    if (!qid) continue;
    const entry = answerByQid.get(qid);
    if (entry && !entry.visible) continue;
    const order = Number.isFinite(Number(q?.order)) ? Number(q.order) : undefined;
    const label = order ? `${order}.` : '-';
    const text = String(q?.text ?? '').trim();
    const ans = fmt(entry?.value);
    lines.push(`${label} [${qid}] ${text} — ${ans}`.trim());
  }

  const header = [
    'MEMORY: Survey:',
    `InstanceId: ${instanceId}`,
    `Title: ${instanceTitle}`,
    `CompletedAt: ${completedAt ?? '(unknown)'}`,
    'Answers:',
  ];

  return `${header.join('\n')}\n${lines.map((l) => `- ${l}`).join('\n')}`;
}

export async function upsertSurveyMemoryEntry(input: {
  principalId: string | null;
  instanceId: string;
  instanceTitle: string;
  schemaSnapshot: any;
  answers: Array<{ questionId: string; value: string | string[] | boolean | null; visible?: boolean }>;
  completedAt: string | null;
}): Promise<{ savedPath: string; messageCount: number } | null> {
  const { principalId, instanceId, instanceTitle, schemaSnapshot, answers, completedAt } = input;
  if (!isMemoryEnabledPrincipal(principalId)) return null;

  const existing = await loadAgentMemory(principalId);
  const filtered = existing.filter((m) => {
    const kind = m?.meta?.kind ? String(m.meta.kind).toLowerCase() : '';
    if (kind !== 'survey') return true;
    const iid = (m as any)?.meta?.instanceId ? String((m as any).meta.instanceId) : '';
    return iid !== instanceId;
  });

  const nowIso = new Date().toISOString();
  const content = formatSurveyMemoryContent({ instanceId, instanceTitle, schemaSnapshot, answers, completedAt });
  const entry: AgentMemorySystemMessage = {
    role: 'system',
    content,
    meta: {
      kind: 'survey',
      instanceId,
      updatedAt: nowIso,
    },
  };

  const toSave = compactMemory([...filtered, entry]);
  const savedPath = await saveAgentMemorySystemMessages(principalId, toSave);
  return { savedPath, messageCount: toSave.length };
}

export async function removeSurveyMemoryEntry(input: {
  principalId: string | null;
  instanceId: string;
}): Promise<{ savedPath: string; messageCount: number } | null> {
  const { principalId, instanceId } = input;
  if (!isMemoryEnabledPrincipal(principalId)) return null;

  const existing = await loadAgentMemory(principalId);
  const filtered = existing.filter((m) => {
    const kind = m?.meta?.kind ? String(m.meta.kind).toLowerCase() : '';
    if (kind !== 'survey') return true;
    const iid = (m as any)?.meta?.instanceId ? String((m as any).meta.instanceId) : '';
    return iid !== instanceId;
  });

  const toSave = compactMemory(filtered);
  const savedPath = await saveAgentMemorySystemMessages(principalId, toSave);
  return { savedPath, messageCount: toSave.length };
}


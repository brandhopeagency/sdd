/// <reference types="vitest/globals" />

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mockQuery = vi.fn()

vi.mock('../../src/db', () => ({
  getPool: () => ({ query: mockQuery }),
}))

vi.mock('uuid', () => ({
  v4: () => '11111111-1111-1111-1111-111111111111',
}))

vi.mock('../../src/services/gcs.service', () => ({
  saveConversation: vi.fn(async () => ({ jsonPath: 'gs://bucket/conversations/s1.json', jsonlPath: 'gs://bucket/conversations/s1.jsonl' })),
  deleteConversation: vi.fn(async () => {}),
}))

vi.mock('../../src/services/sessionExclusion.service', () => ({
  evaluateSession: vi.fn(async () => []),
}))

describe('session.service', () => {
  beforeEach(async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-01-01T00:00:00.000Z'))
    mockQuery.mockReset()
    const { saveConversation } = await import('../../src/services/gcs.service')
    vi.mocked(saveConversation).mockClear()
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.resetModules()
  })

  it('createSession: creates in-memory session and best-effort persists it', async () => {
    // ensureSessionPersisted: SELECT exists -> no rows; userId=null => no group query; INSERT sessions
    mockQuery
      .mockResolvedValueOnce({ rows: [] }) // SELECT 1 FROM sessions
      .mockResolvedValueOnce({ rows: [] }) // INSERT INTO sessions

    const svc = await import('../../src/services/session.service')
    const meta = await svc.createSession(null, 'uk')

    expect(meta.id).toBe('11111111-1111-1111-1111-111111111111')
    expect(meta.status).toBe('active')
    expect(meta.languageCode).toBe('uk')

    const conv = svc.getActiveConversation(meta.id)
    expect(conv?.sessionId).toBe(meta.id)
    expect(conv?.messages).toHaveLength(0)

    expect(String(mockQuery.mock.calls[0][0])).toContain('SELECT 1 FROM sessions')
    expect(String(mockQuery.mock.calls[1][0])).toContain('INSERT INTO sessions')
  })

  it('addMessage: restores from DB when not in memory and parses JSON fields', async () => {
    const sessionId = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'

    // getSessionMetadata() -> SELECT * FROM sessions
    mockQuery
      .mockResolvedValueOnce({
        rows: [
          {
            id: sessionId,
            user_id: null,
            guest_id: 'guest_1',
            dialogflow_session_id: 'df_1',
            status: 'active',
            started_at: new Date('2026-01-01T00:00:00.000Z'),
            ended_at: null,
            message_count: 1,
            language_code: 'uk',
            gcs_path: null,
            created_at: new Date('2026-01-01T00:00:00.000Z'),
            updated_at: new Date('2026-01-01T00:00:00.000Z'),
          },
        ],
      })
      // restore: SELECT * FROM session_messages
      .mockResolvedValueOnce({
        rows: [
          {
            id: 'm1',
            role: 'user',
            content: 'hi',
            timestamp: '2026-01-01T00:00:01.000Z',
            intent_info: JSON.stringify({ displayName: 'x' }),
            match_info: JSON.stringify({ parameters: { a: 1 } }),
            generative_info: null,
            webhook_statuses: null,
            diagnostic_info: null,
            sentiment: null,
            flow_info: null,
            system_prompts: JSON.stringify([{ role: 'system', content: 's' }]),
            response_time_ms: 12,
            feedback: JSON.stringify({ rating: 5, comment: null }),
          },
        ],
      })
      // ensureSessionPersisted: SELECT exists -> already exists
      .mockResolvedValueOnce({ rows: [{ '1': 1 }] })
      // INSERT session_messages (new message)
      .mockResolvedValueOnce({ rows: [] })
      // UPDATE sessions message_count
      .mockResolvedValueOnce({ rows: [] })

    const svc = await import('../../src/services/session.service')

    const newMessage = {
      id: 'm2',
      role: 'assistant',
      content: 'hello',
      timestamp: '2026-01-01T00:00:02.000Z',
      intent: { displayName: 'intent2' },
      match: { parameters: { b: 2 } },
      generativeInfo: { model: 'x' },
      webhookStatuses: [{ status: 'OK' }],
      diagnosticInfo: { traceId: 't' },
      sentiment: { score: 0.1 },
      flowInfo: { flow: 'f' },
      systemPrompts: [{ role: 'system', content: 'p' }],
      responseTimeMs: 34,
      feedback: { rating: 4, comment: 'good', submittedAt: '2026-01-01T00:00:02.000Z' },
    } as any

    await svc.addMessage(sessionId, newMessage)

    const conv = svc.getActiveConversation(sessionId)
    expect(conv).not.toBeNull()
    expect(conv?.messages).toHaveLength(2)
    expect(conv?.messages[0].intent).toEqual({ displayName: 'x' })
    expect(conv?.messages[0].match).toEqual({ parameters: { a: 1 } })
    expect(conv?.messages[1].intent).toEqual({ displayName: 'intent2' })

    // Verifies JSON.stringify usage on insert
    const insertArgs = mockQuery.mock.calls.find((c) => String(c[0]).includes('INSERT INTO session_messages'))?.[1] as any[]
    expect(insertArgs).toBeTruthy()
    expect(insertArgs[0]).toBe('m2')
    expect(insertArgs[5]).toBe(JSON.stringify(newMessage.intent))
    expect(insertArgs[6]).toBe(JSON.stringify(newMessage.match))
    expect(insertArgs[12]).toBe(JSON.stringify(newMessage.systemPrompts))
    expect(insertArgs[14]).toBe(JSON.stringify(newMessage.feedback))
  })

  it('addMessage: rolls back in-memory message when DB insert fails (and deletes empty session row if it was just created)', async () => {
    // createSession should NOT persist (simulate DB error); createSession catches and continues with in-memory session.
    mockQuery.mockRejectedValueOnce(new Error('persist unavailable')) // createSession ensureSessionPersisted: SELECT exists throws

    const svc = await import('../../src/services/session.service')
    const meta = await svc.createSession('guest_2', 'uk')

    // addMessage: ensureSessionPersisted will INSERT session row successfully and return true,
    // then message INSERT fails -> service rolls back memory and best-effort deletes the empty session row.
    mockQuery
      .mockResolvedValueOnce({ rows: [] }) // ensureSessionPersisted: SELECT 1 FROM sessions
      .mockResolvedValueOnce({ rows: [] }) // ensureSessionPersisted: INSERT INTO sessions
      .mockRejectedValueOnce(Object.assign(new Error('insert failed'), { code: 'X' })) // INSERT INTO session_messages fails
      .mockResolvedValueOnce({ rows: [] }) // best-effort DELETE FROM sessions (no 0-message sessions)

    const message = { id: 'm1', role: 'user', content: 'x', timestamp: '2026-01-01T00:00:01.000Z' } as any
    await expect(svc.addMessage(meta.id, message)).rejects.toThrow('insert failed')

    const conv = svc.getActiveConversation(meta.id)
    expect(conv?.messages).toHaveLength(0)
  })

  it('endSession: saves to GCS, updates sessions, deletes session_messages, and clears memory', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [] }) // createSession ensureSessionPersisted exists
      .mockResolvedValueOnce({ rows: [] }) // createSession insert session

    const svc = await import('../../src/services/session.service')
    const meta = await svc.createSession('guest_1', 'uk')
    await svc.addMessage(meta.id, { id: 'm1', role: 'user', content: 'hi', timestamp: '2026-01-01T00:00:01.000Z' } as any).catch(() => {
      // ignore; addMessage would require more DB mocks, we only need message in memory for this test
    })
    const conv = svc.getActiveConversation(meta.id)!
    conv.messages.push({ id: 'm1', role: 'user', content: 'hi', timestamp: '2026-01-01T00:00:01.000Z' } as any)
    conv.messages.push({ id: 'm2', role: 'assistant', content: 'hello', timestamp: '2026-01-01T00:00:02.000Z' } as any)
    conv.messages.push({ id: 'm3', role: 'user', content: 'thanks', timestamp: '2026-01-01T00:00:03.000Z' } as any)
    conv.messages.push({ id: 'm4', role: 'assistant', content: 'welcome', timestamp: '2026-01-01T00:00:04.000Z' } as any)
    conv.metadata.messageCount = conv.messages.length

    mockQuery
      .mockResolvedValueOnce({ rows: [] }) // UPDATE sessions
      .mockResolvedValueOnce({ rowCount: 1, rows: [] }) // DELETE session_messages

    const ended = await svc.endSession(meta.id, { finalStatus: 'ended' })
    expect(ended?.status).toBe('ended')
    expect(ended?.endedAt).toMatch(/Z$/)
    expect(svc.getActiveConversation(meta.id)).toBeNull()

    expect(String(mockQuery.mock.calls.at(-2)?.[0] || '')).toContain('UPDATE sessions')
    expect(String(mockQuery.mock.calls.at(-1)?.[0] || '')).toContain('DELETE FROM session_messages')
  })

  it('endSession: drops short conversations without saving to GCS', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [] }) // createSession ensureSessionPersisted exists
      .mockResolvedValueOnce({ rows: [] }) // createSession insert session

    const svc = await import('../../src/services/session.service')
    const { saveConversation } = await import('../../src/services/gcs.service')
    const meta = await svc.createSession('guest_1', 'uk')
    const conv = svc.getActiveConversation(meta.id)!
    conv.messages.push({ id: 'u1', role: 'user', content: 'hi', timestamp: '2026-01-01T00:00:01.000Z' } as any)
    conv.messages.push({ id: 'a1', role: 'assistant', content: 'hello', timestamp: '2026-01-01T00:00:02.000Z' } as any)
    conv.messages.push({ id: 'u2', role: 'user', content: 'thanks', timestamp: '2026-01-01T00:00:03.000Z' } as any)
    conv.metadata.messageCount = conv.messages.length

    mockQuery.mockResolvedValueOnce({ rows: [] }) // DELETE FROM sessions

    const ended = await svc.endSession(meta.id, { finalStatus: 'ended' })
    expect(ended?.status).toBe('ended')
    expect(saveConversation).not.toHaveBeenCalled()
    expect(String(mockQuery.mock.calls.at(-1)?.[0] || '')).toContain('DELETE FROM sessions')
  })

  it('cleanupEndedSessionMessages: returns 0 on 42P01 and returns rowCount otherwise', async () => {
    const svc = await import('../../src/services/session.service')

    mockQuery.mockRejectedValueOnce(Object.assign(new Error('no table'), { code: '42P01' }))
    await expect(svc.cleanupEndedSessionMessages()).resolves.toBe(0)

    mockQuery.mockResolvedValueOnce({ rowCount: 5, rows: [] })
    await expect(svc.cleanupEndedSessionMessages()).resolves.toBe(5)
  })
})



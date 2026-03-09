/// <reference types="vitest/globals" />
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';

vi.mock('../../src/utils/resilience-logger', () => ({
  logResilience: vi.fn(),
}));

const mockPoolQuery = vi.fn();
const mockPoolConnect = vi.fn();

vi.mock('pg', () => {
  const EventEmitter = require('events');
  class MockPool extends EventEmitter {
    query = mockPoolQuery;
    connect = mockPoolConnect;
    end = vi.fn();
  }
  return { Pool: MockPool };
});

describe('DB retry wrapper', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    process.env.DATABASE_URL = 'postgres://test:test@localhost/test';
    process.env.DB_RETRY_MAX_ATTEMPTS = '3';
    process.env.DB_RETRY_INITIAL_DELAY_MS = '10';
    process.env.DB_RETRY_MAX_DELAY_MS = '50';
  });

  afterEach(() => {
    delete process.env.DATABASE_URL;
    delete process.env.DB_RETRY_MAX_ATTEMPTS;
    delete process.env.DB_RETRY_INITIAL_DELAY_MS;
    delete process.env.DB_RETRY_MAX_DELAY_MS;
  });

  it('succeeds on first try without retrying', async () => {
    mockPoolQuery.mockResolvedValueOnce({ rows: [{ id: 1 }], rowCount: 1 });
    const { query } = await import('../../src/db/index');
    const result = await query('SELECT 1');
    expect(result.rows).toEqual([{ id: 1 }]);
    expect(mockPoolQuery).toHaveBeenCalledTimes(1);
  });

  it('retries on ECONNREFUSED and succeeds on second attempt', async () => {
    const connError = Object.assign(new Error('ECONNREFUSED'), { code: 'ECONNREFUSED' });
    mockPoolQuery
      .mockRejectedValueOnce(connError)
      .mockResolvedValueOnce({ rows: [{ ok: true }], rowCount: 1 });

    const { query } = await import('../../src/db/index');
    const result = await query('SELECT 1');
    expect(result.rows).toEqual([{ ok: true }]);
    expect(mockPoolQuery).toHaveBeenCalledTimes(2);

    const { logResilience } = await import('../../src/utils/resilience-logger');
    expect(logResilience).toHaveBeenCalledWith('resilience.db_retry', expect.objectContaining({
      attempt: 1,
      errorCode: 'ECONNREFUSED',
      exhausted: false,
    }));
  });

  it('retries on ECONNRESET', async () => {
    const connError = Object.assign(new Error('ECONNRESET'), { code: 'ECONNRESET' });
    mockPoolQuery
      .mockRejectedValueOnce(connError)
      .mockResolvedValueOnce({ rows: [], rowCount: 0 });

    const { query } = await import('../../src/db/index');
    await query('SELECT 1');
    expect(mockPoolQuery).toHaveBeenCalledTimes(2);
  });

  it('retries on ETIMEDOUT', async () => {
    const connError = Object.assign(new Error('ETIMEDOUT'), { code: 'ETIMEDOUT' });
    mockPoolQuery
      .mockRejectedValueOnce(connError)
      .mockResolvedValueOnce({ rows: [], rowCount: 0 });

    const { query } = await import('../../src/db/index');
    await query('SELECT 1');
    expect(mockPoolQuery).toHaveBeenCalledTimes(2);
  });

  it('throws DbUnavailableError after exhausting retries', async () => {
    const connError = Object.assign(new Error('ECONNREFUSED'), { code: 'ECONNREFUSED' });
    mockPoolQuery.mockRejectedValue(connError);

    const { query, DbUnavailableError } = await import('../../src/db/index');
    await expect(query('SELECT 1')).rejects.toThrow(DbUnavailableError);
    expect(mockPoolQuery).toHaveBeenCalledTimes(3);

    const { logResilience } = await import('../../src/utils/resilience-logger');
    expect(logResilience).toHaveBeenLastCalledWith('resilience.db_retry', expect.objectContaining({
      exhausted: true,
    }));
  });

  it('does not retry on non-transient errors (e.g. syntax)', async () => {
    const syntaxError = Object.assign(new Error('syntax error'), { code: '42601' });
    mockPoolQuery.mockRejectedValueOnce(syntaxError);

    const { query } = await import('../../src/db/index');
    await expect(query('BAD SQL')).rejects.toThrow('syntax error');
    expect(mockPoolQuery).toHaveBeenCalledTimes(1);
  });

  it('self-heals: subsequent queries succeed without retry after recovery', async () => {
    const connError = Object.assign(new Error('ECONNREFUSED'), { code: 'ECONNREFUSED' });
    mockPoolQuery
      .mockRejectedValueOnce(connError)
      .mockResolvedValueOnce({ rows: [{ ok: true }], rowCount: 1 })
      .mockResolvedValueOnce({ rows: [{ ok: true }], rowCount: 1 });

    const { query } = await import('../../src/db/index');
    await query('SELECT 1');
    mockPoolQuery.mockClear();

    await query('SELECT 2');
    expect(mockPoolQuery).toHaveBeenCalledTimes(1);
  });
});

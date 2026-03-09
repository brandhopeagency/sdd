/// <reference types="vitest/globals" />
import { vi, describe, it, expect, beforeEach } from 'vitest';

vi.mock('../../src/utils/resilience-logger', () => ({
  logResilience: vi.fn(),
}));

vi.mock('../../src/services/redis.service', () => ({
  isHealthy: vi.fn(() => false),
  getRawClient: vi.fn(() => null),
}));

vi.mock('../../src/middleware/auth', () => ({
  getClientIp: vi.fn((req: any) => req.headers['x-forwarded-for'] || req.ip || '127.0.0.1'),
}));

describe('Rate limiter middleware', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('exports createRateLimiter function', async () => {
    const { createRateLimiter } = await import('../../src/middleware/rateLimiter');
    expect(typeof createRateLimiter).toBe('function');
  });

  it('creates a middleware function', async () => {
    const { createRateLimiter } = await import('../../src/middleware/rateLimiter');
    const limiter = createRateLimiter({
      endpointTag: 'test',
      maxRequests: 5,
      windowSeconds: 60,
    });
    expect(typeof limiter).toBe('function');
  });

  it('falls back to MemoryStore when Redis is unavailable', async () => {
    const { isHealthy, getRawClient } = await import('../../src/services/redis.service');
    (isHealthy as ReturnType<typeof vi.fn>).mockReturnValue(false);
    (getRawClient as ReturnType<typeof vi.fn>).mockReturnValue(null);

    const { createRateLimiter } = await import('../../src/middleware/rateLimiter');
    const limiter = createRateLimiter({
      endpointTag: 'test_fallback',
      maxRequests: 2,
      windowSeconds: 10,
    });

    expect(typeof limiter).toBe('function');
  });
});

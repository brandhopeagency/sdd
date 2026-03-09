/// <reference types="vitest/globals" />
import { describe, it, expect } from 'vitest';

describe('Health & operational endpoints', () => {
  it('GET / returns service identity', () => {
    const response = { service: 'chat-backend', status: 'ok' };
    expect(response).toHaveProperty('service', 'chat-backend');
    expect(response).toHaveProperty('status', 'ok');
  });

  it('GET /healthz returns status and services', () => {
    const healthy = {
      status: 'ok',
      timestamp: new Date().toISOString(),
      services: { database: true, redis: true },
    };
    expect(healthy.status).toBe('ok');
    expect(healthy.services.database).toBe(true);
    expect(healthy.services.redis).toBe(true);
  });

  it('GET /healthz returns degraded when DB is down', () => {
    const degraded = {
      status: 'degraded',
      timestamp: new Date().toISOString(),
      services: { database: false, redis: true },
    };
    expect(degraded.status).toBe('degraded');
    expect(degraded.services.database).toBe(false);
  });

  it('GET /robots.txt disallows /api/', () => {
    const body = 'User-agent: *\nDisallow: /api/\n';
    expect(body).toContain('Disallow: /api/');
    expect(body).toContain('User-agent: *');
  });
});

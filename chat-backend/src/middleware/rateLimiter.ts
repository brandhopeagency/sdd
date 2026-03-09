import rateLimit from 'express-rate-limit';
import { RedisStore } from 'rate-limit-redis';
import { getClientIp } from './auth';
import { isHealthy, getRawClient } from '../services/redis.service';
import { logResilience } from '../utils/resilience-logger';
import type { Request, Response, RequestHandler } from 'express';

interface RateLimiterOptions {
  endpointTag: string;
  maxRequests: number;
  windowSeconds: number;
}

export function createRateLimiter({ endpointTag, maxRequests, windowSeconds }: RateLimiterOptions): RequestHandler {
  const windowMs = windowSeconds * 1000;
  let middleware: RequestHandler | null = null;

  function buildMiddleware(): RequestHandler {
    let store: InstanceType<typeof RedisStore> | undefined;
    const redisClient = getRawClient();
    if (redisClient && isHealthy()) {
      try {
        store = new RedisStore({
          sendCommand: ((...args: string[]) => (redisClient as any).call(...args)) as any,
          prefix: `rl:${endpointTag}:`,
        });
      } catch {
        console.warn(`[RateLimiter] Redis store init failed for ${endpointTag}, using MemoryStore`);
      }
    }

    return rateLimit({
      windowMs,
      max: maxRequests,
      standardHeaders: true,
      legacyHeaders: false,
      ...(store ? { store } : {}),
      keyGenerator: (req: Request) => {
        return getClientIp(req) || req.ip || '0.0.0.0';
      },
      handler: (_req: Request, res: Response) => {
        logResilience('resilience.rate_limit', {
          ip: getClientIp(_req) || _req.ip || 'unknown',
          endpoint: endpointTag,
          retryAfter: res.getHeader('Retry-After'),
        });

        res.status(429).json({
          success: false,
          error: {
            code: 'RATE_LIMITED',
            message: 'Too many attempts. Please wait before trying again.',
          },
        });
      },
    });
  }

  return (req, res, next) => {
    if (!middleware) {
      middleware = buildMiddleware();
    }
    return middleware(req, res, next);
  };
}

# Data Model: Production Resilience

**Branch**: `020-production-resilience` | **Date**: 2026-03-05  
**Spec**: [spec.md](./spec.md) | **Research**: [research.md](./research.md)

---

## Overview

This feature introduces no new database tables or schema migrations. All state is either ephemeral (in-memory circuit breaker counters) or stored in Redis (rate limit counters with TTL). The model documents:
- Redis key schema for rate limiting
- Structured error response format standardization
- Retry configuration shape
- Health response schema

---

## Redis Key Schema (Rate Limiting)

```text
Key format:  rl:{endpoint_hash}:{client_ip}
TTL:         Sliding window duration (configurable per endpoint)
Value:       Integer counter (INCR on each request)
```

### Endpoint Registrations

| Endpoint | Key Example | Max Requests | Window | TTL |
|---|---|---|---|---|
| `POST /api/auth/otp/verify` | `rl:otp_verify:178.133.200.226` | 5 | 60s | 60s |
| `POST /api/auth/otp/send` | `rl:otp_send:178.133.200.226` | 3 | 300s | 300s |

### Cross-Service Sharing

Both `chat-backend` and `workbench-backend` use the same Redis instance and key namespace. A request to `POST /api/auth/otp/verify` on the workbench increments the same counter as the same endpoint on the chat backend — the key is derived from the endpoint path and IP, not the service name.

### Redis Fallback

If `redisService.isHealthy()` returns `false` at middleware initialization, `express-rate-limit` falls back to `MemoryStore` (per-instance, non-shared). This provides degraded-but-present protection until Redis recovers. No data migration is needed when Redis reconnects — counters simply restart.

---

## Standardized Error Response Format

### Current State (Mixed)

```ts
// Auth routes — structured (keep as-is)
{ success: false, error: { code: "INVALID_OTP", message: "..." } }

// Chat ownership routes — plain string (to be standardized)
{ success: false, error: "Access denied: You can only..." }
```

### Target State (All Routes)

```ts
interface ApiErrorResponse {
  success: false;
  error: {
    code: string;
    message: string;
  };
}
```

### Error Code Registry (New Additions)

| Code | HTTP Status | Source | Description |
|---|---|---|---|
| `SESSION_NOT_FOUND` | 403 | chat.ts | Session ID not found in memory or DB |
| `SESSION_OWNERSHIP` | 403 | chat.ts | Session belongs to a different user |
| `MESSAGE_OWNERSHIP` | 403 | chat.ts | Message belongs to a different session/user |
| `RATE_LIMITED` | 429 | rateLimiter.ts | IP exceeded rate limit for this endpoint |
| `SERVICE_UNAVAILABLE` | 503 | db/index.ts | DB connection exhausted retries |

Existing codes remain unchanged: `GUEST_DISABLED`, `UNAUTHORIZED`, `FORBIDDEN`, `INVALID_TOKEN`, `TOKEN_EXPIRED`, `TOKEN_STORE_UNAVAILABLE`, `INVALID_OTP`, `OTP_EXPIRED`, etc.

---

## Retry Configuration Shape

```ts
interface DbRetryConfig {
  maxAttempts: number;        // DB_RETRY_MAX_ATTEMPTS (default: 3)
  initialDelayMs: number;     // DB_RETRY_INITIAL_DELAY_MS (default: 500)
  maxDelayMs: number;         // DB_RETRY_MAX_DELAY_MS (default: 5000)
  jitterFactor: number;       // Fixed ±0.25 (not configurable)
  transientCodes: string[];   // ['ECONNREFUSED', 'ECONNRESET', 'ETIMEDOUT']
}
```

Retry is applied at the `query()` and `transaction()` export level in `db/index.ts`. Pool configuration (`max`, `idleTimeoutMillis`, `connectionTimeoutMillis`) remains unchanged.

---

## Health Response Schema

### Existing (Enhanced)

```ts
interface HealthResponse {
  status: 'ok' | 'degraded';
  timestamp: string;
  services: {
    database: boolean;
    redis: boolean;
    email: boolean;
    dialogflow: boolean;
  };
}
```

No schema changes needed. The existing `/api/health` endpoint already returns this format with `SELECT 1` for DB health. New routes `/healthz` and `GET /` alias to this or return a minimal subset.

---

## Frontend Circuit Breaker State

```ts
// Module-scoped in api.ts (not persisted)
let consecutiveFailures = 0;
const CIRCUIT_BREAK_THRESHOLD = 3;

// Reset on any 2xx response
// Increment on 403 after failed refresh
// Trip: stop retrying, fire onUnauthenticated immediately
```

No persistence needed — the circuit resets on page reload, which is acceptable since the purpose is to prevent in-session 403 loops.

---

## Relationships

```text
Redis (Memorystore)
  ├── Rate limit counters (rl:* keys, TTL-managed)
  └── Token persistence (existing, unchanged)

pg Pool (Cloud SQL)
  └── Retry wrapper (transient error codes only)

Express middleware stack
  └── rateLimiter middleware → Redis store → rl:* keys
```

---

## Backward Compatibility

- No database migrations
- No schema changes to existing tables
- Redis key namespace (`rl:*`) does not conflict with existing token keys (`refresh_token:*`)
- Error response format change on chat ownership 403s: adds `{ code, message }` structure where plain strings existed; frontend `apiFetch` already handles both formats
- Health endpoint path additions (`/healthz`, `/`, `/robots.txt`) are new routes with no overlap

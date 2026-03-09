# Research: Shared Redis Token Persistence

**Feature Branch**: `014-redis-token-persistence`  
**Date**: 2026-02-22

## Current State Analysis

### Authentication Flow

The chat-backend uses JWT-based authentication with OTP email verification:

1. User requests OTP via `/api/auth/otp/send`
2. User verifies OTP via `/api/auth/otp/verify` → receives access token + refresh token
3. Access tokens (15m default) authorize API requests via `Authorization: Bearer` header
4. Refresh tokens (7d default) are sent as httpOnly cookies and used to obtain new access tokens via `/api/auth/refresh`

### Current Refresh Token Storage

Refresh tokens are currently stored in a **PostgreSQL** `refresh_tokens` table (Cloud SQL):

```sql
CREATE TABLE refresh_tokens (
    id UUID PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash VARCHAR(255) NOT NULL,  -- bcrypt hash of tokenId
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

**Lookup flow**: JWT contains a `tokenId` (UUID) → bcrypt hash of `tokenId` is compared against stored `token_hash` → if match, token is valid.

**Token rotation**: On each refresh, the old token row is deleted and a new one inserted.

**Cleanup**: Expired tokens are removed via `cleanup_expired_refresh_tokens()` PostgreSQL function.

### Why This Already Works (And Why Redis Is Still Valuable)

Cloud SQL is already shared across Cloud Run instances, so refresh tokens are technically already persisted across instances. However, moving to Redis provides:

1. **Performance**: Sub-millisecond reads vs ~2-5ms PostgreSQL round-trips for every token validation
2. **Native TTL**: Redis key expiration eliminates the need for periodic cleanup jobs
3. **Reduced database load**: Token operations (the most frequent auth operations) are offloaded from the primary database
4. **Simplified token model**: Key-value store is a natural fit for token-to-user mapping (no relational schema needed)
5. **Bcrypt elimination for lookups**: With Redis, the token identifier can be used directly as the key, avoiding a bcrypt comparison on every refresh — a significant CPU savings

## Research Decisions

### Decision 1: Redis Service — GCP Memorystore for Redis

**Decision**: Use GCP Memorystore for Redis (Basic tier, 1 GB)

**Rationale**:
- Managed service within the existing GCP ecosystem (project `mental-help-global-25`)
- Automatic failover, patching, and monitoring
- Sub-millisecond latency within the same region (`europe-west1`)
- IAM integration with existing service accounts
- Basic tier sufficient for token storage workload (low volume, small payloads)

**Alternatives considered**:

| Alternative | Rejected Because |
|-------------|-----------------|
| Upstash Redis (serverless) | External dependency outside GCP; adds third-party data processor for sensitive auth data |
| Redis on Compute Engine | Unmanaged; ops burden for patching, backups, monitoring |
| Redis on Cloud Run | Not persistent across container restarts; defeats the purpose |
| Keep PostgreSQL only | Misses performance and TTL benefits; does not address the user's request |

### Decision 2: Network Connectivity — Serverless VPC Access

**Decision**: Use Serverless VPC Access connector to connect Cloud Run to Memorystore

**Rationale**:
- Memorystore requires VPC connectivity (no public IP option)
- Serverless VPC Access is the standard pattern for Cloud Run → VPC resources
- Minimal latency overhead (~1ms)
- Supports the existing Cloud Run deployment model

**Setup requirements**:
1. Create a VPC connector in `europe-west1` (or use existing default VPC)
2. Configure Cloud Run service to use the VPC connector
3. Pass Redis host/port as environment variables or Secret Manager entries

### Decision 3: Redis Client Library — ioredis

**Decision**: Use `ioredis` npm package

**Rationale**:
- Most widely used Redis client for Node.js with TypeScript support
- Built-in connection pooling, auto-reconnection, and retry logic
- Supports Redis commands natively (SET with EX, GET, DEL)
- Graceful degradation: emits connection events that can be handled for FR-005/FR-006

**Alternatives considered**:

| Alternative | Rejected Because |
|-------------|-----------------|
| `redis` (node-redis) | Less mature TypeScript support; `ioredis` has richer feature set for connection management |
| `@upstash/redis` | HTTP-based; adds latency vs TCP; tied to Upstash platform |

### Decision 4: Token Storage Model — Direct Key-Value with SHA-256

**Decision**: Store tokens as `refresh:{sha256(tokenId)}` → JSON payload, with Redis TTL matching token expiration

**Rationale**:
- **Key**: `refresh:<sha256-hash-of-tokenId>` — SHA-256 is fast (vs bcrypt which is deliberately slow) and sufficient for key derivation since the tokenId is a cryptographically random UUID
- **Value**: JSON string containing `{ userId, issuedAt, expiresAt }`
- **TTL**: Set via Redis `EX` parameter to match `JWT_REFRESH_EXPIRES_IN`; no manual cleanup needed
- Eliminates bcrypt comparison on every refresh (major CPU improvement)
- Token rotation: atomic `DEL` old key + `SET` new key (can use Redis `MULTI/EXEC` for atomicity)
- Revocation: `DEL refresh:<hash>` immediately removes the token

**User-scoped index**: Additionally store `user:{userId}:tokens` as a Redis Set containing all active token hashes for that user. This supports:
- "Revoke all tokens for user" (logout everywhere, password change)
- Bounded token count per user (optional)

### Decision 5: Migration Strategy — Parallel Read, Redis Write

**Decision**: Deploy with Redis-only writes; accept one-time re-authentication for existing sessions

**Rationale**:
- The `refresh_tokens` PostgreSQL table uses bcrypt hashes, which cannot be reverse-mapped to token IDs for Redis migration
- A dual-read (check Redis, fall back to PostgreSQL) approach adds complexity for a short transition period
- Refresh tokens have a 7-day TTL, so all existing tokens naturally expire within one week
- Users experience at most one re-authentication during the migration window
- Clean cutover is simpler and eliminates a class of bugs from dual-storage logic

**Migration steps**:
1. Deploy Redis infrastructure (Memorystore + VPC connector)
2. Deploy backend with Redis token store (new tokens go to Redis only)
3. Remove PostgreSQL `refresh_tokens` table after 7-day grace period
4. Remove `cleanup_expired_refresh_tokens()` function

### Decision 6: Graceful Degradation — Fail Closed with Health Reporting

**Decision**: When Redis is unavailable, auth operations that require token persistence fail with clear errors; health endpoint reports degraded status

**Rationale**:
- Issuing tokens that cannot be persisted creates security risk (unrevocable tokens)
- Failing closed is the safe default for auth systems
- The `ioredis` client auto-reconnects; manual restart is not needed
- Health endpoint integration lets monitoring/alerting detect Redis issues early

**Timeout configuration**: 2-second connection timeout, 1-second command timeout

### Decision 7: Local Development — Docker Compose Redis

**Decision**: Add Redis to local development via Docker Compose in `chat-backend`

**Rationale**:
- Developers need a local Redis instance for testing
- Docker Compose is standard for local service dependencies
- Falls back gracefully if Redis is not running (for developers not working on auth features)

## Dependencies and Risks

### Dependencies

| Dependency | Owner | Risk |
|-----------|-------|------|
| GCP Memorystore quota and billing | Infra/Admin | Low — Basic tier is low cost |
| VPC connector creation permissions | Infra/Admin | Low — existing service account likely has IAM roles |
| `ioredis` npm package | Open source | Low — mature, widely used, MIT licensed |
| Cloud Run VPC connector support | GCP | None — GA feature |

### Risks

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Redis unavailability causes auth outage | Low | High | Fail-closed design + health monitoring + auto-reconnect |
| Migration causes temporary user logouts | Certain | Low | One-time event; 7-day natural expiration window |
| VPC connector adds deployment complexity | Low | Medium | Scripted in `chat-infra`; documented in quickstart |
| Local Redis setup friction for developers | Low | Low | Docker Compose; optional for non-auth work |

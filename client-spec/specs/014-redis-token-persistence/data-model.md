# Data Model: Shared Redis Token Persistence

**Feature Branch**: `014-redis-token-persistence`  
**Date**: 2026-02-22

## Overview

This feature replaces the PostgreSQL `refresh_tokens` table with Redis key-value storage. The data model shifts from a relational table to Redis keys with native TTL expiration.

## Entities

### Refresh Token (Redis)

Stored as a Redis key-value pair with automatic TTL expiration.

**Key pattern**: `refresh:<sha256-hash-of-tokenId>`

| Field | Type | Description |
|-------|------|-------------|
| `userId` | string (UUID) | The user this token belongs to |
| `issuedAt` | number (Unix timestamp) | When the token was issued |
| `expiresAt` | number (Unix timestamp) | When the token expires (mirrors Redis TTL) |

**Value format**: JSON string — `{"userId":"<uuid>","issuedAt":<unix>,"expiresAt":<unix>}`

**TTL**: Automatically set via Redis `EX` parameter to match `JWT_REFRESH_EXPIRES_IN` (default 7 days = 604800 seconds).

**Key derivation**: `tokenId` (UUID, embedded in refresh JWT payload) → SHA-256 hash → hex string → prefixed with `refresh:`.

### User Token Index (Redis)

Stored as a Redis Set to enable per-user token management (revoke all, count active).

**Key pattern**: `user:<userId>:tokens`

| Member | Type | Description |
|--------|------|-------------|
| `<sha256-hash-of-tokenId>` | string | Hash reference to a refresh token key |

**TTL**: None on the set itself; stale members are cleaned up lazily (on revoke-all or login) since the underlying `refresh:*` keys expire via their own TTL.

## Operations

### Issue Token

1. Generate `tokenId` (UUID v4)
2. Compute `hash = sha256(tokenId)`
3. `SET refresh:<hash> <json-payload> EX <ttl-seconds>`
4. `SADD user:<userId>:tokens <hash>`
5. Sign JWT containing `tokenId` in payload
6. Return JWT to client

### Validate Token (on refresh)

1. Extract `tokenId` from refresh JWT payload
2. Compute `hash = sha256(tokenId)`
3. `GET refresh:<hash>`
4. If null → token expired or revoked → reject
5. Parse JSON → verify `userId` matches JWT `sub` claim
6. Proceed with token rotation (issue new + revoke old)

### Revoke Token (logout)

1. Extract `tokenId` from refresh JWT
2. Compute `hash = sha256(tokenId)`
3. `DEL refresh:<hash>`
4. `SREM user:<userId>:tokens <hash>`

### Revoke All User Tokens (password change, admin action)

1. `SMEMBERS user:<userId>:tokens` → get all hashes
2. For each hash: `DEL refresh:<hash>`
3. `DEL user:<userId>:tokens`

### Token Rotation (atomic)

1. Compute `oldHash = sha256(oldTokenId)`
2. Generate `newTokenId`, compute `newHash = sha256(newTokenId)`
3. Execute in Redis `MULTI/EXEC` pipeline:
   - `DEL refresh:<oldHash>`
   - `SREM user:<userId>:tokens <oldHash>`
   - `SET refresh:<newHash> <json-payload> EX <ttl-seconds>`
   - `SADD user:<userId>:tokens <newHash>`

## Comparison: PostgreSQL vs Redis Model

| Aspect | PostgreSQL (current) | Redis (new) |
|--------|---------------------|-------------|
| Key/ID | UUID primary key | `refresh:<sha256(tokenId)>` |
| Token matching | bcrypt hash comparison | Direct key lookup (SHA-256) |
| Expiration | `expires_at` column + cleanup function | Native Redis TTL |
| User index | `idx_refresh_user` on `user_id` | `user:<userId>:tokens` Set |
| Revoke all | `DELETE FROM refresh_tokens WHERE user_id = $1` | `SMEMBERS` + `DEL` pipeline |
| Atomicity | SQL transaction | Redis `MULTI/EXEC` |
| Lookup cost | ~2-5ms (PostgreSQL) + bcrypt (~100ms CPU) | ~1ms (Redis GET) |

## Entity Removed (Post-Migration)

### refresh_tokens (PostgreSQL) — TO BE DROPPED

```sql
-- Remove after 7-day migration grace period
DROP TABLE IF EXISTS refresh_tokens;
DROP FUNCTION IF EXISTS cleanup_expired_refresh_tokens();
DROP INDEX IF EXISTS idx_refresh_user;
DROP INDEX IF EXISTS idx_refresh_expires;
```

This table is replaced entirely by the Redis model above. The `users` table and all other PostgreSQL tables remain unchanged.

# API Contract Changes: Production Resilience

**Branch**: `020-production-resilience` | **Date**: 2026-03-05

---

## Overview

This enhancement modifies existing response formats and adds operational routes. No new authenticated endpoints are introduced.

---

## New Endpoints

### 1. `GET /healthz` — Health Check Alias

Unauthenticated alias for the existing `GET /api/health` endpoint.

**Response (200 — healthy)**:
```json
{
  "status": "ok",
  "timestamp": "2026-03-05T11:50:00.000Z",
  "services": {
    "database": true,
    "redis": true,
    "email": true,
    "dialogflow": true
  }
}
```

**Response (503 — degraded)**:
```json
{
  "status": "degraded",
  "timestamp": "2026-03-05T11:50:00.000Z",
  "services": {
    "database": false,
    "redis": true,
    "email": true,
    "dialogflow": true
  }
}
```

**DB validation**: `SELECT 1` query (existing `checkDbHealth()` implementation).

**Authorization**: None — route is defined before auth middleware.

---

### 2. `GET /` — Root Status

Unauthenticated minimal status response.

**Response (200)**:
```json
{
  "service": "chat-backend",
  "status": "ok"
}
```

**Headers**: `Cache-Control: no-cache`

**Authorization**: None.

---

### 3. `GET /robots.txt` — Crawler Directive

Static text response for search engine crawlers.

**Response (200)**:
```text
User-agent: *
Disallow: /api/
```

**Headers**: `Content-Type: text/plain`, `Cache-Control: public, max-age=86400`

**Authorization**: None.

---

## Modified Response Formats

### 4. Chat Route 403 Responses — Error Code Enrichment

**Before** (ownership checks in `chat.ts`):
```json
{
  "success": false,
  "error": "Access denied: You can only access your own sessions"
}
```

**After** (standardized `{ code, message }` format):
```json
{
  "success": false,
  "error": {
    "code": "SESSION_OWNERSHIP",
    "message": "Access denied: You can only access your own sessions"
  }
}
```

**New error codes**:

| Code | Applied to | Scenario |
|---|---|---|
| `SESSION_NOT_FOUND` | `POST /api/chat/message`, `POST /api/chat/sessions/:id/end` | Session not in memory or DB |
| `SESSION_OWNERSHIP` | `POST /api/chat/message`, `POST /api/chat/sessions/:id/end`, memory endpoints | Session belongs to different user |
| `MESSAGE_OWNERSHIP` | `POST /api/chat/message` (feedback) | Message belongs to different session |

**Backward compatibility**: Frontend `apiFetch` already handles both string and `{ code, message }` error formats. Existing auth-related error codes (`UNAUTHORIZED`, `FORBIDDEN`, `INVALID_TOKEN`, etc.) remain unchanged.

---

### 5. Database Unavailable — 503 Response

**Before** (when DB is down):
- Pool throws `ECONNREFUSED` → Express default 500
- Or request hangs for 60s → Cloud Run returns 504

**After** (retries exhausted):
```json
{
  "success": false,
  "error": {
    "code": "SERVICE_UNAVAILABLE",
    "message": "Service temporarily unavailable. Please try again shortly."
  }
}
```

**HTTP Status**: 503 Service Unavailable  
**Headers**: `Retry-After: 10` (seconds)

---

### 6. Rate Limited — 429 Response

**New response on rate-limited OTP endpoints**:
```json
{
  "success": false,
  "error": {
    "code": "RATE_LIMITED",
    "message": "Too many attempts. Please wait before trying again."
  }
}
```

**HTTP Status**: 429 Too Many Requests  
**Headers**: `Retry-After: {seconds_until_window_reset}`

**Applied to**:
- `POST /api/auth/otp/verify` — 5 requests per 60s per IP
- `POST /api/auth/otp/send` — 3 requests per 300s per IP

---

## Unchanged Endpoints

All other endpoints remain unchanged in structure:
- Auth endpoints (login, refresh, logout, me) — response formats preserved
- Chat session endpoints (create, message, end) — request formats preserved
- Survey endpoints — no changes
- Workbench endpoints — no changes (workbench-backend gets rate limiting middleware only)

## Structured Log Entries (Non-API, for Cloud Logging)

Backend emits JSON to stdout for resilience events. Not API responses — these are operational log lines.

```json
{"event":"resilience.db_retry","attempt":1,"maxAttempts":3,"errorCode":"ECONNREFUSED","delayMs":500,"timestamp":"..."}
{"event":"resilience.db_retry","attempt":3,"maxAttempts":3,"errorCode":"ECONNREFUSED","exhausted":true,"timestamp":"..."}
{"event":"resilience.rate_limit","ip":"178.133.200.226","endpoint":"/api/auth/otp/verify","count":6,"windowRemaining":45,"timestamp":"..."}
```

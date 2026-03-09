# Quickstart: Shared Redis Token Persistence

**Feature Branch**: `014-redis-token-persistence`  
**Date**: 2026-02-22

## Prerequisites

- Node.js 18+ and npm
- Docker (for local Redis)
- GCP CLI (`gcloud`) configured for project `mental-help-global-25`
- Access to `chat-backend` and `chat-infra` repositories

## Local Development Setup

### 1. Start Local Redis

From `chat-backend/` root:

```bash
docker-compose up -d redis
```

This starts a Redis 7 instance on `localhost:6379`.

### 2. Configure Environment

Add to your `.env` file in `chat-backend/`:

```env
REDIS_HOST=localhost
REDIS_PORT=6379
# REDIS_PASSWORD=          # Not needed for local dev
# REDIS_TLS=false          # Default: false for local
REDIS_CONNECT_TIMEOUT=2000  # ms, default
REDIS_COMMAND_TIMEOUT=1000  # ms, default
```

### 3. Install Dependencies

```bash
cd chat-backend
npm install
```

### 4. Run the Backend

```bash
npm run dev
```

The backend will connect to local Redis on startup. Check console for:
```
Redis connected: localhost:6379
```

### 5. Verify

```bash
# Send OTP
curl -X POST http://localhost:3000/api/auth/otp/send \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com"}'

# Verify OTP (get code from console output in dev mode)
curl -X POST http://localhost:3000/api/auth/otp/verify \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","code":"123456"}'

# Check Redis for the stored token
docker exec -it chat-backend-redis-1 redis-cli KEYS "refresh:*"
```

## GCP Infrastructure Setup

### 1. Provision Memorystore + VPC Connector

From `chat-infra/`:

```bash
./scripts/setup-redis.sh
```

This script:
- Creates a Serverless VPC Access connector in `europe-west1`
- Provisions a Memorystore for Redis instance (Basic tier, 1 GB)
- Stores the Redis host in Secret Manager

### 2. Deploy Backend

After infrastructure is ready, deploy `chat-backend` to Cloud Run. The deploy workflow automatically:
- Configures the VPC connector on the Cloud Run service
- Injects `REDIS_HOST` and `REDIS_PORT` from Secret Manager

### 3. Verify in Dev

```bash
# Test auth flow against deployed dev environment
curl -X POST https://api.workbench.dev.mentalhelp.chat/api/auth/otp/send \
  -H "Content-Type: application/json" \
  -d '{"email":"approved-dev-user@example.com"}'
```

## Running Tests

```bash
cd chat-backend
npm test                          # All tests
npm test -- redis.service.test    # Redis service tests only
```

## Troubleshooting

| Symptom | Cause | Fix |
|---------|-------|-----|
| `ECONNREFUSED 127.0.0.1:6379` | Local Redis not running | `docker-compose up -d redis` |
| `Redis connection timeout` | Wrong host/port or network issue | Check `REDIS_HOST` and `REDIS_PORT` in `.env` |
| `NOAUTH Authentication required` | Redis requires password | Set `REDIS_PASSWORD` in `.env` |
| Tokens not persisting across restarts | Using in-memory fallback | Verify Redis is running and connected (check logs) |
| `ERR max number of clients reached` | Connection pool exhaustion | Restart Redis; check for connection leaks |

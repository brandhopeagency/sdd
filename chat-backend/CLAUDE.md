# CLAUDE.md - Chat Backend

## Project Overview

Express.js backend for the Mental Health Chat application. Handles authentication (OTP-based), chat sessions via Dialogflow CX, admin/workbench APIs, and conversation storage.

## Commands

```bash
npm install          # Install dependencies (requires GITHUB_TOKEN for @mentalhelpglobal scope)
npm run build        # TypeScript compilation
npm run dev          # Development server with hot reload
npm test             # Run tests
npm run test:coverage # Tests with coverage report
```

## Architecture

- **Runtime:** Node.js + Express + TypeScript
- **Database:** PostgreSQL (Cloud SQL in production)
- **AI:** Google Dialogflow CX for conversational AI
- **Auth:** OTP-based email authentication with JWT tokens
- **Types:** Shared types from `@mentalhelpglobal/chat-types`

### Key Directories

```
src/
  routes/          # Express route handlers
  services/        # Business logic (session, email, LLM)
  middleware/       # Auth, rate limiting
  types/           # Backend-specific types + re-exports from shared package
  db.ts            # Database connection and queries
  dialogflow.ts    # Dialogflow CX integration
  index.ts         # App entry point
```

### API Version Contract

The backend sets `X-API-Version` header on all responses (from `API_VERSION` env var, default `1.0.0`). This is checked by the `contract-check.yml` CI workflow for compatibility.

## Environment Variables

Required:
- `DATABASE_URL` - PostgreSQL connection string
- `JWT_SECRET` - Secret for JWT signing
- `DIALOGFLOW_PROJECT_ID`, `DIALOGFLOW_AGENT_ID` - Dialogflow CX config

Optional:
- `API_VERSION` - Semver version for API contract (default: `1.0.0`)
- `PORT` - Server port (default: `8080`)
- `FRONTEND_URL` - CORS allowed origin
- `GOOGLE_APPLICATION_CREDENTIALS` - Service account key path

## CI/CD

CI workflows are defined in `MentalHelpGlobal/chat-ci` and referenced via `.github/workflows/ci.yml`.

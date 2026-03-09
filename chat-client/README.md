# Mental Health Chat Client

A React/TypeScript prototype for a Dialogflow CX Mental Health First Responder application with a full administrative Workbench.

## Features

### Chat Interface
- 💬 Real-time chat with Dialogflow CX AI assistant
- 📝 Markdown support for rich text responses
- 👍👎 Message feedback system
- ⚙️ Per-message technical info (intent, confidence, response time)
- 🎨 Calm, therapeutic color palette (WCAG AA compliant)
- 🌐 Internationalization (Ukrainian, English, Russian)

### Workbench (Admin Panel)
- **User Management**: Search, filter, block/unblock users, change roles
- **Research & Moderation**: 3-column annotation view, tagging system
- **Privacy Controls**: PII masking, GDPR compliance (export/erasure)
- **Role-Based Access**: Dynamic UI based on user permissions

### User Roles (RBAC)
| Role | Chat | Tech Info | User Mgmt | Research | Privacy |
|------|------|-----------|-----------|----------|---------|
| User | ✓ | - | - | - | - |
| QA Specialist | ✓ | ✓ | - | - | - |
| Researcher | ✓ | - | - | ✓ | - |
| Moderator | ✓ | - | ✓ | - | - |
| Owner | ✓ | ✓ | ✓ | ✓ | ✓ |

## Quick Start

### Frontend Only (Mock Mode)

```bash
# Install dependencies
npm install

# Start development server
npm run dev
```

### With Dialogflow CX Integration

1. **Set up Backend Proxy**
   ```bash
   cd server
   npm install
   ```

2. **Configure Dialogflow CX**
   
   Create `server/.env` with your Dialogflow CX credentials:
   ```env
   PORT=3001
   FRONTEND_URL=http://localhost:5173
   
   # Google Cloud Service Account
   GOOGLE_APPLICATION_CREDENTIALS=./service-account.json
   
   # Dialogflow CX Agent
   DIALOGFLOW_PROJECT_ID=your-project-id
   DIALOGFLOW_LOCATION=global
   DIALOGFLOW_AGENT_ID=your-agent-id
   DIALOGFLOW_ENVIRONMENT=DRAFT
   ```

3. **Download Service Account Key**
   - Go to [Google Cloud Console](https://console.cloud.google.com)
   - Navigate to IAM & Admin > Service Accounts
   - Create or select a service account with Dialogflow API access
   - Download JSON key and save as `server/service-account.json`

4. **Configure Frontend**
   
   Create `.env` in project root:
   ```env
   VITE_API_URL=http://localhost:3001
   ```

5. **Start Both Servers**
   ```bash
   # Terminal 1: Start backend proxy
   cd server
   npm run dev
   
   # Terminal 2: Start frontend
   npm run dev
   ```

## Architecture

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│   React Client  │────▶│  Backend Proxy  │────▶│  Dialogflow CX  │
│   (Vite + TS)   │     │   (Express)     │     │      API        │
└─────────────────┘     └─────────────────┘     └─────────────────┘
       :5173                  :3001               Google Cloud
```

## Tech Stack

**Frontend:**
- React 18 + TypeScript
- Vite 5
- Tailwind CSS
- React Router v6
- Zustand
- Lucide React
- react-markdown + remark-gfm
- react-i18next

**Backend:**
- Express.js
- @google-cloud/dialogflow-cx
- TypeScript

## Project Structure

```
├── server/                # Backend proxy server
│   └── src/
│       ├── index.ts       # Express server entry
│       └── dialogflow.ts  # Dialogflow CX client
├── src/
│   ├── components/        # Shared UI components
│   ├── config/            # Configuration (Dialogflow, etc.)
│   ├── features/
│   │   ├── auth/          # Welcome, Login
│   │   ├── chat/          # Chat interface, messages, feedback
│   │   └── workbench/     # Admin modules
│   ├── locales/           # i18n translations (uk, en, ru)
│   ├── services/          # API services
│   ├── stores/            # Zustand state stores
│   ├── mocks/             # Mock data for demo
│   ├── types/             # TypeScript interfaces
│   └── utils/             # Helper functions
└── doc/                   # Documentation & specs
```

## API Endpoints

### Backend Proxy

**POST /api/chat/message**
```json
// Request
{
  "sessionId": "sess_123",
  "text": "Привіт",
  "languageCode": "uk"
}

// Response
{
  "messages": ["Вітаю! Як я можу вам допомогти?"],
  "intent": "welcome_intent",
  "confidence": 0.95,
  "parameters": {},
  "responseTime": 234
}
```

**GET /api/health** - Health check endpoint

## Development

```bash
# Frontend type check
npm run typecheck

# Frontend build
npm run build

# Backend type check
cd server && npm run typecheck

# Backend build
cd server && npm run build
```

## Specification

See [doc/README.md](doc/README.md) for the full Software Requirements Specification.

## UI E2E tests (Playwright)

See [doc/ui-e2e.md](doc/ui-e2e.md) for:

- Full list of implemented UI E2E cases
- How OTP login is handled in dev (OTP in browser console)
- Where to find console/network logs, `repro.md`, and screenshots
- GitHub Actions workflow for running UI tests against the dev environment
# Chat Application Backend

Backend server for the chat application with Dialogflow CX integration and email-based OTP authentication.

## Features

- **Email OTP Authentication** - Passwordless login with email verification codes
- **JWT Token Management** - Access tokens with refresh token rotation
- **User Management** - CRUD operations with role-based access control
- **GDPR Compliance** - Data export and erasure functionality
- **Cloud SQL Integration** - PostgreSQL database on GCP
- **Dialogflow CX** - Conversational AI integration

## Quick Start

### 1. Install Dependencies

```bash
cd server
npm install
```

### 2. Set Up Environment

```bash
# Copy sample environment file
cp env.sample .env

# Edit .env with your configuration
```

### 3. Set Up Database

For local development, run Cloud SQL Proxy:

```bash
# Download Cloud SQL Proxy
curl -o cloud-sql-proxy.exe https://storage.googleapis.com/cloud-sql-connectors/cloud-sql-proxy/v2.8.0/cloud-sql-proxy.x64.exe

# Start proxy
cloud-sql-proxy.exe PROJECT_ID:REGION:chat-db --port=5432
```

### 4. Initialize Database Schema

The schema is automatically applied when the server starts. You can also run:

```bash
# Connect to database and run schema manually
psql $DATABASE_URL -f src/db/schema.sql
```

### 5. Start Development Server

```bash
npm run dev
```

## API Endpoints

### Health Check

```
GET /api/health
```

### Authentication

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/auth/otp/send` | POST | Send OTP to email |
| `/api/auth/otp/verify` | POST | Verify OTP and get tokens |
| `/api/auth/refresh` | POST | Refresh access token |
| `/api/auth/logout` | POST | Invalidate refresh token |
| `/api/auth/me` | GET | Get current user |

### User Management (Requires WORKBENCH_USER_MANAGEMENT permission)

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/admin/users` | GET | List users (paginated) |
| `/api/admin/users/:id` | GET | Get user by ID |
| `/api/admin/users/:id` | PATCH | Update user |
| `/api/admin/users/:id/block` | POST | Block user |
| `/api/admin/users/:id/unblock` | POST | Unblock user |
| `/api/admin/users/:id/role` | POST | Change user role |
| `/api/admin/users/:id/export` | POST | Request data export |
| `/api/admin/users/:id/erase` | POST | Execute GDPR erasure |

### Chat

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/chat/message` | POST | Send message to Dialogflow |

## Environment Variables

See `env.sample` for all configuration options.

### Required for Authentication

```env
DATABASE_URL=postgresql://user:pass@localhost:5432/chat_app
JWT_SECRET=your-32-char-secret
JWT_REFRESH_SECRET=another-32-char-secret
EMAIL_PROVIDER=console  # or 'gmail' for production
```

### Gmail API Setup (for production email)

1. Enable Gmail API in GCP Console
2. Create OAuth 2.0 credentials
3. Get refresh token via OAuth Playground
4. Set environment variables:

```env
EMAIL_PROVIDER=gmail
GMAIL_CLIENT_ID=your-client-id
GMAIL_CLIENT_SECRET=your-client-secret
GMAIL_REFRESH_TOKEN=your-refresh-token
EMAIL_FROM=your-email@gmail.com
```

## Database Schema

The database includes these tables:

- `users` - User accounts with role and status
- `otp_codes` - Pending OTP verification codes
- `refresh_tokens` - JWT refresh token storage
- `audit_log` - Administrative action audit trail

## Cloud Run Deployment

The server is designed for Cloud Run with Cloud SQL:

1. Build and push Docker image
2. Deploy to Cloud Run with:
   - Cloud SQL connection
   - Environment variables from Secret Manager
   - Allow unauthenticated access (authentication is handled by JWT)

## Scripts

```bash
npm run dev       # Start development server with hot reload
npm run build     # Build for production
npm run start     # Start production server
npm run typecheck # Run TypeScript type checking
```

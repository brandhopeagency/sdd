# Data Model: Google OAuth Login with OTP Control

**Feature Branch**: `015-google-oauth-login`  
**Created**: 2026-02-23

## Entity Changes

### 1. Users Table — Add Google Identity Column

**Table**: `users` (existing)  
**Repository**: `chat-backend`  
**File**: `src/db/schema.sql`

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| `google_sub` | `VARCHAR(255)` | YES | `NULL` | Google's unique user identifier (`sub` claim from ID token). Set when user first authenticates via Google OAuth. |

**Constraints**:
- `UNIQUE` — no two users can be linked to the same Google account
- `NULL` allowed — existing users and OTP-only users won't have this set

**Index**:
- `CREATE UNIQUE INDEX idx_users_google_sub ON users(google_sub) WHERE google_sub IS NOT NULL;`

**Migration**: Add column via `ALTER TABLE users ADD COLUMN google_sub VARCHAR(255) UNIQUE;`

---

### 2. Settings Table — Add OTP Disable Column

**Table**: `settings` (existing, singleton id=1)  
**Repository**: `chat-backend`  
**File**: `src/db/schema.sql`

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| `otp_login_disabled_workbench` | `BOOLEAN` | NO | `FALSE` | When `TRUE`, OTP login is disabled for the workbench application. Chat is unaffected. |

**Migration**: `ALTER TABLE settings ADD COLUMN otp_login_disabled_workbench BOOLEAN NOT NULL DEFAULT FALSE;`

---

## Type Changes

### 3. chat-types — User Type Update

**Package**: `@mentalhelpglobal/chat-types`  
**File**: `src/entities.ts`

Add to `User` interface:

```typescript
googleSub?: string | null;
```

### 4. chat-types — Auth Types

**Package**: `@mentalhelpglobal/chat-types`  
**File**: `src/auth.ts` (new file)

```typescript
export interface GoogleAuthRequest {
  credential: string;       // Google ID token from GSI
  invitationCode?: string;  // Optional group invitation code
  surface: 'chat' | 'workbench';
}

export interface GoogleAuthResponse {
  accessToken: string;
  user: AuthenticatedUser;
}

export interface OtpSendRequest {
  email: string;
  surface?: 'chat' | 'workbench';  // Added for OTP disable enforcement
}

export interface PublicSettings {
  guestModeEnabled: boolean;
  approvalCooloffDays: number | null;
  otpLoginDisabledWorkbench: boolean;
  googleOAuthAvailable: boolean;     // Whether Google OAuth is configured
}
```

### 5. chat-types — Settings Type Update

**Package**: `@mentalhelpglobal/chat-types`  
**File**: `src/entities.ts` or `src/settings.ts`

```typescript
export interface AppSettings {
  guestModeEnabled: boolean;
  approvalCooloffDays: number;
  otpLoginDisabledWorkbench: boolean;
}
```

---

## State Transitions

### User Account Creation via Google OAuth

```
[No account] → Google OAuth → findOrCreateUser(email)
  ├── Email matches existing user → Link google_sub, return existing user
  └── No match → Create new user (status: 'approval', google_sub set)
```

### OTP Disable Setting State

```
otpLoginDisabledWorkbench: false (default)
  → Owner toggles ON
  → otpLoginDisabledWorkbench: true
  → Workbench login page: Google OAuth only
  → Chat login page: unchanged (both methods)
  → Backend: rejects OTP send for workbench surface
  
  → Owner toggles OFF
  → otpLoginDisabledWorkbench: false
  → Workbench login page: both methods restored
```

---

## Relationships

```
users (1) ←──── (0..1) google_sub
  │
  └── email (UNIQUE) ←── account linking key
  └── google_sub (UNIQUE) ←── Google identity link

settings (singleton, id=1)
  └── otp_login_disabled_workbench: BOOLEAN
```

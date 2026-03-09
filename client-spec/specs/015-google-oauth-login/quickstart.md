# Quickstart: Google OAuth Login with OTP Control

**Feature Branch**: `015-google-oauth-login`  
**Created**: 2026-02-23

## Prerequisites

- Access to GCP project `mental-help-global-25`
- Google Cloud Console access for creating OAuth 2.0 credentials
- Local development environments for all affected repos cloned and functional
- Node.js and npm installed

## 1. Create Google OAuth 2.0 Credentials

### Production / Dev Credentials

1. Go to [GCP Console > APIs & Credentials](https://console.cloud.google.com/apis/credentials?project=mental-help-global-25)
2. Click **Create Credentials** > **OAuth 2.0 Client ID**
3. Application type: **Web application**
4. Name: `MHG User Auth - [env]` (e.g., `MHG User Auth - Dev`)
5. Authorized JavaScript origins:
   - Dev: `https://dev.mentalhelp.chat`, `https://workbench.dev.mentalhelp.chat`
   - Prod: `https://mentalhelp.chat`, `https://workbench.mentalhelp.chat`
   - Local: `http://localhost:5173`, `http://localhost:5174`
6. Authorized redirect URIs: (none needed — using ID token flow, not redirect)
7. Copy the **Client ID** and **Client Secret**

### Store Credentials

```bash
# Add to Google Secret Manager (via chat-infra scripts)
gcloud secrets create google-oauth-client-secret \
  --project=mental-help-global-25

gcloud secrets versions add google-oauth-client-secret \
  --data-file=- --project=mental-help-global-25 <<< "YOUR_CLIENT_SECRET"

# Grant Cloud Run access
gcloud secrets add-iam-policy-binding google-oauth-client-secret \
  --member="serviceAccount:COMPUTE_SA@mental-help-global-25.iam.gserviceaccount.com" \
  --role="roles/secretmanager.secretAccessor" \
  --project=mental-help-global-25
```

## 2. Repository Setup Order

### Step 1: chat-types

```bash
cd D:\src\MHG\chat-types
git checkout develop && git pull
git checkout -b 015-google-oauth-login

# Make type changes (see data-model.md)
# Bump version to 1.5.0
npm version minor
npm run build
npm publish
```

### Step 2: chat-backend

```bash
cd D:\src\MHG\chat-backend
git checkout develop && git pull
git checkout -b 015-google-oauth-login

# Install dependencies
npm install google-auth-library
npm install @mentalhelpglobal/chat-types@1.5.0

# Set local environment variables
# Add to .env:
# GOOGLE_OAUTH_CLIENT_ID=your-dev-client-id
# GOOGLE_OAUTH_CLIENT_SECRET=your-dev-client-secret

# Run migration
npm run migrate

# Start development
npm run dev
```

### Step 3: chat-frontend-common

```bash
cd D:\src\MHG\chat-frontend-common
git checkout develop && git pull
git checkout -b 015-google-oauth-login

# Install Google OAuth React wrapper
npm install @react-oauth/google

# Make component changes (LoginPage, OtpLoginForm, authStore)
npm run build
```

### Step 4: chat-frontend

```bash
cd D:\src\MHG\chat-frontend
git checkout develop && git pull
git checkout -b 015-google-oauth-login

# Update common package
npm install @mentalhelpglobal/chat-frontend-common@latest

# Add to .env:
# VITE_GOOGLE_OAUTH_CLIENT_ID=your-dev-client-id

npm run dev
```

### Step 5: workbench-frontend

```bash
cd D:\src\MHG\workbench-frontend
git checkout develop && git pull
git checkout -b 015-google-oauth-login

# Update common package
npm install @mentalhelpglobal/chat-frontend-common@latest

# Add to .env:
# VITE_GOOGLE_OAUTH_CLIENT_ID=your-dev-client-id

npm run dev
```

## 3. Local Testing

### Test Google OAuth Login

1. Start the backend (`npm run dev` in chat-backend)
2. Start the frontend (`npm run dev` in chat-frontend or workbench-frontend)
3. Navigate to the login page
4. Click "Sign in with Google"
5. Complete the Google sign-in flow
6. Verify you are authenticated and redirected appropriately

### Test OTP Disable Setting

1. Log into the workbench as an Owner
2. Navigate to Settings
3. Toggle "Disable OTP Login for Workbench"
4. Open a new browser/incognito window
5. Navigate to the workbench login page
6. Verify only Google sign-in is shown
7. Navigate to the chat login page
8. Verify both options are still shown

## 4. Environment Variables Summary

### Backend (chat-backend)

| Variable | Description | Required |
|----------|-------------|----------|
| `GOOGLE_OAUTH_CLIENT_ID` | Google OAuth client ID for token verification | Yes (for Google auth) |
| `GOOGLE_OAUTH_CLIENT_SECRET` | Google OAuth client secret | No (not needed for ID token verification) |

### Frontend (chat-frontend, workbench-frontend)

| Variable | Description | Required |
|----------|-------------|----------|
| `VITE_GOOGLE_OAUTH_CLIENT_ID` | Google OAuth client ID for GSI library | Yes (for Google auth) |

### CI/CD (chat-ci deploy.yml)

| Variable/Secret | Type | Per-Environment |
|-----------------|------|-----------------|
| `GOOGLE_OAUTH_CLIENT_ID` | Variable | Yes (different per env) |

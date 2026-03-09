# Shared Types Package Contract

**Feature**: 001-monorepo-split
**Date**: 2026-02-04
**Package**: @mhg/chat-types

## Overview

This document specifies the TypeScript types to be extracted into the `@mhg/chat-types` npm package, published to GitHub Packages for consumption by `chat-backend` and `chat-frontend`.

---

## Package Structure

```
@mhg/chat-types/
├── src/
│   ├── index.ts           # Re-exports all modules
│   ├── rbac.ts            # Role-based access control types
│   ├── entities.ts        # Core domain entities
│   ├── conversation.ts    # Dialogflow conversation types
│   └── agentMemory.ts     # Agent memory types
├── dist/                  # Compiled output (generated)
│   ├── index.js
│   ├── index.d.ts
│   └── ...
├── package.json
├── tsconfig.json
└── README.md
```

---

## Module: rbac.ts

### UserRole Enum

```typescript
export enum UserRole {
  USER = 'user',
  QA_SPECIALIST = 'qa_specialist',
  RESEARCHER = 'researcher',
  MODERATOR = 'moderator',
  GROUP_ADMIN = 'group_admin',
  OWNER = 'owner'
}
```

### Permission Enum

```typescript
export enum Permission {
  // Chat permissions
  CHAT_ACCESS = 'chat_access',
  CHAT_SEND = 'chat_send',
  CHAT_FEEDBACK = 'chat_feedback',
  CHAT_DEBUG = 'chat_debug',

  // Workbench permissions
  WORKBENCH_ACCESS = 'workbench_access',
  WORKBENCH_USER_MANAGEMENT = 'workbench_user_management',
  WORKBENCH_RESEARCH = 'workbench_research',
  WORKBENCH_MODERATION = 'workbench_moderation',
  WORKBENCH_PRIVACY = 'workbench_privacy',

  // Group-scoped permissions
  WORKBENCH_GROUP_DASHBOARD = 'workbench_group_dashboard',
  WORKBENCH_GROUP_USERS = 'workbench_group_users',
  WORKBENCH_GROUP_RESEARCH = 'workbench_group_research',

  // Data permissions
  DATA_VIEW_PII = 'data_view_pii',
  DATA_EXPORT = 'data_export',
  DATA_DELETE = 'data_delete'
}
```

### ROLE_PERMISSIONS Mapping

```typescript
export const ROLE_PERMISSIONS: Record<UserRole, Permission[]> = {
  [UserRole.USER]: [
    Permission.CHAT_ACCESS,
    Permission.CHAT_SEND,
    Permission.CHAT_FEEDBACK
  ],
  [UserRole.QA_SPECIALIST]: [
    Permission.CHAT_ACCESS,
    Permission.CHAT_SEND,
    Permission.CHAT_FEEDBACK,
    Permission.CHAT_DEBUG
  ],
  [UserRole.RESEARCHER]: [
    Permission.CHAT_ACCESS,
    Permission.WORKBENCH_ACCESS,
    Permission.WORKBENCH_RESEARCH
  ],
  [UserRole.MODERATOR]: [
    Permission.CHAT_ACCESS,
    Permission.WORKBENCH_ACCESS,
    Permission.WORKBENCH_USER_MANAGEMENT,
    Permission.WORKBENCH_RESEARCH,
    Permission.WORKBENCH_MODERATION
  ],
  [UserRole.GROUP_ADMIN]: [
    Permission.CHAT_ACCESS,
    Permission.WORKBENCH_ACCESS,
    Permission.WORKBENCH_GROUP_DASHBOARD,
    Permission.WORKBENCH_GROUP_USERS,
    Permission.WORKBENCH_GROUP_RESEARCH
  ],
  [UserRole.OWNER]: [
    // All permissions
    ...Object.values(Permission)
  ]
};
```

### Helper Functions

```typescript
export function hasPermission(
  userPermissions: Permission[],
  required: Permission
): boolean;

export function hasAnyPermission(
  userPermissions: Permission[],
  required: Permission[]
): boolean;

export function hasAllPermissions(
  userPermissions: Permission[],
  required: Permission[]
): boolean;

export function getRolePermissions(role: UserRole): Permission[];
```

---

## Module: entities.ts

### User Interface

```typescript
export interface User {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  status: UserStatus;
  createdAt: string;
  updatedAt: string;
  lastLoginAt?: string;
  groupMemberships?: GroupMembershipSummary[];
}

export enum UserStatus {
  PENDING = 'pending',
  ACTIVE = 'active',
  BLOCKED = 'blocked'
}
```

### AuthenticatedUser Interface

```typescript
export interface AuthenticatedUser extends User {
  permissions: Permission[];
  activeGroupId?: string;
  sessionId: string;
  tokenExpiresAt: string;
}
```

### Session Interface

```typescript
export interface Session {
  id: string;
  userId: string;
  dialogflowSessionId: string;
  languageCode: string;
  createdAt: string;
  updatedAt: string;
  messageCount: number;
  lastMessageAt?: string;
  metadata?: SessionMetadata;
}

export interface SessionMetadata {
  userAgent?: string;
  ipAddress?: string;
  platform?: string;
}
```

### ChatMessage Interface

```typescript
export interface ChatMessage {
  id: string;
  sessionId: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: string;
  metadata?: MessageMetadata;
  diagnosticInfo?: DiagnosticInfo;
}

export interface MessageMetadata {
  responseTimeMs?: number;
  modelVersion?: string;
  intentName?: string;
  confidence?: number;
}
```

### Group Interfaces

```typescript
export interface Group {
  id: string;
  name: string;
  description?: string;
  createdAt: string;
  memberCount: number;
}

export interface GroupMembershipSummary {
  groupId: string;
  groupName: string;
  role: GroupMembershipRole;
  joinedAt: string;
}

export enum GroupMembershipRole {
  MEMBER = 'member',
  ADMIN = 'admin'
}

export enum GroupMembershipStatus {
  PENDING = 'pending',
  ACTIVE = 'active',
  REMOVED = 'removed'
}
```

### Supporting Entities

```typescript
export interface Annotation {
  id: string;
  messageId: string;
  userId: string;
  type: AnnotationType;
  content: string;
  createdAt: string;
}

export enum AnnotationType {
  NOTE = 'note',
  FLAG = 'flag',
  CORRECTION = 'correction'
}

export interface Tag {
  id: string;
  name: string;
  color: string;
  description?: string;
}

export interface AuditLogEntry {
  id: string;
  userId: string;
  action: string;
  resourceType: string;
  resourceId: string;
  details?: Record<string, unknown>;
  timestamp: string;
  ipAddress?: string;
}
```

---

## Module: conversation.ts

### StoredMessage Interface

```typescript
export interface StoredMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  responseTimeMs?: number;
  diagnosticInfo?: DiagnosticInfo;
  sentimentAnalysis?: SentimentAnalysis;
  flowInfo?: FlowInfo;
}
```

### DiagnosticInfo Interface

```typescript
export interface DiagnosticInfo {
  intent?: IntentInfo;
  match?: MatchInfo;
  generative?: GenerativeInfo;
  webhookStatus?: WebhookStatus;
}

export interface IntentInfo {
  displayName: string;
  confidence: number;
  parameters?: Record<string, unknown>;
}

export interface MatchInfo {
  matchType: string;
  confidence: number;
  parameters?: Record<string, unknown>;
}

export interface GenerativeInfo {
  modelVersion: string;
  promptTokens?: number;
  completionTokens?: number;
}

export interface WebhookStatus {
  triggered: boolean;
  webhookTag?: string;
  responseCode?: number;
}
```

### SentimentAnalysis Interface

```typescript
export interface SentimentAnalysis {
  score: number;      // -1.0 to 1.0
  magnitude: number;  // 0.0 to infinity
  label: 'negative' | 'neutral' | 'positive';
}
```

### FlowInfo Interface

```typescript
export interface FlowInfo {
  flowId: string;
  flowDisplayName: string;
  pageId: string;
  pageDisplayName: string;
  transitionRoute?: string;
}
```

### StoredConversation Interface

```typescript
export interface StoredConversation {
  sessionId: string;
  userId: string;
  messages: StoredMessage[];
  metadata: ConversationMetadata;
  createdAt: string;
  updatedAt: string;
}

export interface ConversationMetadata {
  languageCode: string;
  platform: string;
  totalMessages: number;
  averageResponseTime?: number;
  tags?: string[];
}
```

---

## Module: agentMemory.ts

```typescript
export interface AgentMemorySystemMessage {
  role: 'system';
  content: string;
  metadata: AgentMemoryMetadata;
}

export interface AgentMemoryMetadata {
  generatedAt: string;
  conversationId: string;
  messageCount: number;
  summaryVersion: string;
  keyTopics?: string[];
  userPreferences?: Record<string, unknown>;
}
```

---

## Package Configuration

### package.json

```json
{
  "name": "@mhg/chat-types",
  "version": "1.0.0",
  "description": "Shared TypeScript types for MHG chat applications",
  "main": "dist/index.js",
  "types": "dist/index.d.ts",
  "files": ["dist"],
  "scripts": {
    "build": "tsc",
    "prepublishOnly": "npm run build"
  },
  "publishConfig": {
    "registry": "https://npm.pkg.github.com"
  },
  "repository": {
    "type": "git",
    "url": "https://github.com/MentalHelpGlobal/chat-types.git"
  },
  "peerDependencies": {},
  "devDependencies": {
    "typescript": "^5.6.0"
  }
}
```

### tsconfig.json

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "commonjs",
    "lib": ["ES2020"],
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,
    "outDir": "./dist",
    "rootDir": "./src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist"]
}
```

---

## Consumer Configuration

### .npmrc (in chat-backend and chat-frontend)

```
@mhg:registry=https://npm.pkg.github.com
//npm.pkg.github.com/:_authToken=${GITHUB_TOKEN}
```

### package.json dependency

```json
{
  "dependencies": {
    "@mhg/chat-types": "^1.0.0"
  }
}
```

### Import Examples

```typescript
// Import specific types
import { UserRole, Permission, ROLE_PERMISSIONS } from '@mhg/chat-types';
import { User, AuthenticatedUser, Session } from '@mhg/chat-types';
import { StoredMessage, DiagnosticInfo } from '@mhg/chat-types';

// Import helper functions
import { hasPermission, getRolePermissions } from '@mhg/chat-types';
```

---

## Versioning Policy

### Semantic Versioning Rules

| Change Type | Version Bump | Example |
|-------------|--------------|---------|
| New type added | MINOR | Adding `NewEntity` interface |
| New optional field | MINOR | Adding `metadata?: object` to existing interface |
| Bug fix in helper | PATCH | Fixing `hasPermission` logic |
| Field renamed | MAJOR | Renaming `userId` to `user_id` |
| Field removed | MAJOR | Removing `deprecated` field |
| Type changed | MAJOR | Changing `id: number` to `id: string` |

### Deprecation Process

1. Mark with `@deprecated` JSDoc tag
2. Add to CHANGELOG with deprecation notice
3. Keep for 2 MINOR versions minimum
4. Remove in next MAJOR version

```typescript
/**
 * @deprecated Use `AuthenticatedUser` instead. Will be removed in v2.0.0.
 */
export interface LegacyUser {
  // ...
}
```

---

## CI/CD Workflow

### Publish Workflow (.github/workflows/publish.yml)

```yaml
name: Publish Package
on:
  push:
    tags:
      - 'v*'

jobs:
  publish:
    runs-on: ubuntu-latest
    permissions:
      contents: read
      packages: write
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          registry-url: 'https://npm.pkg.github.com'
      - run: npm ci
      - run: npm run build
      - run: npm publish
        env:
          NODE_AUTH_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

### Release Process

1. Update version in `package.json`
2. Update CHANGELOG.md
3. Commit: `chore: release v1.1.0`
4. Tag: `git tag v1.1.0`
5. Push: `git push origin v1.1.0`
6. Workflow automatically publishes to GitHub Packages

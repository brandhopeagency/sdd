# Data Models & API Contracts

[← Back to README](./README.md)

---

## Core TypeScript Interfaces

```typescript
/**
 * Base entity with common fields
 */
interface BaseEntity {
  id: string;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * User account
 */
export interface User extends BaseEntity {
  email: string;
  displayName: string;
  role: UserRole;
  status: 'active' | 'blocked' | 'pending' | 'anonymized';
  lastLoginAt: Date | null;
  sessionCount: number;
  metadata: Record<string, unknown>;
}

/**
 * Chat session
 */
export interface Session extends BaseEntity {
  userId: string | null; // null for anonymous sessions
  dialogflowSessionId: string;
  status: 'active' | 'ended' | 'expired';
  startedAt: Date;
  endedAt: Date | null;
  messageCount: number;
  moderationStatus: 'pending' | 'in_review' | 'moderated';
  tags: string[];
}

/**
 * Individual chat message
 */
export interface ChatMessage extends BaseEntity {
  sessionId: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  feedback: MessageFeedback | null;
  metadata: {
    intent?: string;
    confidence?: number;
    responseTimeMs?: number;
    parameters?: Record<string, unknown>;
  };
  tags: string[];
}

/**
 * User feedback on a message
 */
export interface MessageFeedback {
  rating: 'positive' | 'negative';
  comment: string | null;
  submittedAt: Date;
}

/**
 * Annotation for moderation
 */
export interface Annotation extends BaseEntity {
  sessionId: string;
  messageId: string | null; // null for session-level annotations
  authorId: string;
  qualityRating: 1 | 2 | 3 | 4 | 5;
  goldenReference: string | null;
  notes: string;
  tags: string[];
}

/**
 * Tag definition
 */
export interface Tag extends BaseEntity {
  name: string;
  category: 'session' | 'message';
  color: string;
  description: string;
  isCustom: boolean;
  usageCount: number;
}

/**
 * Audit log entry
 */
export interface AuditLogEntry extends BaseEntity {
  actorId: string;
  action: string;
  targetType: 'user' | 'session' | 'message';
  targetId: string;
  details: Record<string, unknown>;
  ipAddress: string;
}
```

---

## Dialogflow CX Integration

```typescript
/**
 * Request to Dialogflow CX
 */
interface DialogflowRequest {
  session: string; // Format: projects/{project}/locations/{location}/agents/{agent}/sessions/{session}
  queryInput: {
    text: {
      text: string;
    };
    languageCode: string;
  };
  queryParams?: {
    parameters?: Record<string, unknown>;
    currentPage?: string;
  };
}

/**
 * Response from Dialogflow CX
 */
interface DialogflowResponse {
  responseId: string;
  queryResult: {
    text: string;
    languageCode: string;
    responseMessages: Array<{
      text?: { text: string[] };
      payload?: Record<string, unknown>;
    }>;
    currentPage: {
      name: string;
      displayName: string;
    };
    intent: {
      name: string;
      displayName: string;
    };
    intentDetectionConfidence: number;
    diagnosticInfo: Record<string, unknown>;
    match: {
      matchType: string;
      confidence: number;
    };
    parameters?: Record<string, unknown>;
  };
}
```

---

## Workbench REST API Endpoints

### Authentication
```
POST   /api/auth/login          # Login with credentials
POST   /api/auth/logout         # Invalidate session
GET    /api/auth/me             # Get current user
POST   /api/auth/refresh        # Refresh access token
```

### User Management
```
GET    /api/admin/users                    # List users (paginated)
       Query: ?search=&role=&status=&page=&limit=&sort=

GET    /api/admin/users/:userId            # Get user details
PATCH  /api/admin/users/:userId            # Update user (role, status)
POST   /api/admin/users/:userId/block      # Block user
POST   /api/admin/users/:userId/unblock    # Unblock user
POST   /api/admin/users/:userId/reset-password  # Trigger password reset
```

### GDPR Operations
```
POST   /api/admin/users/:userId/export     # Request data export
       Response: { jobId: string, estimatedMinutes: number }

GET    /api/admin/exports/:jobId           # Check export status
       Response: { status: 'pending'|'ready'|'expired', downloadUrl?: string }

POST   /api/admin/users/:userId/erase      # Execute data erasure
       Body: { confirmationCode: string, reason: string }
```

### Sessions & Research
```
GET    /api/admin/sessions                 # List all sessions
       Query: ?userId=&status=&dateFrom=&dateTo=&page=&limit=

GET    /api/admin/sessions/:sessionId      # Get session with messages
GET    /api/admin/sessions/:sessionId/messages  # Get messages only

PATCH  /api/admin/sessions/:sessionId      # Update moderation status
       Body: { moderationStatus: string, tags: string[] }
```

### Annotations
```
GET    /api/admin/sessions/:sessionId/annotations
POST   /api/admin/sessions/:sessionId/annotations
PATCH  /api/admin/annotations/:annotationId
DELETE /api/admin/annotations/:annotationId
```

### Tags
```
GET    /api/admin/tags                     # List all tags
POST   /api/admin/tags                     # Create tag
PATCH  /api/admin/tags/:tagId              # Update tag
DELETE /api/admin/tags/:tagId              # Delete tag
```

### Feedback
```
POST   /api/feedback                       # Submit message feedback
       Body: { messageId: string, rating: string, comment?: string }
```

---

## API Response Formats

```typescript
/**
 * Standard success response
 */
interface ApiResponse<T> {
  success: true;
  data: T;
  meta?: {
    page?: number;
    limit?: number;
    total?: number;
    hasMore?: boolean;
  };
}

/**
 * Standard error response
 */
interface ApiError {
  success: false;
  error: {
    code: string;
    message: string;
    details?: Record<string, unknown>;
  };
}

/**
 * Paginated list response
 */
interface PaginatedResponse<T> extends ApiResponse<T[]> {
  meta: {
    page: number;
    limit: number;
    total: number;
    hasMore: boolean;
  };
}
```

---

[← Back to README](./README.md) | [Next: Non-Functional Requirements →](./08-nfr.md)


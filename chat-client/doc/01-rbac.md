# User Personas & RBAC Model

[← Back to README](./README.md)

---

## User Personas

### Help Seeker (User)
- **Description**: Primary end-user seeking mental health support
- **Access Level**: Standard chat interface only
- **Capabilities**: Send/receive messages, provide feedback, manage own session

### QA Specialist
- **Description**: Quality assurance personnel testing conversation flows
- **Access Level**: Chat interface
- **Capabilities**: All User capabilities (technical info available via gear icon on each message)

### Researcher
- **Description**: Data scientist or researcher analyzing conversation quality
- **Access Level**: Workbench (Research & Moderation section only)
- **Capabilities**: View chat history, annotate conversations, manage tags

### User Moderator
- **Description**: Support staff managing user accounts
- **Access Level**: Workbench (User Management section only)
- **Capabilities**: Search users, block accounts, assign roles

### Owner
- **Description**: System administrator with full access
- **Access Level**: Full system access
- **Capabilities**: All capabilities across all modules

---

## Permission Matrix

| Permission | User | QA | Researcher | Moderator | Owner |
|------------|:----:|:--:|:----------:|:---------:|:-----:|
| Chat Interface | ✓ | ✓ | ✓ | ✓ | ✓ |
| Send Messages | ✓ | ✓ | - | - | ✓ |
| Provide Feedback | ✓ | ✓ | - | - | ✓ |
| View Technical Info (⚙️) | ✓ | ✓ | - | - | ✓ |
| View Workbench Button | - | - | ✓ | ✓ | ✓ |
| User Management Section | - | - | - | ✓ | ✓ |
| Research Section | - | - | ✓ | - | ✓ |
| Privacy Controls | - | - | - | - | ✓ |
| PII Masking Toggle | - | - | ✓ | ✓ | ✓ |

---

## TypeScript Types

```typescript
/**
 * User roles within the system
 */
export enum UserRole {
  USER = 'user',
  QA_SPECIALIST = 'qa_specialist',
  RESEARCHER = 'researcher',
  MODERATOR = 'moderator',
  OWNER = 'owner'
}

/**
 * Granular permissions for RBAC
 */
export enum Permission {
  // Chat permissions
  CHAT_ACCESS = 'chat:access',
  CHAT_SEND = 'chat:send',
  CHAT_FEEDBACK = 'chat:feedback',

  // Workbench permissions
  WORKBENCH_ACCESS = 'workbench:access',
  WORKBENCH_USER_MANAGEMENT = 'workbench:user_management',
  WORKBENCH_RESEARCH = 'workbench:research',
  WORKBENCH_PRIVACY = 'workbench:privacy',

  // Data permissions
  DATA_VIEW_PII = 'data:view_pii',
  DATA_EXPORT = 'data:export',
  DATA_DELETE = 'data:delete'
}

/**
 * Role to permissions mapping
 */
export const ROLE_PERMISSIONS: Record<UserRole, Permission[]> = {
  [UserRole.USER]: [
    Permission.CHAT_ACCESS,
    Permission.CHAT_SEND,
    Permission.CHAT_FEEDBACK
  ],
  [UserRole.QA_SPECIALIST]: [
    Permission.CHAT_ACCESS,
    Permission.CHAT_SEND,
    Permission.CHAT_FEEDBACK
  ],
  [UserRole.RESEARCHER]: [
    Permission.CHAT_ACCESS,
    Permission.WORKBENCH_ACCESS,
    Permission.WORKBENCH_RESEARCH
  ],
  [UserRole.MODERATOR]: [
    Permission.CHAT_ACCESS,
    Permission.WORKBENCH_ACCESS,
    Permission.WORKBENCH_USER_MANAGEMENT
  ],
  [UserRole.OWNER]: Object.values(Permission) // Full access
};

/**
 * User session with role information
 */
export interface AuthenticatedUser {
  id: string;
  email: string;
  displayName: string;
  role: UserRole;
  permissions: Permission[];
  createdAt: Date;
  lastLoginAt: Date;
}
```

---

[← Back to README](./README.md) | [Next: Client Application Requirements →](./02-client-app.md)


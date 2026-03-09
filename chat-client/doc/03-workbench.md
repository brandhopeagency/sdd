# Workbench Module

[← Back to README](./README.md)

---

## REQ-ADMIN-500: Workbench Architecture

**Priority**: High  
**Description**: The Workbench shall be a dedicated full-screen view separate from the chat interface.

**Acceptance Criteria**:
- Full-screen layout (no chat interface visible)
- Persistent sidebar navigation
- Main content area for active section
- Header with user info and logout
- Responsive design for tablet+ screens

**Technical Notes**:
- Route: `/workbench/*`
- Layout: `<WorkbenchLayout sidebar={<Sidebar />} content={<Outlet />} />`
- Protected by `WORKBENCH_ACCESS` permission

---

## REQ-ADMIN-501: Role-Based Sidebar Navigation

**Priority**: High  
**Description**: The sidebar shall display only sections the user is authorized to access.

**Acceptance Criteria**:
- Sections dynamically rendered based on permissions
- Active section highlighted
- Collapsible on smaller screens
- Icons + labels for each section

**Navigation Items by Role**:

| Section | Researcher | Moderator | Owner |
|---------|:----------:|:---------:|:-----:|
| Dashboard | ✓ | ✓ | ✓ |
| User Management | - | ✓ | ✓ |
| Research & Moderation | ✓ | - | ✓ |
| Privacy Controls | - | - | ✓ |
| Settings | ✓ | ✓ | ✓ |

---

## REQ-USER-600: User List & Management

**Priority**: High  
**Description**: Moderators and Owners shall view and manage users via a list interface.

**Acceptance Criteria**:
- Searchable list of all users
- Columns: Name, Email, Role, Status, Last Active, Actions
- Search by name or email
- Filter by role, status
- Sort by any column
- Pagination (50 users per page)
- Actions: View Profile, Block/Unblock

**Technical Notes**:
- Route: `/workbench/users`
- Component: `<UserListView />`
- API: `GET /api/admin/users?search=&role=&status=&page=&limit=`

---

## REQ-USER-601: User Profile Card

**Priority**: High  
**Description**: Clicking a user in the list opens a detailed User Profile view.

**Acceptance Criteria**:
- Display user details: Name, Email, Role, Created, Last Login
- Show account status (Active, Blocked, Pending)
- Display session count and last session date
- Administrative actions:
  - Reset Password (sends reset email)
  - Block/Unblock Account
  - Change Role (Owner only)
- GDPR actions (see REQ-PRIV-801, REQ-PRIV-802)

**Technical Notes**:
- Route: `/workbench/users/:userId`
- Component: `<UserProfileCard userId={params.userId} />`
- API: `GET /api/admin/users/:userId`

---

## REQ-DATA-700: Global Chat History

**Priority**: High  
**Description**: Researchers shall access a global view of all chat sessions.

**Acceptance Criteria**:
- List all sessions across all users
- Columns: Session ID, User (masked if PII enabled), Date, Duration, Status
- Status indicators: Pending Review, Moderated, Flagged
- Filter by date range, status, user
- Sort by date, duration
- Click to open Moderation View

**Technical Notes**:
- Route: `/workbench/research`
- Component: `<ChatHistoryList />`
- API: `GET /api/admin/sessions?status=&dateFrom=&dateTo=`

---

## REQ-DATA-701: Three-Column Moderation View

**Priority**: High  
**Description**: The moderation interface shall display a 3-column layout for annotation work.

**Layout**:
```
┌─────────────────┬─────────────────┬─────────────────┐
│                 │                 │                 │
│   TRANSCRIPT    │    GOLDEN       │   ANNOTATION    │
│                 │   REFERENCE     │                 │
│   (Read-only    │                 │   (Editable     │
│    chat log)    │   (Ideal        │    notes and    │
│                 │    response)    │    ratings)     │
│                 │                 │                 │
└─────────────────┴─────────────────┴─────────────────┘
```

**Acceptance Criteria**:
- Column 1: Full conversation transcript (read-only)
- Column 2: Golden reference/ideal responses (editable by Researcher)
- Column 3: Annotation panel with quality ratings, notes, tags
- Synchronized scrolling between columns
- Save annotations without page reload
- Mark session as "Moderated" when complete

**Technical Notes**:
- Route: `/workbench/research/session/:sessionId`
- Component: `<ModerationView sessionId={params.sessionId} />`

---

## REQ-DATA-702: Tagging System

**Priority**: Medium  
**Description**: Support hierarchical tagging at both session and turn levels.

**Acceptance Criteria**:
- **Session-Level Tags**: Applied to entire conversation
  - Examples: "High Quality", "Needs Review", "Crisis Detected"
- **Turn-Level Tags**: Applied to individual messages
  - Examples: "Off-Topic", "Empathetic", "Factually Incorrect"
- Autocomplete from predefined tag library
- Custom tags allowed (flagged for review)
- Tag statistics visible in dashboard

**Technical Notes**:
```typescript
interface Tag {
  id: string;
  name: string;
  category: 'session' | 'turn';
  color: string;
  isCustom: boolean;
  createdBy: string;
}

interface TagAssignment {
  tagId: string;
  targetType: 'session' | 'message';
  targetId: string;
  assignedBy: string;
  assignedAt: Date;
}
```

---

[← Back to README](./README.md) | [Next: Data Privacy & GDPR →](./04-privacy.md)


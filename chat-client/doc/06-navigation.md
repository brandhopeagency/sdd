# Navigation & Routing Logic

[← Back to README](./README.md)

---

## Application Route Map

| Route | Component | Access | Description |
|-------|-----------|--------|-------------|
| `/` | `<WelcomeScreen />` | Public | Landing page |
| `/chat` | `<ChatInterface />` | Authenticated | Main chat |
| `/chat/:sessionId` | `<ChatInterface />` | Authenticated | Resume session |
| `/workbench` | `<WorkbenchLayout />` | WORKBENCH_ACCESS | Admin home |
| `/workbench/users` | `<UserListView />` | USER_MANAGEMENT | User list |
| `/workbench/users/:userId` | `<UserProfileCard />` | USER_MANAGEMENT | User detail |
| `/workbench/research` | `<ChatHistoryList />` | RESEARCH | Session list |
| `/workbench/research/session/:sessionId` | `<ModerationView />` | RESEARCH | Moderation |
| `/workbench/privacy` | `<PrivacyDashboard />` | PRIVACY | GDPR tools |
| `/workbench/settings` | `<SettingsView />` | WORKBENCH_ACCESS | Preferences |

---

## Navigation Flow Diagram

```
                              ┌─────────────┐
                              │   Welcome   │
                              │   Screen    │
                              └──────┬──────┘
                                     │
                    ┌────────────────┼────────────────┐
                    │                │                │
                    ▼                ▼                ▼
              [Sign In]     [Start Chat]        [Crisis Link]
                    │                │                │
                    │                ▼                ▼
                    │        ┌─────────────┐    External
                    │        │    Chat     │    Resource
                    │        │  Interface  │
                    │        └──────┬──────┘
                    │               │
                    ▼               │ (If has WORKBENCH_ACCESS)
              ┌─────────────┐       │
              │   Auth      │       ▼
              │   Flow      │◄──────┴───────────────────┐
              └──────┬──────┘                           │
                     │                                  │
                     ▼                                  │
              ┌─────────────┐                           │
              │  Workbench  │───────────────────────────┘
              │  Dashboard  │
              └──────┬──────┘
                     │
     ┌───────────────┼───────────────┬────────────────┐
     │               │               │                │
     ▼               ▼               ▼                ▼
┌─────────┐   ┌───────────┐   ┌───────────┐   ┌────────────┐
│  User   │   │ Research  │   │  Privacy  │   │  Settings  │
│  Mgmt   │   │           │   │           │   │            │
└────┬────┘   └─────┬─────┘   └───────────┘   └────────────┘
     │              │
     ▼              ▼
┌─────────┐   ┌───────────┐
│  User   │   │Moderation │
│ Profile │   │   View    │
└─────────┘   └───────────┘
```

---

## Role-Based Navigation Visibility

```typescript
interface NavItem {
  path: string;
  label: string;
  icon: string;
  requiredPermission: Permission;
  children?: NavItem[];
}

const WORKBENCH_NAV: NavItem[] = [
  {
    path: '/workbench',
    label: 'Dashboard',
    icon: 'chart',
    requiredPermission: Permission.WORKBENCH_ACCESS
  },
  {
    path: '/workbench/users',
    label: 'User Management',
    icon: 'users',
    requiredPermission: Permission.WORKBENCH_USER_MANAGEMENT,
    children: [
      { path: '/workbench/users', label: 'All Users', ... },
      { path: '/workbench/users?status=blocked', label: 'Blocked', ... }
    ]
  },
  {
    path: '/workbench/research',
    label: 'Research & Moderation',
    icon: 'microscope',
    requiredPermission: Permission.WORKBENCH_RESEARCH,
    children: [
      { path: '/workbench/research', label: 'Sessions', ... },
      { path: '/workbench/research/analytics', label: 'Analytics', ... }
    ]
  },
  {
    path: '/workbench/privacy',
    label: 'Privacy Controls',
    icon: 'shield',
    requiredPermission: Permission.WORKBENCH_PRIVACY
  },
  {
    path: '/workbench/settings',
    label: 'Settings',
    icon: 'cog',
    requiredPermission: Permission.WORKBENCH_ACCESS
  }
];

// Filter nav items based on user permissions
function getVisibleNav(userPermissions: Permission[]): NavItem[] {
  return WORKBENCH_NAV.filter(item => 
    userPermissions.includes(item.requiredPermission)
  );
}
```

---

## Deep Linking Structure

| Pattern | Example | Description |
|---------|---------|-------------|
| `/chat/:sessionId` | `/chat/sess_abc123` | Direct link to existing session |
| `/workbench/users/:userId` | `/workbench/users/usr_xyz789` | Direct link to user profile |
| `/workbench/research/session/:sessionId` | `/workbench/research/session/sess_abc123` | Direct link to moderation view |

**URL Parameters**:
- `?search=term` - Pre-fill search on list views
- `?status=pending` - Pre-filter by status
- `?highlight=msg_123` - Scroll to and highlight specific message

---

## State Transitions

```
┌─────────────────────────────────────────────────────────────────┐
│                     USER ACTIONS & TRANSITIONS                  │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Chat Interface:                                                │
│  ┌─────────────┐    Click ⚙️ icon    ┌─────────────────┐        │
│  │ Message     │ ─────────────────► │ Technical Info  │        │
│  │ (collapsed) │ ◄───────────────── │ (expanded)      │        │
│  └─────────────┘    Click ⚙️ icon    └─────────────────┘        │
│                                                                 │
│  ┌─────────────┐    Click 💬 icon    ┌─────────────────┐        │
│  │ Chat View   │ ─────────────────► │ Feedback Modal  │        │
│  └─────────────┘ ◄───────────────── └─────────────────┘        │
│                      Close/Submit                               │
│                                                                 │
│  Workbench:                                                     │
│  ┌─────────────┐    Click User Row   ┌─────────────────┐        │
│  │ User List   │ ─────────────────► │ User Profile    │        │
│  └─────────────┘ ◄───────────────── └─────────────────┘        │
│                      Back Button                                │
│                                                                 │
│  ┌─────────────┐   Click Session     ┌─────────────────┐        │
│  │ Session List│ ─────────────────► │ Moderation View │        │
│  └─────────────┘ ◄───────────────── └─────────────────┘        │
│                      Back Button                                │
│                                                                 │
│  ┌─────────────┐   Toggle Switch     ┌─────────────────┐        │
│  │ PII Visible │ ─────────────────► │ PII Masked      │        │
│  └─────────────┘ ◄───────────────── └─────────────────┘        │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

[← Back to README](./README.md) | [Next: Data Models & API →](./07-data-models.md)


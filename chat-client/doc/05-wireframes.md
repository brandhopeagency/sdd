# Wireframes & Screen Layouts

[← Back to README](./README.md)

---

## 7.1 Welcome Screen

```
┌────────────────────────────────────────────────────────────────┐
│                                                                │
│                                                                │
│                         [Logo]                                 │
│                                                                │
│              Mental Health Support Assistant                   │
│                                                                │
│      A safe space to talk. We're here to listen.              │
│                                                                │
│                                                                │
│                    [UA]  [EN]  [RU]                            │
│                                                                │
│              ┌─────────────────────────────┐                   │
│              │      Start a Conversation   │                   │
│              └─────────────────────────────┘                   │
│                                                                │
│                    Already have an account?                    │
│                         [Sign In]                              │
│                                                                │
│                                                                │
└────────────────────────────────────────────────────────────────┘
```

**Notes**:
- Minimal, focused layout with no footer or feature cards
- Language selector positioned above primary CTA
- Default language: Ukrainian (UK)

---

## 7.2 Main Chat Interface

```
┌────────────────────────────────────────────────────────────────┐
│  [Logo]  Mental Health Assistant       [⚙] [Workbench] [👤]    │
├────────────────────────────────────────────────────────────────┤
│                                                                │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │                                                          │  │
│  │   🤖 Assistant                              10:30 AM     │  │
│  │   ┌────────────────────────────────────────────────┐     │  │
│  │   │ Hello! I'm here to support you. How are you   │     │  │
│  │   │ feeling today?                                 │     │  │
│  │   └────────────────────────────────────────────────┘     │  │
│  │                                   [👍] [👎] [💬] [⚙️]     │  │
│  │                                                          │  │
│  │                                          👤 You          │  │
│  │     ┌────────────────────────────────────────────────┐   │  │
│  │     │ I've been feeling a bit overwhelmed lately... │   │  │
│  │     └────────────────────────────────────────────────┘   │  │
│  │                                                          │  │
│  │   🤖 Assistant                              10:31 AM     │  │
│  │   ┌────────────────────────────────────────────────┐     │  │
│  │   │ I hear you. Feeling overwhelmed is completely │     │  │
│  │   │ valid. Would you like to tell me more about   │     │  │
│  │   │ what's been causing these feelings?           │     │  │
│  │   └────────────────────────────────────────────────┘     │  │
│  │                                   [👍] [👎] [💬] [⚙️]     │  │
│  │                                                          │  │
│  └──────────────────────────────────────────────────────────┘  │
│                                                                │
│  ┌────────────────────────────────────────────────────┐ [Send] │
│  │ Type your message...                               │        │
│  └────────────────────────────────────────────────────┘        │
│                                                                │
│  [End Chat]                                    [New Session]   │
└────────────────────────────────────────────────────────────────┘
```

**Feedback Actions**:
- 👍 Thumbs up (helpful)
- 👎 Thumbs down (not helpful)
- 💬 Detailed feedback modal
- ⚙️ Toggle technical info panel (per-message)

---

## 7.3 Per-Message Technical Info Panel

When the gear icon (⚙️) is clicked on a message, an inline panel expands below the message bubble:

```
│  │   🤖 Assistant                              10:31 AM     │  │
│  │   ┌────────────────────────────────────────────────┐     │  │
│  │   │ I hear you. Feeling overwhelmed is completely │     │  │
│  │   │ valid...                                       │     │  │
│  │   └────────────────────────────────────────────────┘     │  │
│  │                                   [👍] [👎] [💬] [⚙️]     │  │
│  │   ┌────────────────────────────────────────────────┐     │  │
│  │   │  Intent: mental_health.support                │     │  │
│  │   │  Confidence: 94.2%                            │     │  │
│  │   │  Response Time: 342ms                         │     │  │
│  │   │  Parameters: { topic: "general_support" }     │     │  │
│  │   └────────────────────────────────────────────────┘     │  │
```

**Notes**:
- Panel is per-message, not global
- Styled with neutral background, inline with message
- Toggled by clicking the gear icon on each assistant message

---

## 7.4 Feedback Modal

```
┌──────────────────────────────────────────┐
│         Provide Feedback          [X]   │
├──────────────────────────────────────────┤
│                                          │
│  How helpful was this response?          │
│                                          │
│      😞    😐    🙂    😊    🤩           │
│                                          │
│  Additional comments (optional):         │
│  ┌────────────────────────────────────┐  │
│  │                                    │  │
│  │                                    │  │
│  └────────────────────────────────────┘  │
│                                          │
│       [Cancel]          [Submit]         │
└──────────────────────────────────────────┘
```

---

## 7.5 Workbench - Sidebar Layout

```
┌──────────────────────────────────────────────────────────────────────┐
│  [Logo]  Workbench                    🔒 PII Masked [ON]   [👤 Jane] │
├────────────────┬─────────────────────────────────────────────────────┤
│                │                                                     │
│  📊 Dashboard  │                                                     │
│                │                                                     │
│  👥 Users      │              MAIN CONTENT AREA                      │
│    └ All Users │                                                     │
│    └ Blocked   │         (Rendered based on selected                 │
│                │              sidebar item)                          │
│  🔬 Research   │                                                     │
│    └ Sessions  │                                                     │
│    └ Analytics │                                                     │
│                │                                                     │
│  🔐 Privacy    │                                                     │
│    └ Audit Log │                                                     │
│                │                                                     │
│  ⚙️ Settings   │                                                     │
│                │                                                     │
│                │                                                     │
│  ─────────────│                                                     │
│  [← Back to   │                                                     │
│     Chat]     │                                                     │
└────────────────┴─────────────────────────────────────────────────────┘
```

---

## 7.6 User Management - User List

```
┌──────────────────────────────────────────────────────────────────────┐
│  User Management                                                     │
├──────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  🔍 [Search by name or email...          ]  Role: [All ▼]  [Filter]  │
│                                                                      │
│  ┌────────────────────────────────────────────────────────────────┐  │
│  │ Name          │ Email           │ Role    │ Status │ Actions   │  │
│  ├───────────────┼─────────────────┼─────────┼────────┼───────────┤  │
│  │ Alex C...     │ a***@***.com    │ User    │ Active │ [View]    │  │
│  │ Sarah M...    │ s***@***.com    │ User    │ Blocked│ [View]    │  │
│  │ John D...     │ j***@***.com    │ QA      │ Active │ [View]    │  │
│  │ Emily R...    │ e***@***.com    │ Research│ Active │ [View]    │  │
│  │ ...           │ ...             │ ...     │ ...    │ ...       │  │
│  └────────────────────────────────────────────────────────────────┘  │
│                                                                      │
│  Showing 1-50 of 1,234 users                    [< Prev] [Next >]    │
└──────────────────────────────────────────────────────────────────────┘
```

---

## 7.7 User Profile Card

```
┌──────────────────────────────────────────────────────────────────────┐
│  ← Back to User List                                                 │
├──────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  ┌─────────┐                                                         │
│  │  👤     │   Alex Chen                                             │
│  │  Avatar │   alex.chen@example.com                                 │
│  └─────────┘   Role: User  •  Status: ● Active                       │
│                                                                      │
│  ─────────────────────────────────────────────────────────────────   │
│                                                                      │
│  Account Information                                                 │
│  ┌────────────────────────────────────────────────────────────────┐  │
│  │ Created:        March 15, 2024                                 │  │
│  │ Last Login:     May 27, 2024 at 2:34 PM                        │  │
│  │ Total Sessions: 42                                             │  │
│  │ Last Session:   May 27, 2024                                   │  │
│  └────────────────────────────────────────────────────────────────┘  │
│                                                                      │
│  Administrative Actions                                              │
│  ┌────────────────────────────────────────────────────────────────┐  │
│  │ [🔑 Reset Password]  [🚫 Block User]  [👤 Change Role ▼]       │  │
│  └────────────────────────────────────────────────────────────────┘  │
│                                                                      │
│  GDPR Data Rights                                                    │
│  ┌────────────────────────────────────────────────────────────────┐  │
│  │ [📥 Download Archive]           [🗑️ Execute Erasure]           │  │
│  │  Export all user data            Permanently anonymize         │  │
│  └────────────────────────────────────────────────────────────────┘  │
│                                                                      │
└──────────────────────────────────────────────────────────────────────┘
```

---

## 7.8 Research - Three-Column Moderation View

```
┌──────────────────────────────────────────────────────────────────────┐
│  Session: #abc123  •  User: Alex C...  •  Date: May 25, 2024         │
│  Status: [Pending Review ▼]    Tags: [High Quality] [+ Add Tag]      │
├──────────────────────┬──────────────────────┬────────────────────────┤
│     TRANSCRIPT       │   GOLDEN REFERENCE   │      ANNOTATION        │
├──────────────────────┼──────────────────────┼────────────────────────┤
│                      │                      │                        │
│ 🤖 Hello! How are    │ ┌──────────────────┐ │ Quality Rating:        │
│    you feeling?      │ │ Ideal: Warm,     │ │ ○ Poor                 │
│                      │ │ empathetic       │ │ ○ Fair                 │
│ 👤 I've been feeling │ │ greeting with    │ │ ● Good                 │
│    overwhelmed...    │ │ open-ended       │ │ ○ Excellent            │
│                      │ │ question.        │ │                        │
│ 🤖 I hear you. That  │ └──────────────────┘ │ Notes:                 │
│    sounds really     │                      │ ┌────────────────────┐ │
│    difficult...      │ [+ Add Reference]    │ │ Response was       │ │
│    [👍 Helpful]      │                      │ │ empathetic but     │ │
│                      │                      │ │ could explore      │ │
│ 👤 Yeah, work has    │ ┌──────────────────┐ │ │ coping strategies  │ │
│    been stressful... │ │ Note: Good       │ │ │ earlier...         │ │
│                      │ │ validation.      │ │ └────────────────────┘ │
│ 🤖 Work stress is    │ │ Consider adding  │ │                        │
│    common. Have you  │ │ breathing        │ │ Turn Tags:             │
│    tried any coping  │ │ exercise         │ │ [Empathetic]           │
│    strategies?       │ │ suggestion.      │ │ [Validation]           │
│    [👎 Not Helpful]  │ └──────────────────┘ │ [+ Add]                │
│                      │                      │                        │
│                      │                      │ ────────────────────   │
│                      │                      │ [Save] [Mark Complete] │
└──────────────────────┴──────────────────────┴────────────────────────┘
```

---

## 7.9 PII Mask Toggle (Header Component)

```
┌─────────────────────────────────────────┐
│  🔒 PII Protection                      │
│  ┌─────────────────────────────────┐    │
│  │  ● Masked    ○ Visible          │    │
│  └─────────────────────────────────┘    │
│  Names and emails are hidden for        │
│  safe screen sharing.                   │
└─────────────────────────────────────────┘
```

---

[← Back to README](./README.md) | [Next: Navigation & Routing →](./06-navigation.md)


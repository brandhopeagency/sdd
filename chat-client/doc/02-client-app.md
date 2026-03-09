# Client Application Requirements

[← Back to README](./README.md)

---

## REQ-AUTH-001: Welcome Screen

**Priority**: High  
**Description**: The application shall display a minimal, focused welcome screen upon initial load.

**Acceptance Criteria**:
- Display application logo and name
- Show brief description/tagline
- Language selector (Ukrainian, English, Russian) positioned above CTA
- Single prominent call-to-action button ("Start Conversation") - enters as guest
- Secondary link for existing users to sign in
- Clean layout without distracting elements (no feature cards, no footer)

**Technical Notes**:
- Route: `/` or `/welcome`
- Component: `<WelcomeScreen />`
- State: Check `authStore.isAuthenticated` before rendering
- i18n: Support for UK/EN/RU languages with `react-i18next`
- "Start Conversation" triggers `enterAsGuest()` for anonymous chat access

---

## REQ-AUTH-002: OTP Authentication

**Priority**: High  
**Description**: Users shall authenticate via one-time password (OTP) sent to their email.

**Acceptance Criteria**:
- Two-step login flow: email entry → OTP verification
- 6-digit OTP code sent to user's email
- OTP expires after 5 minutes
- Clear error messages for invalid/expired codes
- Auto-create new users on first successful OTP verification
- Existing users authenticated and redirected to chat

**Technical Notes**:
- Component: `<OtpLoginForm />` (reusable)
- State: `otpSent`, `pendingEmail`, `otpError` in authStore
- Actions: `sendOtp(email)`, `verifyOtp(email, code)`

```typescript
// OTP flow state
interface OtpState {
  otpSent: boolean;
  pendingEmail: string | null;
  otpError: 'invalid_otp' | 'otp_expired' | null;
}
```

---

## REQ-AUTH-003: Guest Access

**Priority**: High  
**Description**: Users shall be able to start chatting without registration (guest mode).

**Acceptance Criteria**:
- "Start Conversation" on welcome screen enters guest mode
- Guest users see "Guest" label with "Register" link in chat header
- Clicking "Register" opens OTP registration popup
- Upon registration, guest chat session is bound to new user account
- If registering with existing email, session binds to that user account
- Chat history preserved after registration

**Technical Notes**:
- State: `isGuest: boolean` in authStore
- Component: `<RegisterPopup />` - modal with `<OtpLoginForm compact />`
- Session binding: `chatStore.bindSessionToUser(userId)`
- Guest → Authenticated: `authStore.upgradeFromGuest(user)`

```typescript
// Guest user in chat header
{isGuest ? (
  <GuestBadge onClick={openRegisterPopup}>
    Guest | Register
  </GuestBadge>
) : (
  <UserMenu user={user} />
)}
```

---

## REQ-UI-100: Markdown Rendering Support

**Priority**: High  
**Description**: The chat interface shall render Markdown-formatted messages from the AI agent.

**Acceptance Criteria**:
- Support headings (h1-h6)
- Support bold, italic, and strikethrough text
- Support ordered and unordered lists
- Support inline code and code blocks
- Support hyperlinks (open in new tab)
- Sanitize HTML to prevent XSS attacks

**Technical Notes**:
- Library: `react-markdown` with `remark-gfm`
- Sanitization: `rehype-sanitize`
- Component: `<MarkdownRenderer content={message.text} />`

---

## REQ-UI-101: Workbench Navigation Button

**Priority**: Medium  
**Description**: A navigation button to access the Workbench shall be displayed only for authorized roles.

**Acceptance Criteria**:
- Button visible only for: Researcher, Moderator, Owner
- Button hidden for: User, QA Specialist
- Button positioned in header or navigation area
- Clicking navigates to `/workbench`

**Technical Notes**:
```typescript
const canAccessWorkbench = hasPermission(Permission.WORKBENCH_ACCESS);
return canAccessWorkbench ? <WorkbenchButton /> : null;
```

---

## REQ-UI-102: Feedback Controls

**Priority**: High  
**Description**: Users shall be able to provide feedback on individual AI responses.

**Acceptance Criteria**:
- Display thumbs up/down icons on each AI message
- Visual indication of selected feedback state
- Optional: Text input for detailed feedback
- Persist feedback to backend API
- Debounce rapid feedback changes

**Technical Notes**:
- Component: `<FeedbackControls messageId={id} />`
- API: `POST /api/feedback` with `{ messageId, rating, comment? }`
- State: Local optimistic update, sync with server

---

## REQ-SESS-200: Session Management

**Priority**: High  
**Description**: The application shall manage conversation sessions with proper lifecycle handling.

**Acceptance Criteria**:
- Generate unique session ID on conversation start
- Maintain session continuity across page refreshes (localStorage)
- Support explicit session termination ("End Chat" action)
- Handle session timeout gracefully (configurable, default 30 min)
- Allow starting a new session after ending previous

**Technical Notes**:
```typescript
interface Session {
  id: string;
  userId?: string;
  startedAt: Date;
  lastActivityAt: Date;
  status: 'active' | 'ended' | 'expired';
  dialogflowSessionPath: string;
}
```

---

## REQ-UI-103: Per-Message Technical Information

**Priority**: Low  
**Description**: Users can view technical details for each AI response via an inline toggle.

**Acceptance Criteria**:
- Gear icon (⚙️) displayed next to feedback buttons on each assistant message
- Clicking the icon toggles technical info panel for that specific message
- Information displayed:
  - Detected intent name
  - Confidence score (percentage)
  - Response time (milliseconds)
  - Session parameters (if any)
- Panel styled consistently with message bubble
- State managed per-message (not global)
- Available to all users viewing the chat

**Technical Notes**:
- Component: `<MessageBubble />` with internal `showDebug` state
- Icon: `<Settings />` from lucide-react
- UI: Collapsible panel below message content, inline with the bubble

---

## REQ-UX-400: Visual Design & Accessibility

**Priority**: High  
**Description**: The application shall use a calm, therapeutic color palette and meet WCAG 2.1 AA standards.

**Acceptance Criteria**:
- Primary palette: Soft blues, greens, neutral tones
- Avoid harsh contrasts or alarming colors (red alerts minimized)
- All interactive elements keyboard accessible
- Focus indicators visible
- Color contrast ratio minimum 4.5:1 for text
- Support reduced motion preferences
- Screen reader compatible (ARIA labels)

**Technical Notes**:
```css
:root {
  /* Primary - Calming Blue */
  --color-primary-50: #eff6ff;
  --color-primary-100: #dbeafe;
  --color-primary-500: #3b82f6;
  --color-primary-700: #1d4ed8;

  /* Secondary - Soft Green */
  --color-secondary-50: #f0fdf4;
  --color-secondary-500: #22c55e;

  /* Neutral */
  --color-neutral-50: #fafafa;
  --color-neutral-100: #f5f5f5;
  --color-neutral-700: #404040;
  --color-neutral-900: #171717;

  /* Semantic */
  --color-success: #16a34a;
  --color-warning: #ca8a04;
  --color-error: #dc2626;
}
```

---

[← Back to README](./README.md) | [Next: Workbench Module →](./03-workbench.md)


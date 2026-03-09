# Feature Specification: WCAG 2.1 AA Accessibility Compliance

**Feature Branch**: `006-accessibility-audit`
**Created**: 2026-02-08
**Status**: Draft
**Jira Epic**: MTB-199
**Input**: Verify and remediate WCAG 2.1 AA compliance across the entire application — chat interface, workbench, and all interactive flows.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Keyboard-Only Navigation (Priority: P1)

Users who cannot use a mouse MUST be able to access all interactive features using only the keyboard. This includes navigating pages, activating buttons, filling forms, submitting messages, toggling settings, and using all workbench features.

**Why this priority**: Keyboard accessibility is the foundation of all other accessibility. Without it, screen reader users and motor-impaired users are completely blocked.

**Independent Test**: Can be tested by disconnecting the mouse and navigating through every major flow (login, chat, workbench, moderation) using only Tab, Shift+Tab, Enter, Space, Escape, and arrow keys.

**Acceptance Scenarios**:

1. **Given** any page in the application, **When** the user presses Tab, **Then** focus moves through all interactive elements in a logical order.
2. **Given** a focused button or link, **When** the user presses Enter or Space, **Then** the action activates.
3. **Given** a modal dialog, **When** it opens, **Then** focus is trapped within the modal and Escape closes it.
4. **Given** the chat input, **When** focused, **Then** Enter sends the message and Shift+Enter inserts a newline.
5. **Given** the workbench sidebar, **When** navigating with arrow keys, **Then** items are traversable and activatable.
6. **Given** any dropdown or select, **When** navigating with arrow keys, **Then** options are selectable and the selection is announced.

---

### User Story 2 - Screen Reader Compatibility (Priority: P1)

Users who rely on screen readers (NVDA, JAWS, VoiceOver) MUST receive meaningful announcements for all content, state changes, and interactive elements. Dynamic content updates (new chat messages, notifications, loading states) MUST be announced without requiring manual focus management.

**Why this priority**: Screen reader access is required for WCAG AA compliance and serves blind and low-vision users.

**Independent Test**: Can be tested by enabling a screen reader and navigating through login, chat, and workbench flows, verifying that all elements are announced with their role, name, and state.

**Acceptance Scenarios**:

1. **Given** any interactive element, **When** focused, **Then** the screen reader announces the element's accessible name, role, and current state.
2. **Given** a new chat message arrives, **When** the user is in the chat interface, **Then** the message content is announced via a live region without moving focus.
3. **Given** a loading state, **When** content is being fetched, **Then** a "loading" announcement is made and "loaded" is announced when complete.
4. **Given** a form validation error, **When** the error appears, **Then** it is announced and programmatically associated with the relevant input field.
5. **Given** the workbench navigation, **When** the active section changes, **Then** the new section heading is announced.

---

### User Story 3 - Color Contrast & Visual Accessibility (Priority: P1)

All text content MUST meet WCAG AA minimum contrast ratios: 4.5:1 for normal text and 3:1 for large text (18px+ or 14px+ bold). Interactive elements MUST have visible focus indicators. Color MUST NOT be the sole means of conveying information (e.g., status indicators must include text or icons).

**Why this priority**: Visual accessibility affects the largest group of users with disabilities, including those with low vision and color blindness.

**Independent Test**: Can be tested by running automated contrast checkers (axe, Lighthouse) on every page and manually verifying focus indicators and color-independent information conveyance.

**Acceptance Scenarios**:

1. **Given** any text on any page, **When** measured against its background, **Then** the contrast ratio meets 4.5:1 for normal text and 3:1 for large text.
2. **Given** any interactive element, **When** it receives keyboard focus, **Then** a visible focus indicator is displayed (minimum 2px outline or equivalent).
3. **Given** status indicators (active/blocked, pending/approved), **When** displayed, **Then** status is conveyed by text or icon in addition to color.
4. **Given** the feedback controls (thumbs up/down), **When** a selection is made, **Then** the selected state is conveyed by shape/icon change, not color alone.
5. **Given** the reduced-motion preference (`prefers-reduced-motion`), **When** enabled in the OS, **Then** animations and transitions are minimized or disabled.

---

### User Story 4 - Form Accessibility (Priority: P2)

All forms (login, OTP verification, registration, user management, review rating, search, filters) MUST have properly labeled inputs, clear error messages, and logical grouping. Required fields MUST be indicated. Error messages MUST identify the specific field and describe the issue.

**Why this priority**: Forms are the primary interaction method. Inaccessible forms block users from completing core tasks.

**Independent Test**: Can be tested by navigating each form with a screen reader and verifying all inputs have labels, errors are associated, and required fields are indicated.

**Acceptance Scenarios**:

1. **Given** any form input, **When** focused by a screen reader, **Then** the label, required state, and any error message are announced.
2. **Given** a form submission with errors, **When** errors are displayed, **Then** each error is programmatically linked to its field via `aria-describedby` or equivalent.
3. **Given** the OTP input fields, **When** entering digits, **Then** focus auto-advances and the current position is announced.
4. **Given** search and filter inputs in the workbench, **When** results update, **Then** the result count is announced via a live region.

---

### User Story 5 - Semantic HTML & ARIA (Priority: P2)

All pages MUST use semantic HTML elements (nav, main, header, footer, section, article, h1-h6) to establish document structure. Custom components (modals, tabs, accordions, dropdowns) MUST implement appropriate ARIA roles, states, and properties.

**Why this priority**: Semantic structure enables assistive technology to provide page navigation and orientation.

**Independent Test**: Can be tested by inspecting the DOM for semantic elements and validating ARIA attributes with automated tools (axe-core) and manual screen reader testing.

**Acceptance Scenarios**:

1. **Given** any page, **When** inspected, **Then** it has exactly one `main` landmark, a `nav` for navigation, and a logical heading hierarchy (h1 → h2 → h3, no skipped levels).
2. **Given** the workbench sidebar, **When** rendered, **Then** it uses `nav` with `aria-label` to distinguish it from other navigation elements.
3. **Given** the three-column moderation view, **When** rendered, **Then** each column has an `aria-label` describing its purpose.
4. **Given** any modal/dialog, **When** opened, **Then** it has `role="dialog"`, `aria-modal="true"`, and `aria-labelledby` pointing to its title.

---

### Edge Cases

- What happens when a user zooms to 200%? The layout MUST remain functional and readable without horizontal scrolling (at 1280px viewport width).
- What happens when a user has high-contrast mode enabled? The application MUST remain usable with system high-contrast themes.
- What happens with very long translated strings (Ukrainian/Russian)? Layout MUST accommodate text expansion without truncation hiding critical information.
- What happens when JavaScript fails to load? The welcome screen MUST display a meaningful fallback message.

## Requirements *(mandatory)*

### Functional Requirements

**Keyboard**
- **FR-001**: All interactive elements MUST be reachable and operable via keyboard alone.
- **FR-002**: Focus order MUST follow a logical reading sequence on every page.
- **FR-003**: Focus MUST be trapped within modal dialogs and restored on close.
- **FR-004**: No keyboard traps MUST exist — users can always navigate away from any element.

**Screen Readers**
- **FR-005**: All interactive elements MUST have accessible names (via label, aria-label, or aria-labelledby).
- **FR-006**: Dynamic content updates MUST be announced via ARIA live regions.
- **FR-007**: Form errors MUST be programmatically associated with their inputs.
- **FR-008**: Page transitions MUST announce the new page or section title.

**Visual**
- **FR-009**: All text MUST meet WCAG AA contrast ratios (4.5:1 normal, 3:1 large).
- **FR-010**: All interactive elements MUST have visible focus indicators.
- **FR-011**: Information MUST NOT be conveyed by color alone.
- **FR-012**: The application MUST support 200% zoom without loss of functionality.
- **FR-013**: The application MUST respect `prefers-reduced-motion`.

**Structure**
- **FR-014**: All pages MUST use semantic HTML landmarks (main, nav, header).
- **FR-015**: Heading hierarchy MUST be logical and unbroken (no skipped levels).
- **FR-016**: Custom components MUST implement appropriate ARIA roles and states.
- **FR-017**: All images and icons MUST have appropriate alt text or be marked decorative.

**Testing**
- **FR-018**: Automated accessibility tests MUST be integrated into the CI pipeline.
- **FR-019**: All pages MUST pass axe-core automated checks with zero critical or serious violations.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Zero critical or serious accessibility violations reported by axe-core across all pages.
- **SC-002**: All core user flows (login, chat, workbench navigation, user management, moderation) are completable using keyboard only.
- **SC-003**: Screen reader testing with NVDA or VoiceOver confirms all interactive elements are announced correctly — zero unlabeled elements.
- **SC-004**: 100% of text meets WCAG AA contrast ratios as verified by automated tooling.
- **SC-005**: Lighthouse accessibility score is 90+ on all pages.
- **SC-006**: CI pipeline includes automated accessibility checks and blocks merges with critical violations.

## Assumptions

- The calming color palette (soft blues, greens, neutrals) specified in the design docs generally supports good contrast ratios but specific components may need adjustment.
- The existing component library (Tailwind CSS) provides utilities for focus rings, contrast, and responsive design that can be leveraged.
- Automated testing catches approximately 30-40% of accessibility issues — manual testing with screen readers and keyboard is required for the remainder.
- This spec covers both the monorepo and split repos per the Dual-Target Implementation Discipline.

## Scope Boundaries

**In scope**:
- Audit all existing pages and components for WCAG 2.1 AA compliance
- Remediate all critical and serious violations found
- Add automated accessibility tests to CI
- Test with at least one screen reader (NVDA or VoiceOver)
- Document accessibility patterns for future development

**Out of scope**:
- WCAG AAA compliance (enhanced contrast, sign language, etc.)
- Accessibility for native mobile applications
- Third-party widget accessibility (Dialogflow CX console)
- Accessibility documentation/training for contributors

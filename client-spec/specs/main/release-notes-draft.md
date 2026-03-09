# Release Notes Draft

**Add to Confluence [Release Notes](https://mentalhelpglobal.atlassian.net/wiki/spaces/UD/pages/8781825/Release+Notes):**

---

## Survey Module Enhancements (2026-03-05)

### Canonical Question Types
- Surveys now support **16 question types**: free text, integer (signed/unsigned), decimal, date, time, datetime, email, phone, URL, postal code, alphanumeric code, rating scale, single choice, multiple choice, and boolean.
- Each type has **type-specific validation constraints**: numeric min/max, date/time bounds, text length limits, and regex presets for email/phone/URL/postal code.
- Workbench schema editor shows a **grouped type selector** organized by category (Numeric, Date/Time, Rating, Text Presets, Text, Selection).

### Rating Scale Questions
- New **rating scale** question type with configurable start value, end value, and step.
- Users see either **interactive buttons** (≤20 segments) or a **slider** (>20 segments).
- Researchers configure rating parameters in a dedicated editor with live segment count feedback.

### Conditional Question Visibility
- Questions can now have **visibility conditions** that show/hide them based on answers to earlier questions.
- Supported operators: equals, not equals, is one of, contains.
- Workbench includes a **visibility preview panel** to test conditional logic before publishing.
- Chat frontend dynamically shows/hides questions and adjusts progress indicator accordingly.
- Hidden answers are automatically cleared and submitted as `visible: false` — excluded from agent memory.

### Per-Group Survey Ordering
- Researchers can **drag-and-drop reorder** surveys per group from a dedicated Group Surveys page.
- Ordering persists in a `group_survey_order` table and determines gate display priority.

### Bulk Result Download
- **JSON and CSV export** of survey responses, scoped to a specific group.
- Download button available on the Group Surveys page.

### Custom Public Headers
- Survey instances can have a **custom public header** displayed to users instead of the schema title.

### Optional Review Step
- Researchers can **disable the review step** per instance — users go straight from the last question to submission.

### Invitation Code Approval Control
- Each invitation code can be configured with **auto-admit** or **requires approval**.
- Auto-admit codes grant immediate group access without manual approval.
- Approval status is shown as color-coded badges in the workbench.

### Partial Save and Resume
- Survey answers are **saved after each question** (server-side and local draft).
- Users can close the browser and **resume from where they left off** — cursor position and answers are preserved.
- Local draft is cleared on successful submission.

### Response Visibility Markers
- Workbench response viewer shows **dimmed styling** for answers to questions that were hidden by conditions.
- A **"Hide non-visible answers"** toggle filters them from the display.

### Localization
- All new question types, validation messages, and UI labels are localized in **English, Ukrainian, and Russian**.

**Technical:** Changes span `chat-types` (v1.9.1), `chat-backend` (migrations 026–027), `chat-frontend`, and `workbench-frontend`. Jira Epic: MTB-446.

---

## Fix: Group chats now visible in group sessions interface (2026-02-24)

**What changed:** Chat sessions from users within a group are now correctly shown in the group chats (sessions) interface for group admins.

**Previously:** When users were added to groups via the workbench (manual add, create-and-add, or invite approval), their chat sessions did not appear in the group sessions list. Group admins saw an empty or incomplete list.

**Now:** All chat sessions from group members are visible in the group sessions interface. Existing sessions that were previously invisible have been repaired automatically.

**Impact:** Group admins can now view and moderate all chats from users in their group as intended.

**Technical:** Backend fix in `chat-backend`; no UI changes. Migration `023_backfill_group_session_visibility` backfills affected users and sessions.

---

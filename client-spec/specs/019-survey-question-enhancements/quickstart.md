# Quickstart: Survey Module Enhancements

**Branch**: `019-survey-question-enhancements` | **Date**: 2026-03-05

---

## Prerequisites

- Feature 018-workbench-survey fully merged and deployed
- Node.js 20+, npm 9+
- Access to `chat-types`, `chat-backend`, `chat-frontend`, `workbench-frontend` repositories
- PostgreSQL with survey tables from migrations 024 + 025

---

## Setup Steps

### 1. Create feature branches

```bash
cd D:/src/MHG/chat-types       && git checkout develop && git pull && git checkout -b 019-survey-question-enhancements
cd D:/src/MHG/chat-backend     && git checkout develop && git pull && git checkout -b 019-survey-question-enhancements
cd D:/src/MHG/chat-frontend    && git checkout develop && git pull && git checkout -b 019-survey-question-enhancements
cd D:/src/MHG/workbench-frontend && git checkout develop && git pull && git checkout -b 019-survey-question-enhancements
```

### 2. Extend shared types (`chat-types`)

In `chat-types/src/survey.ts`:
1. Define canonical typed `SurveyQuestion.type` values (numeric/date/time/preset/rating)
2. Add `ratingScaleConfig` and type-specific constraint types
3. Keep/add `VisibilityConditionOperator`, `VisibilityCondition`
4. Add or update preset validator constants
5. Extend `SurveyQuestion`/input types for type-specific constraints and visibility
6. Extend `SurveyAnswer` with `visible`
7. Extend `SurveyInstance` with `publicHeader`, `showReview` (remove `priority` dependency)
8. Keep shared `evaluateVisibility()` utility
9. Export all updated types/helpers

Build and publish: `npm run build && npm publish`

### 3. Database migration (`chat-backend`)

Create `026_survey_enhancements.sql`:
- `group_survey_order` table
- Seed from existing `priority` values
- `public_header` and `show_review` columns on `survey_instances`
- Remove `priority` column
- `requires_approval` column on `invitation_codes`

### 4. Backend changes (`chat-backend`)

- Schema service: validate `dataType`, `ratingScaleConfig`, `visibilityCondition`
- Response service: server-side data type + visibility validation
- Instance service: persist `publicHeader`, `showReview`; auto-insert `group_survey_order` on create
- New routes: group survey list, reorder, bulk download
- Gate-check: use `group_survey_order` instead of `priority`
- Invitation code service: handle `requiresApproval` on join
- Memory service: exclude hidden questions from summary

### 5. Chat frontend (`chat-frontend`)

- New/updated input components by canonical `question.type`
- Renderer dispatch by `question.type`
- Visibility evaluation in `SurveyForm` + `surveyGateStore`
- Dynamic progress (visible questions only)
- Answer clearing on condition change
- Optional review step based on `showReview`
- Display `publicHeader` when set
- Per-question save on navigation
- `visible` field in answer payloads

### 6. Workbench frontend (`workbench-frontend`)

- Question-type selector + type-specific constraint editors + rating config
- `VisibilityConditionEditor` + `VisibilityIndicator`
- `SchemaPreviewPanel`
- Instance creation form: `publicHeader`, `showReview` fields
- Group detail `Surveys` tab: visible only for `SURVEY_INSTANCE_MANAGE`
- Group Surveys page: list, drag-drop reorder, bulk download
- Response viewer: visibility markers + filter
- Invitation code form: `requiresApproval` toggle

---

## Verification

### Smoke test: Data types + Rating Scale
1. Create schema → add integer unsigned, date, email, rating scale (0–9 step 1) questions
2. Publish → create instance → complete as user
3. Verify: numeric keyboard, date picker, email validation, rating scale segments

### Smoke test: Conditional visibility
1. Create schema → Q1 single_choice (Yes/No) → Q2 free_text (visible when Q1 = "Yes")
2. Preview panel: select Q1="No" → Q2 hidden; Q1="Yes" → Q2 visible
3. Publish → complete as user → verify skip + visibility markers

### Smoke test: Group Surveys Page
1. Open group → Surveys tab → verify instance list with ordering
2. Drag to reorder → refresh → verify order persists
3. Download JSON + CSV → verify data scoped to group

### Smoke test: Custom header + Optional review
1. Create instance with `publicHeader` = "Wellness Check" and `showReview` = false
2. Complete as user → verify custom heading shown, no review step

### Smoke test: Invitation code approval
1. Generate code with `requiresApproval` = false
2. Enter code as new user → verify immediate group access

### Instrument validation: Intake schema (T061)
1. Create a schema with all canonical question types:
   - `free_text`, `integer_signed`, `integer_unsigned`, `decimal`
   - `date`, `time`, `datetime`
   - `email`, `phone`, `url`, `postal_code`, `alphanumeric_code`
   - `rating_scale` (0–10 step 1)
   - `single_choice` (Yes/No), `multi_choice` (A/B/C), `boolean`
2. Set validation constraints where applicable:
   - Integer signed: minValue=-100, maxValue=100
   - Decimal: minValue=0.0, maxValue=999.99
   - Date: min=2020-01-01, max=2030-12-31
   - Free text: minLength=2, maxLength=200
3. Publish schema successfully (no validation errors)
4. Create instance targeting a test group → verify gate returns schema snapshot with all types and constraints intact
5. Complete the survey as a user:
   - Enter valid values for each type → submission succeeds
   - Attempt invalid values (e.g., letters for integer, invalid email) → inline validation blocks submission
6. View responses in workbench → all answer values rendered correctly per type

### Instrument validation: Conditional branches/results (T062)
1. Create a schema with conditional branching:
   - Q1: single_choice ("A", "B", "C")
   - Q2: free_text, visible when Q1 = "A"
   - Q3: integer_signed, visible when Q1 = "B"
   - Q4: rating_scale (1–5 step 1), always visible
2. Publish → verify preview panel correctly shows/hides Q2/Q3 based on Q1 selection
3. Complete as user:
   - Select Q1="A" → Q2 visible, Q3 hidden → answer Q2 + Q4 → submit
   - Verify response contains: Q1="A", Q2=value, Q3={visible:false, value:null}, Q4=value
4. Complete as second user:
   - Select Q1="B" → Q2 hidden, Q3 visible → answer Q3 + Q4 → submit
   - Verify response: Q1="B", Q2={visible:false, value:null}, Q3=value, Q4=value
5. View responses in workbench:
   - Toggle "Hide non-visible answers" → hidden answers disappear
   - Untoggle → hidden answers shown with dimmed/italic styling
6. Verify agent memory excludes hidden answers (check GCS memory file or debug panel)

### Partial save and resume validation
1. Start a multi-question survey → answer Q1 and Q2 → navigate to Q3
2. Close browser / refresh page
3. Re-open → survey gate resumes at Q3 with Q1 and Q2 answers preserved
4. Complete remaining questions → submit → verify full response saved
5. Verify localStorage draft is cleared after successful submission

### Inline validation latency target (T069)
- Measure client-side validation response time for: numeric min/max, regex preset, date bounds
- Target: < 200ms from keystroke to error message appearance
- Evidence: Record via browser DevTools Performance panel or `performance.now()` instrumentation

### Accessibility checks (T070)
- Keyboard navigation: Tab through all question types, Enter to select rating/choice, Escape to dismiss
- Focus indicators: Visible focus ring on all interactive elements
- ARIA: `aria-label` on rating scale buttons, `role="alert"` on validation errors
- Screen reader: Question text read before input, validation errors announced

### Responsive/PWA checks (T071)
- Mobile (375×812): Survey form fits single column, rating scale wraps, buttons full-width
- Tablet (768×1024): Two-column layout where applicable, comfortable touch targets
- Desktop (1440×900): Centered card layout, adequate whitespace
- PWA: Install prompt available, offline shell loads, survey data syncs on reconnect

### Backward compatibility
1. View existing schemas, instances, responses → zero regressions
2. Complete existing surveys → gate works normally

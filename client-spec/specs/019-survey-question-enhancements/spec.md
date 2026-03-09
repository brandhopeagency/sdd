# Feature Specification: Survey Module Enhancements — Data Types, Conditional Visibility, Group Ordering & UX Improvements

**Feature Branch**: `019-survey-question-enhancements`  
**Created**: 2026-03-04  
**Status**: Draft  
**Jira Epic**: [MTB-446](https://mentalhelpglobal.atlassian.net/browse/MTB-446)  
**Depends on**: Feature 018-workbench-survey (all phases complete and merged), Jira Epic [MTB-405](https://mentalhelpglobal.atlassian.net/browse/MTB-405)  
**Input**: User description: "Extend freetext question types with data type validation, introduce conditional question visibility, and maintain full backward compatibility for survey results"

---

## Problem Statement

The survey module (018-workbench-survey) ships with a generic `free_text` question type that accepts any string input, with optional regex/length validation configured manually by researchers. Real-world survey instruments (e.g., the Pre-Session Intake Questionnaire) require **typed data entry** — numeric ages, dates of diagnoses, region selectors — where the generic textarea provides no input assistance, no appropriate validation, and a poor user experience.

Additionally, several questions in existing instruments are **conditionally visible** based on prior answers (e.g., "Oblast" shown only if country = Ukraine; "Diagnosis details" shown only if Q8 = yes). This conditional logic was explicitly deferred from MVP (see 018 spec, "Out of Scope — Future Phases"). Without it, users see irrelevant questions, response data contains noise, and the survey does not match the original instrument design.

This enhancement addresses both gaps while preserving full backward compatibility with existing schemas, instances, snapshots, and response data.

Beyond data types and conditional visibility, this feature also introduces: a **rating scale** question type for psychometric Likert-style responses, a **custom public header** on survey instances (replacing the default title in the gate), an **optional review step** toggle, a **Group Surveys page** with drag-and-drop ordering (replacing the numeric `priority` field) and bulk result download, **per-question intermediary saves** ensuring resumability, and a per-invitation-code **`requiresApproval` attribute** for auto-admission to groups.

---

## Clarifications

### Session 2026-03-04

- Q: Should the backend validate submitted answer values against the declared canonical `question.type`, or is validation client-side only? → A: Both — client-side for UX (inline feedback) + server-side for data integrity (reject invalid values with 422).
- Q: When a `visibilityCondition` references a `multi_choice` source question, how should the `equals` operator behave? → A: `equals` uses exact match semantics (selected options must be exactly the specified set). A new `contains` operator is introduced for checking whether the selected options include a specific value.
- Q: Should the schema editor include a preview/simulation mode for testing conditional visibility before publishing? → A: Yes — include a preview/simulation panel where researchers enter sample answers and see conditional visibility in real-time.
- Q: When a user belongs to multiple groups with active surveys, how should the gate determine survey ordering across groups (given priority field is removed)? → A: Active group first (in its drag-drop order), then other groups alphabetically with their respective orderings.
- Q: What should the custom instance header be? → A: Plain text field on the instance that replaces the instance title display in the gate UI when set; falls back to existing title when empty (backward compatible).
- Q: Should the invitation code approval attribute (item #6) be part of this spec or a separate feature? → A: Include in this spec as a new user story.
- Q: Should bulk download on the Group Surveys page include only the viewed group's responses or all groups for the instance? → A: Only the specific group's responses (matches page context).
- Q: Should the approval-required attribute on invitation codes be per-code or per-group default? → A: Per-code — each invitation code has its own `requiresApproval` flag (default: true).

### Session 2026-03-05

- Q: Should data types remain `free_text.dataType` or become canonical question types? → A: Canonical question types — each data type is represented as its own `question.type`; `free_text` remains plain/custom-regex text only.
- Q: How should Group Surveys be exposed in workbench UI? → A: Show a first-class `Surveys` tab in Group Details for users with `SURVEY_INSTANCE_MANAGE`; hide the tab entirely for unauthorized users.
- Q: Should value constraints be supported by question type? → A: Yes — type-specific constraints only (numeric/date/time/rating). Preset text types remain pattern-only.

---

## User Scenarios & Testing

### User Story 1 — Researcher Configures Typed Free-Text Questions (Priority: P1)

A researcher creates or edits a draft survey schema and selects a `free_text` question. Instead of only configuring a raw textarea, the researcher chooses a **data type** for the question — such as integer, decimal, date, time, or a regex preset like email or phone number. The workbench editor shows type-appropriate configuration options. After publishing, the chosen data type is captured in the schema and propagated to all instances via the snapshot.

**Why this priority**: Typed data entry is the foundation of this enhancement. Without it, researchers cannot author questions that collect structured data, and users do not receive appropriate input controls or validation feedback.

**Independent Test**: Create a draft schema, add questions with each canonical type (integer_signed, integer_unsigned, decimal, date, time, datetime, email, phone, url, postal_code, alphanumeric_code, and free_text with custom regex). Publish, create an instance, and verify that each question renders with the appropriate input control and validation.

**Acceptance Scenarios**:

1. **Given** a researcher is editing a draft schema, **When** they add a `free_text` question, **Then** a data type selector appears with options: Text (default), Integer (signed), Integer (unsigned), Decimal, Date, Time, Date & Time, and five regex presets (Email, Phone, URL, Postal Code, Alphanumeric Code).
2. **Given** a question with type `integer_signed`, **When** a user fills in the survey, **Then** the input renders as a numeric field accepting positive and negative whole numbers, with inline validation rejecting non-integer input.
3. **Given** a question with type `integer_unsigned`, **When** a user fills in the survey, **Then** the input renders as a numeric field accepting only non-negative whole numbers (0 and above), with inline validation rejecting negative values and non-integer input.
4. **Given** a question with type `decimal`, **When** a user fills in the survey, **Then** the input renders as a numeric field accepting floating-point numbers, with inline validation rejecting non-numeric input.
5. **Given** a question with type `date`, **When** a user fills in the survey, **Then** a date picker control is displayed; the value is stored as an ISO 8601 date string (YYYY-MM-DD).
6. **Given** a question with type `time`, **When** a user fills in the survey, **Then** a time picker control is displayed; the value is stored as an ISO 8601 time string (HH:mm).
7. **Given** a question with type `datetime`, **When** a user fills in the survey, **Then** a combined date and time picker control is displayed; the value is stored as an ISO 8601 datetime string.
8. **Given** a question with type `email`, **When** a user enters an invalid email, **Then** inline validation shows an error and the user cannot proceed until the input matches the email pattern.
9. **Given** a question with type `free_text` and a custom regex, **When** a user enters text that does not match the regex, **Then** inline validation shows an error.
10. **Given** a published schema with canonical typed questions, **When** an instance is created, **Then** the `schemaSnapshot` preserves each question's canonical `type` and the instance renders the correct input controls.

---

### User Story 2 — Researcher Configures Conditional Question Visibility (Priority: P1)

A researcher editing a draft schema adds a **visibility condition** to a question, specifying that it should only appear when a specific earlier question has been answered with a particular value. The workbench editor provides a UI to select the source question, comparison operator, and expected value. After publishing, the conditions are captured in the schema snapshot.

**Why this priority**: Conditional visibility is required for accurate reproduction of existing psychometric instruments (Pre-Session Intake Questionnaire Q6, Q9, Q22). It eliminates irrelevant questions from the user's path and produces cleaner response data.

**Independent Test**: Create a schema with Q1 (single_choice: options A, B, C) and Q2 (free_text, visible only when Q1 = "B"). Publish, deploy an instance, complete as a user selecting Q1 = "A" (Q2 should not appear), then repeat selecting Q1 = "B" (Q2 should appear).

**Acceptance Scenarios**:

1. **Given** a researcher is editing a draft schema with at least two questions, **When** they configure a visibility condition on Q2 referencing Q1, **Then** the condition is saved with the source question reference, operator, and expected value.
2. **Given** a visibility condition references a question of type `single_choice`, **When** the condition operator is "equals" and value is one of the options, **Then** the condition is valid and saveable.
3. **Given** a visibility condition references a question of type `boolean`, **When** the condition operator is "equals" and value is `true` or `false`, **Then** the condition is valid and saveable.
4. **Given** a researcher attempts to add a visibility condition referencing a question with an equal or higher order number, **Then** the editor prevents it (conditions can only reference earlier questions).
5. **Given** a researcher reorders questions such that a condition's source question would have an equal or higher order than the dependent question, **Then** the editor warns and removes the invalid condition.
6. **Given** a published schema with visibility conditions, **When** an instance is created, **Then** the `schemaSnapshot` includes `visibilityCondition` on the appropriate questions.

---

### User Story 3 — User Completes Survey with Conditional Questions (Priority: P1)

A user (officer) encounters a survey gate with conditional questions. Questions with unmet visibility conditions are skipped automatically. The progress indicator adjusts to reflect only visible questions. On the review step, only questions that were visible are shown.

**Why this priority**: This is the user-facing counterpart of conditional visibility. Users must experience a seamless, adaptive survey flow, and results must accurately reflect which questions were visible.

**Independent Test**: Complete a survey where Q3 is conditional on Q2 = "yes". Answer Q2 = "no" and verify Q3 is skipped, progress indicator shows reduced total, and results mark Q3 as not visible. Then repeat with Q2 = "yes" and verify Q3 appears.

**Acceptance Scenarios**:

1. **Given** a survey with Q1 (unconditional), Q2 (conditional on Q1 = "X"), **When** the user answers Q1 with a value other than "X", **Then** Q2 is skipped in the question flow and the progress indicator total reflects only visible questions.
2. **Given** a survey with Q1 (unconditional), Q2 (conditional on Q1 = "X"), **When** the user answers Q1 = "X", **Then** Q2 appears as the next question.
3. **Given** a conditional question that was initially visible, **When** the user goes back and changes the source question answer so the condition is no longer met, **Then** the conditional question is removed from the flow and its answer is cleared.
4. **Given** a conditional question whose source question was never answered, **Then** the conditional question is not visible and does not block survey completion.
5. **Given** a required conditional question whose visibility condition is not met, **Then** it does not block progression or submission.
6. **Given** a user completes a survey with conditional questions, **When** they view the Review step, **Then** only visible (answered or skippable) questions are listed; non-visible questions are not shown.
7. **Given** transitive conditions (Q3 depends on Q2 which depends on Q1), **When** Q1's answer hides Q2, **Then** Q3 is also hidden because its dependency (Q2) was not answered.

---

### User Story 4 — Survey Results Reflect Question Visibility (Priority: P1)

When a survey response is submitted, each answer entry records whether the question was visible to the user. Researchers viewing survey results in the workbench can distinguish between "question was visible and answered", "question was visible and left blank (optional)", and "question was not shown to the user".

**Why this priority**: Accurate result interpretation requires knowing which questions were presented. Without explicit visibility markers, researchers cannot distinguish between a deliberately blank answer and a question that was never shown — critically important for psychometric data analysis.

**Independent Test**: Submit a response where some conditional questions were hidden. View the response in the workbench and verify hidden questions are explicitly marked as "not visible" rather than simply showing null/blank.

**Acceptance Scenarios**:

1. **Given** a completed survey where Q3 was not visible, **When** a researcher views the response, **Then** Q3's answer entry includes a visibility marker indicating it was not shown to the user.
2. **Given** a completed survey where Q3 was visible and answered, **When** a researcher views the response, **Then** Q3's answer entry shows the value with visibility marked as shown.
3. **Given** a completed survey where Q3 was visible but optional and left blank, **When** a researcher views the response, **Then** Q3's answer entry shows null value with visibility marked as shown.
4. **Given** an existing survey response from a schema without visibility conditions (pre-enhancement), **When** a researcher views the response, **Then** all answers are implicitly treated as visible (backward compatible default).
5. **Given** survey results are exported or used for analysis, **When** the export includes non-visible questions, **Then** they are clearly distinguished from visible-but-unanswered questions.

---

### User Story 5 — Researcher Uses Typed Data in Existing Instruments (Priority: P2)

A researcher authors the Pre-Session Intake Questionnaire using the enhanced question types: Q1 (Age) as integer unsigned, Q6 (Oblast) as conditional free text shown when Q5 = "Україна", Q9 (Diagnosis details) as conditional free text shown when Q8 = yes, Q22 as conditional single choice shown when Q21 ≠ "ні".

**Why this priority**: This validates that the enhancement supports the real-world instruments that motivated the feature. It is a P2 because it is an application of P1 capabilities, not a new capability itself.

**Independent Test**: Author the full 25-question Pre-Session Intake Questionnaire using typed data and conditional logic. Deploy as an instance and complete as a user, verifying all conditional paths work correctly.

**Acceptance Scenarios**:

1. **Given** Q1 is configured as `free_text` with data type "Integer (unsigned)", **When** a user enters "25", **Then** it is accepted; **When** a user enters "-5" or "abc", **Then** inline validation rejects the input.
2. **Given** Q6 has a visibility condition on Q5 = "Україна", **When** Q5 = "Закордоном", **Then** Q6 is skipped and marked as not visible in results.
3. **Given** Q9 has a visibility condition on Q8 = true (boolean), **When** Q8 = false, **Then** Q9 is skipped.
4. **Given** Q22 has a visibility condition on Q21 ≠ "ні", **When** Q21 = "ні", **Then** Q22 is skipped; **When** Q21 = any other option, **Then** Q22 appears.
5. **Given** the full instrument is completed with all conditions met, **When** results are reviewed, **Then** all 25 questions appear with correct values and visibility markers.

---

### User Story 6 — Rating Scale Question Data Type (Priority: P1)

A researcher adds a `free_text` question with the "Rating Scale" data type. They configure a start value, end value, and step. In the survey gate, the user sees a visual scale control (e.g., 0–9 with tappable segments) that works with both mouse and touch interfaces and scales down to small screens.

**Why this priority**: Rating scales (e.g., Likert 1–10, satisfaction 0–9) are the most common psychometric response format in the existing instruments (Q12–Q20 in the Pre-Session Intake Questionnaire). Without a native scale control, researchers must use `single_choice` with 10 options — poor UX and no semantic meaning.

**Independent Test**: Create a schema with a rating scale question (0 to 9, step 1). Publish, deploy, and complete as a user on desktop and mobile. Verify the scale renders correctly, values are tappable/clickable, and the selected value is stored as a string.

**Acceptance Scenarios**:

1. **Given** a researcher adds a question with type `rating_scale`, **When** they configure it, **Then** fields for start value, end value, and step are displayed.
2. **Given** a rating scale question configured as 0–9 step 1, **When** a user views it in the survey gate, **Then** a visual scale control is rendered with values 0 through 9 as selectable segments.
3. **Given** a rating scale on a mobile device, **When** the user taps a value, **Then** it is selected and highlighted; the control is usable without horizontal scrolling on screens ≥ 320px wide.
4. **Given** a rating scale on desktop, **When** the user clicks a value, **Then** it is selected and highlighted.
5. **Given** a rating scale with start=1, end=5, step=1, **When** the user selects "3", **Then** the value is stored as `"3"` (string) in `SurveyAnswer.value`.

---

### User Story 7 — Custom Survey Header on Instance (Priority: P2)

A researcher creates a survey instance and sets a custom "public header" text. When the user (officer) encounters this survey in the gate, the custom header replaces the default title display. When no custom header is set, the existing instance title is shown (backward compatible).

**Why this priority**: Researchers need user-facing survey titles that differ from internal instance names. The internal title may contain version numbers or codes not meaningful to participants.

**Independent Test**: Create two instances — one with a custom header, one without. Complete both as a user. Verify the first shows the custom header, the second shows the default title.

**Acceptance Scenarios**:

1. **Given** a survey instance with `publicHeader` set to "Pre-Session Wellness Check", **When** the user sees it in the gate, **Then** "Pre-Session Wellness Check" is displayed instead of the instance title.
2. **Given** a survey instance with `publicHeader` empty or null, **When** the user sees it in the gate, **Then** the instance title is displayed (existing behavior).
3. **Given** the instance creation form in the workbench, **When** the researcher creates an instance, **Then** an optional "Public Header" text field is available.

---

### User Story 8 — Optional Review Step on Instance (Priority: P2)

A researcher creates a survey instance and can toggle whether the final review step is shown. When the review step is disabled, submitting the answer to the last visible question submits the full survey. When enabled, the existing review step behavior is preserved.

**Why this priority**: Short surveys (e.g., 3–5 questions) do not benefit from a review step — it adds unnecessary friction. Longer instruments may still require it.

**Independent Test**: Create two instances from the same schema — one with review enabled, one with review disabled. Complete both. Verify the first shows the review step; the second submits immediately after the last answer.

**Acceptance Scenarios**:

1. **Given** an instance with `showReview` set to `false`, **When** the user answers the last visible question and clicks Next, **Then** the survey is submitted immediately without a review step.
2. **Given** an instance with `showReview` set to `true` (or absent/default), **When** the user answers the last visible question, **Then** the review step is shown before final submission (existing behavior).
3. **Given** the instance creation form in the workbench, **When** the researcher creates an instance, **Then** a "Show review step" toggle is available (default: on).

---

### User Story 9 — Group Surveys Page with Drag-Drop Ordering & Bulk Download (Priority: P1)

In the workbench Group detail view, a new "Surveys" tab/page shows all survey instances assigned to the currently viewed group. The display order is controlled by drag-and-drop (persisted per group). This replaces the `priority` field on `SurveyInstance`. The page also provides bulk download of survey responses for a specific instance scoped to the current group, in JSON or CSV format.

**Why this priority**: Survey ordering is a per-group concern, not a global instance property. Drag-and-drop ordering is more intuitive than numeric priority values. Bulk download of results is a core researcher need for data analysis.

**Independent Test**: Open a group's Surveys page, drag-reorder two surveys, refresh — verify order persists. Download results for a survey in JSON and CSV — verify data is correct and scoped to the group.

**Acceptance Scenarios**:

1. **Given** a group with multiple active survey instances, **When** a researcher opens the Group Surveys page, **Then** all instances assigned to that group are listed in their persisted display order.
2. **Given** the Group Surveys page, **When** the researcher drags a survey to a new position, **Then** the new order is saved and reflected on next load. The gate displays surveys in this order for users in the group.
3. **Given** the Group Surveys page, **When** the researcher clicks download for an instance, **Then** a format picker (JSON / CSV) is shown.
4. **Given** a download request for JSON format, **When** the download completes, **Then** the file contains all responses for the selected instance scoped to the current group only, with answer values, visibility markers, and pseudonymous IDs.
5. **Given** a download request for CSV format, **When** the download completes, **Then** the file has one row per response, columns for each question (with question text as header), visibility markers, and pseudonymous IDs.
6. **Given** a user in multiple groups with active surveys, **When** the gate determines survey order, **Then** surveys from the user's active group are shown first (in that group's drag-drop order), then surveys from other groups in alphabetical group order with their respective orderings.

---

### User Story 10 — Invitation Code Approval Attribute (Priority: P2)

In group management, each invitation code gains a `requiresApproval` boolean attribute (default: `true`). When a user enters a code where `requiresApproval` is `false`, they are automatically admitted to the group without manual admin approval. When `true`, the existing approval workflow is preserved.

**Why this priority**: Some recruitment scenarios (trusted cohorts, pre-screened participants) benefit from instant access. Others (open recruitment, unknown participants) require vetting. Per-code control gives group admins flexibility.

**Independent Test**: Generate two invitation codes for a group — one with approval required, one without. Use each to join. Verify the first requires admin approval; the second grants immediate access.

**Acceptance Scenarios**:

1. **Given** a group admin generates an invitation code, **When** the creation form is submitted, **Then** a "Requires approval" toggle is available (default: on/true).
2. **Given** a user enters an invitation code where `requiresApproval` is `false`, **When** the code is valid and not expired, **Then** the user is immediately added to the group with active status — no admin approval required.
3. **Given** a user enters an invitation code where `requiresApproval` is `true`, **When** the code is valid, **Then** the existing approval workflow is triggered (user enters pending state until admin approves).
4. **Given** the workbench group management view, **When** an admin views generated codes, **Then** each code displays its `requiresApproval` status.

---

### Edge Cases

- **User changes a source answer after answering a conditional question**: The conditional question's answer is cleared and the question is removed from the visible flow. If the user changes back, the question reappears without a pre-filled answer.
- **Multiple conditions on the same question**: Not supported in this enhancement. Each question supports at most one visibility condition. Multi-condition logic is deferred.
- **Condition on a conditional question (transitive/chained)**: Supported. If Q3 depends on Q2 and Q2 depends on Q1, hiding Q2 (by changing Q1) also hides Q3 transitively.
- **Condition references a question that is later deleted from the draft**: The condition is automatically removed when the source question is deleted.
- **Condition references a question that is reordered to after the dependent question**: The editor prevents this reorder or removes the now-invalid condition with a warning.
- **Date/time picker on mobile**: Native platform pickers are used on mobile devices. Fallback to browser-native input types if custom pickers are unavailable.
- **Numeric input on mobile**: Numeric keyboard is triggered via `inputMode` attributes on integer and decimal fields.
- **Decimal separator locale differences (comma vs. dot)**: Input accepts both comma and dot as decimal separators. Storage always uses dot notation.
- **Partial save with conditional questions**: Partial progress records the current answer state. On resume, visibility conditions are re-evaluated against saved answers.
- **Schema snapshot backward compatibility**: Snapshots from schemas without canonical type extensions or `visibilityCondition` continue to render with default `free_text` behavior and no conditions (all questions visible).
- **Rating scale with fractional step (e.g., 0 to 1, step 0.1)**: Supported. The scale renders discrete selectable values at each step increment. The stored value is the string representation of the selected number.
- **Rating scale with large range (e.g., 0 to 100)**: The control adapts to display a slider or compact scale; individual segments are not rendered if count exceeds a threshold (e.g., > 20 segments → slider mode).
- **Survey with review step disabled and user navigates back**: The user can still go back to previous questions. Only the final Next on the last question triggers immediate submission.
- **Group Surveys page for a group with no assigned surveys**: Empty state with clear messaging.
- **Drag-drop ordering and new survey added**: A newly assigned survey instance appears at the end of the group's ordered list by default.
- **Invitation code with `requiresApproval: false` and code expired**: Expired code is rejected regardless of approval setting.
- **Intermediary save on question navigation**: Each answer is saved server-side when the user navigates to the next question. If the user closes the browser mid-survey, the next visit resumes from the last saved question with all prior answers pre-filled.

---

## Requirements

### Functional Requirements

#### Free-Text Data Types

- **FR-001**: System MUST represent typed inputs as canonical `question.type` values (for example: `integer_signed`, `integer_unsigned`, `decimal`, `date`, `time`, `datetime`, `email`, `phone`, `url`, `postal_code`, `alphanumeric_code`, `rating_scale`, `free_text`). The `free_text` type remains plain/custom-regex text only.
- **FR-002**: System MUST support the following numeric canonical question types: `integer_signed` (positive and negative whole numbers), `integer_unsigned` (non-negative whole numbers, 0 and above), and `decimal` (floating-point numbers).
- **FR-003**: System MUST support the following date/time canonical question types: `date` (calendar date, stored as ISO 8601 YYYY-MM-DD), `time` (time of day, stored as ISO 8601 HH:mm), and `datetime` (combined, stored as ISO 8601 datetime).
- **FR-003a**: System MUST support type-specific value constraints: numeric types may define optional `minValue`/`maxValue`; `date`/`time`/`datetime` may define optional `min`/`max` bounds in the same storage format; `rating_scale` constraints are defined by `startValue`/`endValue`/`step` and MUST be internally consistent.
- **FR-004**: System MUST provide five built-in regex presets for `free_text` text validation: `email` (standard email pattern), `phone` (international phone number with optional + prefix), `url` (HTTP/HTTPS web address), `postal_code` (alphanumeric postal/ZIP code), and `alphanumeric_code` (letters and digits only, no special characters).
- **FR-005**: System MUST continue to support `text` data type with optional custom regex, minLength, and maxLength validation (existing behavior, fully preserved).
- **FR-006**: For non-`free_text` question types, the system MUST apply built-in validation automatically based on `question.type`. The `validation.regex` field is only applicable to `free_text`.
- **FR-007**: System MUST render type-appropriate input controls by `question.type`: numeric input for integer/decimal types, platform-native date/time pickers for date/time types, visual scale for `rating_scale`, and standard text input for `free_text`.
- **FR-008**: System MUST display inline validation feedback as the user types or selects a value, with clear error messages specific to the data type (e.g., "Please enter a valid whole number", "Please enter a valid email address").
- **FR-009**: On mobile devices, numeric data types MUST trigger the numeric keyboard, and date/time types MUST use native platform pickers where available.
- **FR-010**: All data type values MUST be stored as strings in `SurveyAnswer.value`, consistent with the existing free-text answer format. Numeric values stored as their string representation; date/time values stored as ISO 8601 strings.
- **FR-010a**: The backend MUST validate submitted answer values against the declared `question.type` (and type-specific config in `schemaSnapshot`, where applicable). Invalid values MUST be rejected with a `422 Unprocessable Entity` response. This server-side validation is defense-in-depth alongside client-side inline validation (FR-008).
- **FR-010b**: When type-specific constraints are configured, both client and backend validation MUST enforce them and return clear, type-appropriate validation errors.

#### Conditional Question Visibility

- **FR-011**: System MUST support an optional `visibilityCondition` on any `SurveyQuestion`, defining a condition based on the answer to an earlier question in the same schema.
- **FR-012**: A visibility condition MUST reference a question with a strictly lower `order` value within the same schema. The system MUST reject conditions that reference equal or higher-order questions.
- **FR-013**: System MUST support the following condition operators: `equals` (answer exactly matches a specific value — for `multi_choice` sources, the selected set must exactly equal the specified set), `not_equals` (answer does not exactly match a specific value), `in` (answer is one of a set of values), and `contains` (for `multi_choice` sources, the selected options include the specified value).
- **FR-014**: If the source question referenced by a visibility condition has not been answered (value is null or undefined), the condition MUST evaluate to `false` and the dependent question MUST NOT be visible.
- **FR-015**: If a visibility condition evaluates to `false`, the dependent question MUST be skipped in the survey flow, excluded from the progress indicator count of total questions, and its answer MUST NOT block survey submission regardless of the question's `required` flag.
- **FR-016**: If a user changes the answer to a source question such that a previously visible conditional question's condition is no longer met, the conditional question's existing answer MUST be cleared and the question MUST be removed from the visible flow.
- **FR-017**: Transitive (chained) visibility MUST be supported. If Q3 depends on Q2 and Q2 depends on Q1, hiding Q2 by changing Q1's answer MUST also hide Q3.
- **FR-018**: Each question MUST support at most one visibility condition. Multiple conditions on a single question are out of scope for this enhancement.
- **FR-019**: When a source question is deleted from a draft schema, any visibility conditions referencing that question MUST be automatically removed.
- **FR-020**: When questions are reordered in a draft schema such that a condition's source question would have an equal or higher order than the dependent question, the system MUST warn the user and remove the invalid condition.

#### Survey Results & Backward Compatibility

- **FR-021**: Each `SurveyAnswer` entry in a response MUST include a `visible` field (boolean) indicating whether the question was displayed to the user at the time of submission. Defaults to `true` for backward compatibility with existing responses that lack this field.
- **FR-022**: Non-visible questions MUST be recorded in the response with `value: null` and `visible: false`. They MUST NOT be counted as unanswered required questions for validation purposes.
- **FR-023**: Existing survey schemas without canonical type extensions or `visibilityCondition` fields MUST continue to function identically. Legacy free-text records remain valid and default behavior is preserved. The absence of `visibilityCondition` MUST be treated as unconditionally visible.
- **FR-024**: Existing survey responses without the `visible` field on answers MUST be treated as if all answers have `visible: true` (all questions were shown).
- **FR-025**: Existing `schemaSnapshot` data in deployed instances MUST remain valid. The survey gate renderer MUST handle snapshots both with and without the new fields gracefully.
- **FR-026**: The `SurveyAnswer.value` type MUST remain `string | string[] | boolean | null` — no new value types are introduced. All new data types serialize to string representation.

#### Workbench Schema Editor Enhancements

- **FR-027**: The schema editor MUST display a question type selector exposing all supported canonical types grouped by category: Numeric (Integer signed, Integer unsigned, Decimal), Date/Time (Date, Time, Date & Time), Rating Scale, Text Presets (Email, Phone, URL, Postal Code, Alphanumeric Code), and Free text (custom regex).
- **FR-028**: For preset text question types (`email`, `phone`, `url`, `postal_code`, `alphanumeric_code`), validation is built-in and preset-driven. For `free_text`, the regex field MUST remain editable (existing behavior).
- **FR-028a**: Preset text question types MUST NOT expose numeric/date/rating range constraints in the editor.
- **FR-029**: The schema editor MUST provide a visibility condition configurator for each question (except Q1, which cannot have a condition since there are no prior questions). The configurator MUST allow selecting a source question (filtered to lower-order questions only), an operator, and an expected value.
- **FR-030**: The expected value input in the visibility condition configurator MUST adapt to the source question type: dropdown of options for `single_choice`, boolean toggle for `boolean`, and free-text input for `free_text` and `multi_choice`.
- **FR-031**: The schema editor MUST display a visual indicator (icon or label) on questions that have a visibility condition configured, showing which question they depend on.
- **FR-031a**: The schema editor MUST provide a preview/simulation panel for schemas with visibility conditions. In preview mode, the researcher can enter sample answers for each question and see in real-time which conditional questions become visible or hidden based on those answers. Preview mode is read-only — it does not modify the schema.

#### Rating Scale Data Type

- **FR-034**: System MUST support `rating_scale` as a canonical question type, characterized by three configuration parameters: `startValue` (number), `endValue` (number), and `step` (number). The scale generates discrete selectable values from startValue to endValue at the given step increment.
- **FR-035**: The survey gate MUST render rating scale questions as a visual scale control with selectable segments for each value. The control MUST support both mouse click and touch tap interaction.
- **FR-036**: The rating scale control MUST scale down to screens as narrow as 320px without requiring horizontal scrolling. For scales with many segments (> 20), the system MUST fall back to a slider control.
- **FR-037**: The selected rating scale value MUST be stored as a string in `SurveyAnswer.value` (consistent with FR-010).
- **FR-038**: `rating_scale` MUST be a canonical `question.type` and selectable in the schema editor question-type selector. When selected, the editor MUST show configuration fields for start value, end value, and step.

#### Custom Survey Header

- **FR-039**: `SurveyInstance` MUST support an optional `publicHeader` field (string, max 300 characters). When set, the survey gate MUST display `publicHeader` instead of the instance title as the survey heading. When empty or null, the instance title is shown (backward compatible).
- **FR-040**: The instance creation form in the workbench MUST include an optional "Public Header" text field.

#### Optional Review Step

- **FR-041**: `SurveyInstance` MUST support a `showReview` boolean field (default: `true`). When `false`, the survey gate MUST skip the review step — clicking Next on the last visible question triggers immediate submission.
- **FR-042**: The instance creation form in the workbench MUST include a "Show review step" toggle (default: on).

#### Group Surveys Page & Survey Ordering

- **FR-043**: The `priority` field MUST be removed from `SurveyInstance`. Survey display order MUST be determined by per-group ordering instead.
- **FR-044**: A new "Surveys" page MUST be added to the workbench Group detail view, listing all survey instances assigned to the current group in their persisted display order.
- **FR-044a**: The Group detail view MUST show the `Surveys` tab only to users with `SURVEY_INSTANCE_MANAGE` permission; for users without this permission, the tab MUST be hidden (not shown as disabled).
- **FR-045**: Survey display order on the Group Surveys page MUST be controllable via drag-and-drop reordering. The order MUST be persisted per group and used by the survey gate to determine the sequence in which surveys are presented to users in that group.
- **FR-046**: Newly assigned survey instances MUST appear at the end of the group's ordered list by default.
- **FR-047**: When a user belongs to multiple groups with active surveys, the gate MUST show surveys from the user's active group first (in that group's drag-drop order), then surveys from other groups in alphabetical group name order with their respective orderings.
- **FR-048**: The Group Surveys page MUST provide bulk download of survey responses for a selected instance, scoped to the current group only.
- **FR-049**: Bulk download MUST support two formats: JSON (array of response objects with answers, visibility, pseudonymous IDs) and CSV (one row per response, question text as column headers, with visibility markers).

#### Intermediary Answer Persistence

- **FR-050**: When the user navigates to the next question, the current answer MUST be saved server-side (partial save). If the user stops responding or leaves the page, the next visit MUST resume from the last saved question with all prior answers pre-filled.

#### Invitation Code Approval Attribute

- **FR-051**: Each invitation code MUST have a `requiresApproval` boolean attribute (default: `true`). When `false`, users entering the code are automatically admitted to the group with active status — no admin approval required.
- **FR-052**: The invitation code creation form in the workbench group management MUST include a "Requires approval" toggle (default: on).
- **FR-053**: The workbench group management view MUST display the `requiresApproval` status for each generated invitation code.

#### Workbench Response Viewer Enhancements

- **FR-032**: The response viewer in the workbench MUST visually distinguish between answers where the question was visible and answers where the question was not visible (e.g., grayed out with a "Not shown" label).
- **FR-033**: The response viewer MUST support filtering or highlighting non-visible answers to allow researchers to focus on relevant data.

### Key Entities

- **SurveyQuestion.type** (updated canonical field): Represents the concrete question kind and drives rendering + validation directly. Supported values include `free_text`, `integer_signed`, `integer_unsigned`, `decimal`, `date`, `time`, `datetime`, `email`, `phone`, `url`, `postal_code`, `alphanumeric_code`, and `rating_scale`.
- **SurveyQuestion.ratingScaleConfig** (new field): Configuration for the `rating_scale` question type. Contains `startValue` (number), `endValue` (number), `step` (number). Required when `type` is `rating_scale`, null otherwise.
- **SurveyQuestion.visibilityCondition** (new field): Optional condition that determines whether the question is displayed to the user. References a source question by ID, an operator (`equals`, `not_equals`, `in`, `contains`), and an expected value.
- **SurveyAnswer.visible** (new field): Boolean indicating whether the question was shown to the user at the time of answer recording. Defaults to `true` for backward compatibility.
- **SurveyInstance.publicHeader** (new field): Optional plain text string (max 300 chars) shown to users in the gate instead of the instance title. When empty/null, falls back to instance title.
- **SurveyInstance.showReview** (new field): Boolean (default `true`). When `false`, the final review step is skipped and the last answer submission triggers full survey completion.
- **SurveyInstance.priority** (removed): Replaced by per-group ordering via `GroupSurveyOrder`.
- **GroupSurveyOrder** (new entity): Persists the display order of survey instances within a group. Each entry maps a `(groupId, instanceId)` pair to a `displayOrder` integer. Managed via drag-and-drop on the Group Surveys page.
- **InvitationCode.requiresApproval** (new field): Boolean (default `true`). When `false`, users entering this code are auto-admitted to the group without admin approval.

---

## Success Criteria

### Measurable Outcomes

- **SC-001**: Researchers can configure and publish schemas using all supported question types (free text, 3 numeric, 3 date/time, 5 preset text types, rating scale) and verify each renders with the correct input control in the survey gate.
- **SC-002**: Users completing surveys with numeric data types see appropriate input controls (numeric keyboard on mobile, numeric-only input on desktop) and receive inline validation feedback within 200ms of input.
- **SC-002a**: For questions with configured type-specific constraints, invalid out-of-range inputs are rejected consistently in both client and backend validation paths.
- **SC-003**: Users completing surveys with date/time data types interact with picker controls — not raw text fields — on both desktop and mobile platforms.
- **SC-004**: Surveys with conditional visibility correctly skip non-applicable questions, reducing the visible question count to only relevant questions for the user's specific answer path.
- **SC-005**: 100% of survey responses from enhanced schemas include explicit `visible` markers on every answer, enabling accurate data analysis distinguishing between "not shown" and "shown but unanswered".
- **SC-006**: 100% of existing surveys (schemas, instances, snapshots, and responses created before this enhancement) continue to function identically with zero data migration required.
- **SC-007**: The Pre-Session Intake Questionnaire (25 questions with Q6, Q9, Q22 conditional) can be fully authored, deployed, and completed using the enhanced question types and conditional visibility, matching the original instrument design.
- **SC-008**: Users can complete a survey with conditional questions in equal or less time compared to the same survey with all questions shown unconditionally — conditional logic does not add friction.
- **SC-009**: Rating scale controls render correctly on screens ≥ 320px wide and are usable with both mouse and touch input.
- **SC-010**: Survey display order in the gate matches the per-group drag-drop ordering configured on the Group Surveys page.
- **SC-011**: Researchers can bulk download group-scoped survey results in both JSON and CSV formats, with correct response data and visibility markers.
- **SC-012**: When a user leaves a survey mid-session, the next visit resumes from exactly the last saved question with all prior answers pre-filled.
- **SC-013**: Invitation codes with `requiresApproval: false` grant immediate group access without admin intervention.

---

## Goals & Non-Goals

### In Scope

- Canonical question types for numeric/date/time/preset validation and `free_text` for custom regex text
- Type-appropriate input controls and automatic validation with inline feedback
- Conditional question visibility based on single prior-question conditions
- Visibility tracking in survey responses for accurate data interpretation
- Full backward compatibility with all existing survey data (schemas, instances, snapshots, responses)
- Workbench editor enhancements for data type selection and condition configuration
- Workbench response viewer enhancements showing visibility status
- Schema editor preview/simulation mode for testing conditional visibility paths before publishing
- Rating scale question data type with visual scale control
- Custom public header on survey instances (replaces default title in gate)
- Optional review step toggle on survey instances
- Group Surveys page with drag-and-drop ordering and bulk result download (replaces `priority` field)
- Per-question intermediary server-side save on navigation
- Invitation code `requiresApproval` attribute for auto-admission

### Out of Scope

- Multiple conditions on a single question (AND/OR logic between conditions)
- Conditions based on computed values or cross-question aggregations
- Conditional visibility for non-`free_text` question types' internal options (e.g., showing/hiding specific choice options)
- Automated scoring or subscale computation (separate future phase)
- Data type conversion or transformation on stored values
- Custom validation messages authored by researchers (system uses default messages per data type)
- Conditional branching to different survey paths (skip logic only hides/shows individual questions; survey order remains linear)
- Multi-field/computed constraints beyond single-question type-specific validation — may be added in a follow-up
- Custom date/time format display (always ISO 8601 storage; locale-aware display)

---

## Assumptions

- The 018-workbench-survey module is fully merged and deployed, with all phases (including v2 extensions for invalidation, memory, and review step) complete.
- The existing `SurveyQuestion` JSONB structure in `survey_schemas.questions` and `schemaSnapshot` is additively extensible — new optional fields do not break existing serialization/deserialization.
- The existing `SurveyAnswer` JSONB structure in `survey_responses.answers` is additively extensible — new optional fields on answer objects are ignored by existing consumers.
- Platform-native date/time pickers are available in all supported browsers (Chrome, Firefox, Safari, Edge — current versions). Custom fallback is not required for unsupported legacy browsers.
- The `inputMode` HTML attribute is sufficient to trigger the numeric keyboard on iOS and Android for numeric data types.
- Regex presets use well-established patterns suitable for international use (e.g., phone number pattern accepts international format with optional + prefix).

---

## Open Questions

| # | Question | Owner |
|---|---|---|
| 1 | Should numeric data types support optional min/max range constraints in a follow-up (e.g., Age between 18–120)? If so, this could be added as a second iteration of FR-002/FR-003. | Product |
| ~~2~~ | ~~Should the system support "not_equals" conditions for `multi_choice` questions?~~ **Resolved:** `equals` uses exact-match semantics; new `contains` operator added for checking if selected options include a specific value. | Product |
| 3 | Should the `GroupSurveyOrder` entity support ordering across multiple groups in a single API call, or is per-group ordering sufficient? | Engineering |

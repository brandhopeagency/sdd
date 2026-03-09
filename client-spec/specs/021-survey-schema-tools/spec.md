# Feature Specification: Survey Schema Tools — Autosave, Preview & Export/Import

**Feature Branch**: `021-survey-schema-tools`  
**Created**: 2026-03-05  
**Status**: Draft  
**Jira Epic**: [MTB-583](https://mentalhelpglobal.atlassian.net/browse/MTB-583)  
**Depends on**: Feature 018-workbench-survey (merged), Feature 019-survey-question-enhancements (in progress)  
**Input**: User description: "autosave survey schema on edit, preview/simulate survey, export/import survey schema to/from JSON"

---

## Problem Statement

Researchers authoring survey schemas in the Workbench currently face three workflow gaps:

1. **No autosave**: Edits to draft schemas require explicit save actions. If a researcher navigates away, loses connectivity, or closes the browser tab mid-edit, unsaved changes are lost. This is especially painful for complex schemas with many questions, conditional logic, and typed data configurations.

2. **No end-to-end preview**: While 019-survey-question-enhancements introduces a conditional visibility simulation panel, there is no way for a researcher to experience the full survey as a user would — including gate rendering, question-by-question navigation, progress indicators, typed input controls, and the review step. Researchers must publish a schema, create an instance, and complete it as a test user to verify the experience.

3. **No portability**: Schemas cannot be transferred between environments (e.g., dev → staging → production), shared with colleagues outside the Workbench, backed up locally, or version-controlled externally. Researchers who develop instruments offline have no way to import them.

These gaps slow down survey authoring, increase the risk of data loss, and make cross-environment workflows manual and error-prone.

---

## Clarifications

### Session 2026-03-05

- Q: Should exported JSON preserve the stable question IDs (UUIDs) used for internal visibility condition references, or regenerate/remap them on import? → A: Preserve question IDs — export includes each question's stable UUID; import reuses them in the new draft. This guarantees round-trip fidelity for visibility conditions without remapping logic.
- Q: What should the autosave debounce interval be? → A: 2 seconds after the last edit action — standard autosave interval balancing responsiveness and API efficiency.
- Q: How should the preview be presented — side-by-side panel, modal overlay, or full-screen page? → A: Modal overlay — preview opens as a centered modal dialog over the editor, simulating the gate's blocking layout while keeping the editor context one click away.
- Q: Should Supervisors have access to Export and Preview (read-only schema tools)? → A: Yes — Supervisors have all the same permissions as Researchers for schema tools (Export, Preview, and Import).
- Q: Should the spec include an explicit out-of-scope boundary? → A: Yes — no batch import, no schema diff/merge, no export version history, no collaborative real-time editing.

---

## User Scenarios & Testing

### User Story 1 — Schema Autosave on Edit (Priority: P1)

A researcher opens a draft survey schema in the Workbench editor and begins making changes — adding questions, reordering them, editing text, configuring types and conditions. As they work, the system automatically saves their changes in the background without requiring an explicit save action. A visual indicator shows save status (saving, saved, error). If the researcher navigates away and returns, all changes are preserved.

**Why this priority**: Data loss from unsaved edits is the highest-friction pain point in the current authoring workflow. Autosave is a prerequisite for a trustworthy editing experience, especially as schemas grow more complex with typed questions and conditional logic.

**Independent Test**: Open a draft schema, add a question, wait for the autosave indicator to show "Saved", close the browser tab without any manual save action, reopen the schema, and verify the added question is present.

**Acceptance Scenarios**:

1. **Given** a researcher is editing a draft schema, **When** they make any change (add/edit/remove question, reorder, edit title/description), **Then** the system automatically saves the change within a short interval after the last edit.
2. **Given** a draft schema with autosave active, **When** the save completes successfully, **Then** a visual indicator shows "Saved" with a timestamp.
3. **Given** a draft schema with autosave active, **When** the save fails due to a network error, **Then** a visual indicator shows "Save failed" with a retry option, and unsaved changes are retained in the editor.
4. **Given** a researcher closes the browser tab after autosave completes, **When** they reopen the schema, **Then** all autosaved changes are present.
5. **Given** a published or archived schema, **When** the researcher opens it, **Then** autosave is disabled (schema is read-only).
6. **Given** two researchers editing the same draft schema simultaneously, **When** one saves, **Then** the other is notified of the conflict and can choose to reload or overwrite.

---

### User Story 2 — Survey Preview/Simulation (Priority: P1)

A researcher working on a draft or published schema opens a preview mode that renders the survey exactly as a user would see it in the gate — question by question, with typed input controls, conditional visibility, progress indicator, and review step. The researcher can walk through the survey, enter sample answers, observe conditional logic in action, and verify the complete user experience without publishing or deploying.

**Why this priority**: Preview is essential for quality assurance. Without it, researchers must go through the full publish → deploy → test-as-user cycle to verify survey behavior. This is slow, creates throwaway data, and cannot be done for draft schemas. Preview enables rapid iteration during authoring.

**Independent Test**: Open a draft schema with conditional questions and typed inputs, enter Preview mode, walk through questions entering sample data, verify conditional questions appear/hide correctly, verify input controls match question types, reach the review step, and exit preview without any changes to the schema or any survey data being created.

**Acceptance Scenarios**:

1. **Given** a draft schema with at least one question, **When** the researcher clicks "Preview", **Then** a modal overlay opens rendering the survey in gate-style layout with question-by-question navigation.
2. **Given** a preview is active, **When** the researcher navigates through questions, **Then** the progress indicator shows current question / total visible questions, matching gate behavior.
3. **Given** a preview with conditional questions, **When** the researcher enters answers that trigger visibility conditions, **Then** conditional questions appear or hide in real-time, matching the gate behavior described in 019.
4. **Given** a preview with typed questions (numeric, date, rating scale), **When** the researcher interacts with them, **Then** the correct input controls are rendered (numeric input, date picker, scale widget).
5. **Given** a preview is active, **When** the researcher completes all questions, **Then** the review step is shown (simulating the gate review experience).
6. **Given** a preview is active, **Then** no survey response data is created or persisted — preview is entirely client-side.
7. **Given** a published or archived schema, **When** the researcher clicks "Preview", **Then** the preview opens in read-only mode with the same rendering.
8. **Given** a preview is active, **When** the researcher clicks "Exit Preview" or closes the modal, **Then** they return to the editor with no side effects.

---

### User Story 3 — Export Survey Schema to JSON File (Priority: P2)

A researcher exports a survey schema (draft, published, or archived) as a downloadable JSON file. The exported file contains the complete schema definition — title, description, questions with all configuration (types, options, conditions, validation), and metadata. The file can be stored locally, shared, or version-controlled.

**Why this priority**: Export enables portability, backup, and sharing. It is a prerequisite for import (US4) but delivers standalone value. Researchers can back up schemas before destructive edits, share instrument definitions via email or file transfer, and store them in version control.

**Independent Test**: Open a published schema with multiple question types and conditional logic, click Export, verify a JSON file is downloaded. Open the file and confirm it contains all schema details including question types, options, conditions, and validation rules.

**Acceptance Scenarios**:

1. **Given** a schema (any status), **When** the researcher clicks "Export", **Then** a JSON file is downloaded with the filename format `survey-schema-{title-slug}-{date}.json`.
2. **Given** the exported JSON file, **When** opened in a text editor, **Then** it contains the complete schema definition: title, description, and all questions with their type, text, order, required flag, options, validation, visibility conditions, rating scale config, and risk flag.
3. **Given** a schema with special characters in the title, **When** exported, **Then** the filename slug handles special characters gracefully (replaced with hyphens, truncated if too long).
4. **Given** the exported JSON, **Then** it includes a `schemaVersion` field indicating the export format version for forward compatibility.
5. **Given** the exported JSON, **Then** it does NOT include server-side-only fields (database ID, createdBy user ID, timestamps) — only the portable schema definition.

---

### User Story 4 — Import Survey Schema from JSON File (Priority: P2)

A researcher imports a survey schema from a JSON file into the Workbench, creating a new draft schema. The import validates the file structure, reports any errors, and on success creates a fully editable draft. The imported schema is independent — it has no link to the source environment or original schema.

**Why this priority**: Import completes the portability story. Combined with export, it enables cross-environment transfer, instrument sharing between research teams, and restoration from backups.

**Independent Test**: Export a schema from one environment, import the JSON file in another environment (or the same one), verify a new draft schema is created with all questions, types, conditions, and configuration matching the original.

**Acceptance Scenarios**:

1. **Given** a researcher is on the schema list page, **When** they click "Import" and select a valid JSON file, **Then** a new draft schema is created with title, description, and all questions from the file.
2. **Given** a valid JSON file is imported, **When** the import completes, **Then** the researcher is navigated to the newly created draft schema in the editor.
3. **Given** a JSON file with an invalid structure (missing required fields, malformed JSON), **When** the researcher attempts to import, **Then** a clear error message describes what is wrong and no schema is created.
4. **Given** a JSON file with an unrecognized question type, **When** imported, **Then** the system reports a validation error listing the unsupported type(s).
5. **Given** a JSON file with visibility conditions referencing non-existent question IDs, **When** imported, **Then** the system reports a validation error describing the broken references.
6. **Given** a JSON file exported from a newer schema version than the current system supports, **When** imported, **Then** the system reports a version incompatibility error.
7. **Given** a successful import, **Then** the new schema has a new unique ID, `createdBy` set to the importing researcher, status set to `draft`, and no link to the original schema.
8. **Given** a JSON file with the same title as an existing schema, **When** imported, **Then** the import succeeds — duplicate titles are allowed (schemas are identified by ID, not title).

---

### Edge Cases

- **Autosave during network outage**: Changes are queued locally. When connectivity resumes, the queued changes are saved. If the outage exceeds a threshold (e.g., 30 seconds), a persistent warning is shown.
- **Autosave conflict (concurrent editors)**: Last-write-wins is the default (consistent with 018 MVP decision). A notification is shown to the other editor that the schema was updated externally.
- **Preview of schema with zero questions**: Preview button is disabled with a tooltip explaining at least one question is required.
- **Preview of schema with broken visibility conditions**: Preview renders the question but shows a warning badge on the condition. The question is shown as unconditionally visible in preview.
- **Export of schema with no questions**: Export succeeds — the file contains the schema metadata with an empty questions array.
- **Import of very large file**: File size is limited (e.g., 5 MB). Files exceeding the limit are rejected with a clear error.
- **Import of non-JSON file**: File type validation rejects non-JSON files before parsing.
- **Autosave frequency and rapid edits**: Autosave debounces rapid changes (e.g., typing question text) with a 2-second interval after the last edit. Saves are triggered after the pause, avoiding excessive API calls.
- **Browser tab close with unsaved changes**: If autosave has pending changes that haven't been saved yet, the browser shows a "You have unsaved changes" confirmation dialog.
- **Preview on mobile/tablet**: Preview renders responsively, matching the gate's responsive behavior on smaller screens.

---

## Requirements

### Functional Requirements

#### Autosave

- **FR-001**: System MUST automatically save changes to draft survey schemas within 2 seconds after the last edit action. No explicit "Save" button is required for draft schemas.
- **FR-002**: System MUST display a persistent save status indicator in the schema editor showing one of: "Saving...", "Saved [timestamp]", or "Save failed — [Retry]".
- **FR-003**: If autosave fails due to a network error, the system MUST retain unsaved changes in the editor and provide a manual retry option. Changes MUST NOT be silently discarded.
- **FR-004**: If the browser tab is closed while autosave has pending unsaved changes, the browser MUST show a confirmation dialog warning about unsaved changes.
- **FR-005**: Autosave MUST be disabled for published and archived schemas (read-only mode).
- **FR-006**: If another user modifies the same draft schema while the current user is editing, the system MUST notify the current user of the external change, offering the choice to reload the latest version or continue editing (with a warning that saving will overwrite the other user's changes).

#### Preview/Simulation

- **FR-007**: System MUST provide a "Preview" action on any schema (draft, published, or archived) with at least one question. Available to Researcher, Admin, and Supervisor roles.
- **FR-008**: The preview MUST render as a centered modal overlay, displaying the survey in a gate-style layout — one question at a time, with Next/Back navigation, a progress indicator (question X of N), and typed input controls matching each question type.
- **FR-009**: The preview MUST evaluate visibility conditions in real-time as the researcher enters sample answers, showing or hiding conditional questions and adjusting the progress indicator total accordingly.
- **FR-010**: The preview MUST render a review step at the end of the question sequence (simulating the gate review step). Since preview operates at the schema level (not instance level), the instance-level `showReview` setting does not apply — the review step is always shown in schema preview.
- **FR-011**: The preview MUST NOT create, persist, or modify any survey response data. All preview state is client-side and ephemeral.
- **FR-012**: The preview MUST be available from the schema editor (for drafts) and the schema detail view (for published/archived schemas).
- **FR-013**: The "Preview" button MUST be disabled when the schema has zero questions, with a tooltip explaining the requirement.

#### Export

- **FR-014**: System MUST provide an "Export" action on any schema (draft, published, or archived). Available to Researcher, Admin, and Supervisor roles.
- **FR-015**: The export MUST produce a downloadable JSON file containing the portable schema definition: title, description, and the complete ordered questions array with all configuration fields (id, type, text, order, required, options, validation, visibilityCondition, ratingScaleConfig, riskFlag). Each question's stable `id` (UUID) MUST be preserved to maintain visibility condition references.
- **FR-016**: The exported JSON MUST include a `schemaVersion` field indicating the export format version, enabling forward-compatible import validation.
- **FR-017**: The exported JSON MUST NOT include server-internal fields: schema-level database ID, `createdBy`, `createdAt`, `publishedAt`, `archivedAt`, `updatedAt`, `clonedFromId`, or `status`. Question-level `id` fields ARE included (they are stable identifiers within the schema, not database PKs, and are required for visibility condition references).
- **FR-018**: The exported file MUST be named using the pattern `survey-schema-{title-slug}-{YYYY-MM-DD}.json`, with the title slug derived from the schema title (lowercased, special characters replaced with hyphens, truncated to 50 characters).

#### Import

- **FR-019**: System MUST provide an "Import" action on the schema list page, allowing a Researcher, Admin, or Supervisor to upload a JSON file.
- **FR-020**: On import, the system MUST validate the JSON file structure against the expected schema format: valid JSON syntax, required fields present (title, questions array), and all question entries conforming to the supported question type definitions.
- **FR-021**: On import, the system MUST validate visibility condition references — all source question IDs referenced in conditions must exist within the same file's questions array and must reference questions with a strictly lower order.
- **FR-022**: On import, the system MUST validate the `schemaVersion` field. If the version is newer than the system supports, the import MUST be rejected with a version incompatibility error.
- **FR-023**: If validation passes, the system MUST create a new draft schema with a new unique ID, `createdBy` set to the importing user (Researcher, Admin, or Supervisor), status `draft`, and all questions from the file. No link to the original schema is created.
- **FR-024**: If validation fails, the system MUST display a clear, specific error message describing all validation issues and MUST NOT create any schema.
- **FR-025**: The import MUST accept files up to 5 MB. Files exceeding this limit MUST be rejected with a size error before parsing.
- **FR-026**: The import MUST reject non-JSON files (based on content parsing, not just file extension) with a clear format error.

#### Responsive & Accessibility

- **FR-027**: The preview rendering MUST be responsive across modern mobile/tablet/desktop viewports, matching the gate's responsive behavior.
- **FR-028**: The autosave status indicator, preview controls, and export/import actions MUST be keyboard-accessible and screen-reader compatible.
- **FR-029**: All new user-visible text introduced by this feature — including save status labels ("Saving...", "Saved", "Save failed"), button labels ("Preview", "Export", "Import", "Exit Preview", "Retry"), validation error messages, conflict notification text, and tooltip text — MUST be registered as i18n keys supporting translation to uk, en, and ru per Constitution Principle VI.

### Key Entities

- **SurveySchema** (existing — no structural changes): Autosave targets the existing PATCH endpoint for draft schemas. No new fields are added to the schema entity itself.
- **Schema Export Format** (new portable format): A JSON document containing `schemaVersion`, `title`, `description`, and `questions` (array of portable question definitions). This format is the contract between export and import and is independent of the database schema.

---

## Success Criteria

### Measurable Outcomes

- **SC-001**: Researchers experience zero data loss from unsaved schema edits — all changes to draft schemas are preserved automatically within the autosave debounce interval.
- **SC-002**: Researchers can preview and walk through a survey's complete user experience (all question types, conditions, progress, review step) without publishing or deploying, completing the preview cycle in under 2 minutes for a 25-question schema.
- **SC-003**: Researchers can export any schema to JSON and import it into the same or different environment, with the imported schema matching the original in question count, types, conditions, and configuration — round-trip fidelity is 100%.
- **SC-004**: 100% of import validation errors produce specific, actionable error messages that identify the exact issue (field, line, or question reference).
- **SC-005**: Autosave does not degrade editor performance — the editor remains responsive during save operations with no perceptible UI lag.
- **SC-006**: All three tools (autosave, preview, export/import) work correctly with schemas using the full range of question types and features from 018 and 019 (free text, numeric, date/time, rating scale, conditional visibility, risk flags).

---

## Out of Scope

- Batch import of multiple schema files in a single action
- Schema diff/merge between an imported file and an existing schema
- Export version history or archive of previously exported files
- Collaborative real-time editing (concurrent edits use last-write-wins with notification, not real-time sync)

---

## Assumptions

- The existing PATCH endpoint for draft schemas supports partial updates suitable for autosave (field-level or full-schema replacement).
- The Workbench frontend framework supports debounced autosave patterns and browser beforeunload events for unsaved change warnings.
- The survey gate rendering logic (question navigation, progress, typed controls, conditions, review step) can be reused or shared between the gate and the preview mode.
- Export/import is a client-initiated browser download/upload — no server-side file storage is required for the exported files.
- The `schemaVersion` field starts at `1` and will be incremented when breaking changes are made to the export format in future enhancements.

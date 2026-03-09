# Feature Specification: Survey Advanced Features

**Feature Branch**: `022-survey-advanced-features`
**Jira Epic**: [MTB-606](https://mentalhelpglobal.atlassian.net/browse/MTB-606)
**Created**: 2026-03-06
**Status**: Ready for Implementation
**Input**: User description: "researcher needs to see the spaces filter with all the spaces listed in chat list for review. surveys with single or multiple options question types should be able to optionally add a freetext field to any selection option with a string/number input types. survey questions can have multiple visibility conditions with AND or OR operations. Inside condition definition, when using comparison operations, have an ability to compare to multiple values. Visibility has higher priority than question requirement: meaning that invisible question is not required even if it is explicitly marked as so"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Invisible Questions Are Never Required (Priority: P1)

A researcher publishes a survey where question 3 ("Please describe your symptoms") is marked required, but it is only visible when the respondent answers "Yes" to question 2. A respondent who answers "No" to question 2 never sees question 3. The system must not block submission or raise a validation error for question 3 in this case — visibility takes precedence over the required flag.

**Why this priority**: This is a correctness issue affecting every survey that combines visibility conditions with required fields. Without this fix, respondents can be permanently blocked from completing a survey, making any conditional required question a critical bug.

**Independent Test**: Create a survey with two questions — Q1 (single-choice: Yes/No) and Q2 (free text, required, visible only if Q1 = "Yes"). Submit the survey with Q1 = "No". System must accept the submission without requiring an answer for Q2.

**Acceptance Scenarios**:

1. **Given** a survey question marked required AND having a visibility condition, **When** the condition is not met (question is hidden), **Then** the question is skipped during validation and does not block progression or submission.
2. **Given** a survey question marked required AND having a visibility condition, **When** the condition IS met (question is visible), **Then** the required validation applies normally and the respondent must answer before advancing.
3. **Given** a published survey in gate mode, **When** a respondent's answers make one or more required-but-hidden questions invisible, **Then** the survey can be submitted successfully without answers for those hidden questions.

---

### User Story 2 - Researcher Sees All Spaces in Chat Review Filter (Priority: P2)

A researcher opens the chat list in the Review section of the workbench. They need to filter conversations by space to focus their moderation work. Currently only a subset of spaces appears in the filter. The filter must show every space that exists in the system (matching the same list as the chat list itself), so no space is accidentally excluded from review.

**Why this priority**: Researchers reviewing chats cannot access conversations in spaces that don't appear in the filter dropdown, creating blind spots in moderation coverage. This is a usability and completeness issue for the core research workflow.

**Independent Test**: Log in as a researcher with access to multiple spaces. Open the Chat Review list. Verify that the space filter dropdown lists every space returned by the chat list API — none omitted.

**Acceptance Scenarios**:

1. **Given** a researcher with access to N spaces, **When** the chat review page loads, **Then** the space filter dropdown contains all N spaces (same set as chat list).
2. **Given** the researcher selects a space from the filter, **When** the filter is applied, **Then** only chats from that space are displayed.
3. **Given** new spaces are added to the system, **When** the researcher refreshes the review page, **Then** the new spaces appear in the filter without requiring a code change.

---

### User Story 3 - Multiple Visibility Conditions with AND / OR Logic (Priority: P3)

A survey designer wants to show question 4 ("Rate your pain level") only when the respondent has said they are experiencing pain AND selected "Physical" as the pain type. They configure two visibility conditions on question 4, combined with AND. Another designer needs to show a warning question when the respondent answers either "Never" OR "Rarely" to a frequency question — they configure two conditions with OR.

**Why this priority**: Single-condition visibility severely limits the expressiveness of adaptive surveys. Multi-condition support is foundational to producing clinically meaningful surveys that match real assessment instruments.

**Independent Test**: Build a survey with Q1 (Yes/No) and Q2 (single-choice). Configure Q3 to appear only when Q1 = "Yes" AND Q2 = "Option A". Verify Q3 is shown only when both conditions are met and hidden otherwise. Repeat with OR logic.

**Acceptance Scenarios**:

1. **Given** a question with two visibility conditions joined by AND, **When** both conditions are met, **Then** the question is visible; otherwise it is hidden.
2. **Given** a question with two visibility conditions joined by OR, **When** at least one condition is met, **Then** the question is visible; otherwise it is hidden.
3. **Given** a survey designer in the schema editor, **When** adding a second visibility condition to a question, **Then** they can choose whether it combines with the existing condition using AND or OR.
4. **Given** a question with multiple conditions, **When** any referenced question is hidden (and therefore unanswered), **Then** that condition evaluates to false for the purpose of visibility logic.
5. **Given** a schema with multiple conditions, **When** the schema is saved and reloaded, **Then** all conditions and their AND/OR combinator are preserved exactly.

---

### User Story 4 - Compare Against Multiple Values in a Condition (Priority: P4)

A designer wants to show a follow-up question whenever the respondent selects "Anxious", "Depressed", or "Overwhelmed" from a mood checklist — any one of those three values triggers the follow-up. Instead of creating three separate OR conditions, the designer configures a single condition using "is one of" and enters all three values at once.

**Why this priority**: Multi-value comparison reduces condition complexity, keeps the schema editor manageable, and directly enables common patterns in clinical survey instruments.

**Independent Test**: Configure a visibility condition using "is one of" with three values. Test that selecting any one of the three values from the referenced question makes the conditional question visible; selecting a fourth value that is not in the list keeps it hidden.

**Acceptance Scenarios**:

1. **Given** a visibility condition using the "is one of" operator, **When** the designer enters multiple comma-separated or individually-added values, **Then** the condition matches if the respondent's answer equals any one of the entered values.
2. **Given** a visibility condition using the "not equals" or "not one of" operator, **When** multiple values are entered, **Then** the condition matches only when the answer is none of the entered values.
3. **Given** a condition with multiple comparison values, **When** the schema is saved and reloaded, **Then** all values are preserved.
4. **Given** a respondent answers a question, **When** their answer matches any value in a multi-value condition, **Then** the dependent question becomes visible in real time without requiring form submission.

---

### User Story 5 - Freetext Input Attached to a Choice Option (Priority: P5)

A survey includes a single-choice question "How did you hear about us?" with options: "Friend", "Social media", "Advertisement", "Other". The designer marks the "Other" option as having a freetext field. When a respondent selects "Other", a text input appears inline for them to type a custom answer. The freetext value is captured alongside the selected option and stored as part of the answer.

A second survey uses a multi-choice question "Which symptoms do you experience?" with an "Other" option that also has a freetext field accepting only numbers (severity level 1–10).

**Why this priority**: Freetext-on-option ("Other, please specify") is a universally expected survey capability that cannot currently be achieved without a separate free-text question, which disrupts survey flow.

**Independent Test**: Create a single-choice question with one option marked as freetext (string type). Select that option in preview mode. Verify the text input appears and its value is included in the submitted answer.

**Acceptance Scenarios**:

1. **Given** a choice question with a freetext-enabled option, **When** a respondent selects that option, **Then** a text input appears immediately below or alongside the option label for the respondent to enter additional text.
2. **Given** a freetext option configured as "number" type, **When** the respondent types non-numeric input, **Then** the input is rejected or flagged with a validation error.
3. **Given** a respondent selects a freetext option and types a value, **When** the survey answer is submitted, **Then** the stored answer includes both the option label and the freetext value.
4. **Given** a multi-choice question with multiple freetext options, **When** a respondent selects more than one freetext option, **Then** each selected freetext option shows its own input field and captures its own value independently.
5. **Given** a freetext option is required to have a value (configurable), **When** the respondent selects the option but leaves the text input blank, **Then** submission is blocked with an appropriate validation message.
6. **Given** the schema editor, **When** a designer toggles a choice option as "freetext" and sets its type (string/number), **Then** the setting is saved and persisted correctly.

---

### Edge Cases

- What happens when all questions become hidden for a respondent? The survey should allow direct submission with no answers required.
- What happens when a visibility condition references a question that was deleted from the schema? The condition must be automatically removed or flagged as invalid in the editor.
- What if a multi-value condition references options from a choice question, and those options are later edited? Values must be stored as raw strings so changes to option labels don't silently break conditions.
- What happens when a freetext option has no value entered but the option is selected and the freetext field is not explicitly required? The answer should be stored with the option label and an empty string for the freetext value.
- What if AND/OR logic is mixed across three or more conditions? Assume flat AND/OR (all conditions use the same combinator) — nested grouping is out of scope for this release.

## Requirements *(mandatory)*

### Functional Requirements

**Visibility Priority**

- **FR-001**: The system MUST treat hidden questions (whose visibility conditions are not met) as not required, regardless of their explicit required flag, in both the respondent gate flow and the workbench preview mode.
- **FR-002**: The system MUST evaluate visibility conditions before applying required-field validation at each step of the survey.

**Researcher Spaces Filter**

- **FR-003**: The spaces filter in the researcher chat review list MUST include every space accessible to the authenticated researcher — the same set of spaces used to populate the chat list.
- **FR-004**: The spaces filter MUST reflect the current list of spaces on page load; real-time sub-session updates (without reload) are out of scope for this release.

**Multiple Visibility Conditions**

- **FR-005**: A survey question MUST be able to have zero, one, or more visibility conditions.
- **FR-006**: Multiple visibility conditions on a single question MUST be combinable using either AND (all must be true) or OR (at least one must be true).
- **FR-007**: A single combinator (AND or OR) MUST apply to all conditions on a given question (flat logic; nested grouping is out of scope).
- **FR-008**: Conditions referencing a hidden question MUST evaluate to false when determining visibility.
- **FR-009**: The schema editor MUST allow adding, editing, and removing individual conditions on a question; SHOULD support reordering conditions within the list (deferred to implementation discretion).
- **FR-010**: The schema data model MUST store each question's conditions as an ordered list along with the chosen combinator.

**Multi-value Comparison**

- **FR-011**: Visibility condition operators MUST support comparing to multiple values (e.g., "is one of [A, B, C]"), not just a single value.
- **FR-012**: The "is one of" and equivalent negative operators MUST match when the respondent's answer equals any value in the configured set.
- **FR-013**: The schema editor MUST provide a UI to add or remove individual values within a multi-value condition.

**Freetext on Choice Options**

- **FR-014**: Single-choice and multi-choice question options MUST each be individually configurable to include an optional freetext input field.
- **FR-015**: The freetext input type MUST be selectable as either string (any text) or number (numeric input only).
- **FR-016**: When a freetext-enabled option is selected by a respondent, the corresponding freetext input MUST appear inline immediately.
- **FR-017**: The submitted answer for a question with a selected freetext option MUST include both the selected option identifier and the freetext value.
- **FR-018**: The freetext field MAY be marked as required (non-empty) by the schema designer; this requirement MUST only apply when the option is actively selected.

### Key Entities

- **VisibilityConditionSet**: A question's collection of conditions plus the AND/OR combinator. Replaces the previous single-condition model.
- **VisibilityCondition**: One condition: references a source question, specifies an operator, and holds one or more comparison values.
- **ChoiceOptionConfig**: Per-option configuration on single/multi-choice questions. Includes optional freetext flag and freetext input type (string | number).
- **SurveyAnswer**: The respondent's stored answer for a question. For choice questions with freetext options, includes a map of selected option → freetext value.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Respondents are never blocked from submitting a valid survey because of required fields on hidden questions — zero reported blocking incidents post-launch.
- **SC-002**: The researcher chat review spaces filter lists 100% of accessible spaces, matching the chat list count exactly.
- **SC-003**: Schema designers can configure up to 5 visibility conditions per question with AND/OR logic using the workbench editor without error.
- **SC-004**: Visibility conditions with multi-value comparisons correctly route respondents in 100% of test cases across all supported operators.
- **SC-005**: Freetext values on selected choice options are captured and retrievable in survey response exports for 100% of submissions.
- **SC-006**: Survey preview in the workbench correctly reflects visibility, freetext, and required behavior identically to the live gate mode.

## Assumptions

- All conditions on a given question share one combinator (AND or OR). Nested/grouped logic (e.g., "(A AND B) OR C") is explicitly out of scope.
- The freetext field on a choice option stores its value alongside the option in the answer payload — the schema and answer data models will need backward-compatible extensions.
- The spaces filter fix applies only to the researcher chat review list; other space dropdowns in the workbench are assumed to already work correctly.
- "Number" type freetext accepts any numeric input (integer or decimal); range validation is out of scope for this release.
- Reordering of conditions within a condition set is a nice-to-have and may be deferred to implementation discretion.

# Tasks: User & Chat Tagging for Review Filtering

**Input**: Design documents from `/specs/010-chat-review-tagging/`
**Prerequisites**: plan.md (required), spec.md (required), data-model.md, contracts/tags-api.yaml, research.md, quickstart.md

**Tests**: Not explicitly requested — test tasks omitted. E2E tests included in Polish phase per dual-target discipline.

**Organization**: Tasks grouped by user story for independent implementation and testing.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

## Path Conventions

- **Shared types**: `chat-types/src/`
- **Backend (split)**: `chat-backend/src/`
- **Frontend (split)**: `chat-frontend/src/`
- **E2E tests**: `chat-ui/tests/e2e/`
- **Monorepo**: `chat-client/` (server/, src/, src/types/, tests/e2e/)

---

## Phase 1: Setup (Shared Types)

**Purpose**: Create feature branches and publish shared type definitions that all repos depend on

- [x] T000 Create `010-chat-review-tagging` branch from `develop` in all affected repositories — run `git checkout develop && git pull && git checkout -b 010-chat-review-tagging` in chat-types/, chat-backend/, chat-frontend/, chat-ui/, and chat-client/ per Constitution IV
- [x] T001 Create tag entity types in chat-types/src/tags.ts — define TagDefinition, UserTag, SessionTag, SessionExclusion interfaces and CreateTagDefinitionInput, UpdateTagDefinitionInput input types per data-model.md Type Definitions section
- [x] T002 [P] Extend ReviewConfiguration interface in chat-types/src/reviewConfig.ts — add minMessageThreshold: number field and update DEFAULT_REVIEW_CONFIG with default value 4
- [x] T003 [P] Extend RBAC permissions in chat-types/src/rbac.ts — add TAG_MANAGE, TAG_ASSIGN_USER, TAG_ASSIGN_SESSION to REVIEW_PERMISSIONS and map to OWNER (all three), MODERATOR (assign only), GROUP_ADMIN (assign only) in ROLE_PERMISSIONS
- [x] T004 [P] Extend ReviewQueueParams in chat-types/src/review.ts — add tags?: string[] and excluded?: boolean fields to the queue query parameters interface
- [x] T005 Build and publish updated @mentalhelpglobal/chat-types package — run npm run build && npm publish in chat-types/

**Checkpoint**: Shared types published — backend and frontend repos can now install updated types.

---

## Phase 2: Foundational (Migration + Core Backend + Shared Frontend)

**Purpose**: Database schema, core tag definition service, and shared frontend components that ALL user stories depend on

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [x] T006 Create migration 015_add_tagging_system.sql in chat-backend/src/db/migrations/ — create tag_definitions, user_tags, session_tags, session_exclusions tables; add min_message_threshold column to review_configuration; seed "functional QA" and "short" tag definitions per data-model.md Migration 015 section
- [x] T007 Install updated @mentalhelpglobal/chat-types in chat-backend/ and chat-frontend/ — run npm install @mentalhelpglobal/chat-types@latest in both repos
- [x] T008 Implement tagDefinition.service.ts in chat-backend/src/services/ — CRUD operations for tag definitions with case-insensitive uniqueness validation (LOWER(name) check), category enforcement, and audit logging for create/update/delete events
- [x] T009 Implement sessionExclusion.service.ts in chat-backend/src/services/ — core exclusion evaluation engine: evaluateSession(sessionId) method that checks user-tag exclusions and short-chat exclusions, creates ExclusionRecord entries, and returns exclusion results (depends on T008 tagDefinition.service for tag lookups)
- [x] T010 Update reviewAuth.ts middleware in chat-backend/src/middleware/ — add TAG_MANAGE, TAG_ASSIGN_USER, TAG_ASSIGN_SESSION permission checks using the existing RBAC pattern
- [x] T011 Create admin.tags.ts route in chat-backend/src/routes/ — implement GET (list all), POST (create), PUT /:id (update), DELETE /:id (delete) endpoints for tag definitions per contracts/tags-api.yaml /admin/tags paths; mount under /api/admin/tags in chat-backend/src/index.ts
- [x] T012 [P] Create tagApi.ts in chat-frontend/src/services/ — API client with methods: listTagDefinitions(), createTagDefinition(), updateTagDefinition(), deleteTagDefinition(), listUserTags(), assignUserTag(), removeUserTag(), listSessionTags(), addSessionTag(), removeSessionTag(), listFilterTags()
- [x] T013 [P] Create TagBadge.tsx in chat-frontend/src/features/workbench/review/components/ — reusable tag display chip component with tag name, optional "x" remove button (shown when user has permission), color coding by category (user vs chat), and ARIA label for accessibility
- [x] T014 [P] Add tag-related i18n keys to chat-frontend/src/locales/en/review.json, chat-frontend/src/locales/uk/review.json, and chat-frontend/src/locales/ru/review.json — add tags.title, tags.filter, tags.addTag, tags.removeTag, tags.createNew, tags.noTags, tags.excluded, tags.excludedSessions, tags.exclusionReason, tags.tagManagement, tags.tagName, tags.tagDescription, tags.excludeFromReviews, tags.active, tags.inactive, tags.duplicateError, tags.assignTag, tags.unassignTag, tags.short, tags.shortDescription keys per research.md R9

**Checkpoint**: Foundation ready — tag definitions can be CRUD'd, exclusion engine exists, shared frontend components available. User story implementation can now begin.

---

## Phase 3: User Story 1 — Tag Users for Review Exclusion (Priority: P1) 🎯 MVP

**Goal**: Admins/moderators can tag users with "functional QA" and new sessions from those users are automatically excluded from the review queue.

**Independent Test**: Tag a user with "functional QA" → that user creates a chat session → verify the session does NOT appear in any reviewer's queue.

### Implementation for User Story 1

- [x] T015 [US1] Implement userTag.service.ts in chat-backend/src/services/ — assign/remove user tags with validation: tag must have category='user', tag must be active, enforce unique(user_id, tag_definition_id), require TAG_ASSIGN_USER permission, audit log assign/remove events
- [x] T016 [US1] Create admin.userTags.ts route in chat-backend/src/routes/ — implement GET /api/admin/users/:userId/tags (list user's tags), POST (assign tag by tagDefinitionId), DELETE /:tagId (remove tag) per contracts/tags-api.yaml; mount in chat-backend/src/index.ts
- [x] T017 [US1] Integrate user-tag exclusion check into sessionExclusion.service.ts in chat-backend/src/services/ — in evaluateSession(), query user_tags joined with tag_definitions WHERE exclude_from_reviews=true for the session's user_id; if match found, create session_exclusions record with reason_source='user_tag' and reason=tag name
- [x] T018 [US1] Modify reviewQueue.service.ts in chat-backend/src/services/ — update the main queue query to LEFT JOIN session_exclusions and exclude sessions that have any exclusion record by default (WHERE NOT EXISTS session_exclusions for session)
- [x] T019 [US1] Integrate sessionExclusion.evaluateSession() call into the session ingestion pipeline — locate the `processSession()` method (or equivalent entry point) in chat-backend/src/services/sessionIngestion.service.ts and call sessionExclusion.evaluateSession() when a completed chat session enters the review pipeline; if evaluation returns an exclusion (user has exclusion-eligible tag like "functional QA"), write a session_exclusions record with reason 'user_tag' and skip queue insertion (FR-001, FR-002, FR-003)
- [x] T020 [P] [US1] Create UserTagPanel.tsx in chat-frontend/src/features/workbench/review/ — user profile tag assignment panel: displays current user tags as TagBadge components with remove buttons, dropdown to select from available user-category tags, assign button; uses tagApi.listUserTags/assignUserTag/removeUserTag
- [x] T021 [US1] Add tag filter to user list — extend the existing user list endpoint (locate the admin users route, likely chat-backend/src/routes/admin.users.ts or equivalent) to accept a `tags` query parameter and JOIN user_tags + tag_definitions to filter users by assigned tag names (FR-015); update the corresponding frontend user list view to include a tag filter dropdown using TagBadge components

**Checkpoint**: User Story 1 complete — tagging a user with "functional QA" excludes their future sessions from the review queue. Existing sessions unaffected. User list filterable by tag.

---

## Phase 4: User Story 2 — Automatically Tag and Exclude Short Chats (Priority: P1)

**Goal**: Sessions with fewer than 4 user+AI messages are automatically tagged "short" and excluded from the review queue.

**Independent Test**: Create chat sessions with 1, 2, 3, 4, 5 messages → verify only sessions with ≥4 messages appear in the queue, and sessions below threshold are tagged "short".

### Implementation for User Story 2

- [x] T022 [US2] Implement short-chat detection in sessionExclusion.service.ts in chat-backend/src/services/ — in evaluateSession(), count messages WHERE role IN ('user', 'assistant') for the session, compare against review_configuration.min_message_threshold; if below threshold, look up the "short" tag definition, create a session_tags record with source='system', and create session_exclusions record with reason_source='chat_tag' and reason='short'
- [x] T023 [US2] Ensure session ingestion pipeline calls evaluateSession() for both user-tag and short-chat checks in chat-backend/src/services/reviewQueue.service.ts — verify the exclusion service runs both checks (user-tag from T017 and short-chat from T022) during ingestion, potentially creating multiple exclusion records per session
- [x] T024 [US2] Extend admin config PUT endpoint in chat-backend/src/routes/admin.reviewConfig.ts — add minMessageThreshold field to the update payload; validate ≥1; persist to review_configuration.min_message_threshold

**Checkpoint**: User Story 2 complete — short chats auto-tagged "short" and excluded. Threshold configurable by admin. Combined with US1, the queue now filters both test-user and short-chat sessions.

---

## Phase 5: User Story 3 — Filter by Tags in Chat Review Interface (Priority: P1)

**Goal**: Reviewers can filter the review queue by tags and moderators can view excluded sessions with exclusion reasons.

**Independent Test**: Populate queue with tagged and excluded sessions → apply tag filter → verify correct sessions shown/hidden. Switch to "Excluded" tab → verify excluded sessions with reasons.

### Implementation for User Story 3

- [x] T025 [US3] Create GET /api/review/tags endpoint in chat-backend/src/routes/review.queue.ts — return active tag definitions that have at least one session_tags or session_exclusions association, with session count per tag, for populating the filter dropdown
- [x] T026 [US3] Extend GET /api/review queue endpoint in chat-backend/src/routes/review.queue.ts — add tags (comma-separated) and excluded (boolean) query parameters; when excluded=true, query session_exclusions joined with sessions to return excluded sessions with reason and reason_source; when tags specified, filter sessions by session_tags matching tag names; integrate with existing filters using AND logic (FR-016)
- [x] T027 [P] [US3] Create TagFilter.tsx in chat-frontend/src/features/workbench/review/components/ — multi-select dropdown component: fetches available tags from /api/review/tags, displays checkboxes for each tag with session count, emits selected tag names on change; integrates with existing filter panel layout
- [x] T028 [P] [US3] Create ExcludedTab.tsx in chat-frontend/src/features/workbench/review/components/ — excluded sessions view: fetches sessions from /api/review?excluded=true, displays session list with exclusion reason badges (tag name + source type), supports pagination; accessible to moderators and admins per FR-017
- [x] T029 [US3] Modify ReviewQueueView.tsx in chat-frontend/src/features/workbench/review/ — integrate TagFilter component into the existing filter panel alongside status/risk/date/language filters; add "Excluded" tab to the queue tabs (Pending, Flagged, In Progress, Completed, Excluded); wire tab selection to load ExcludedTab component
- [x] T030 [US3] Modify SessionCard.tsx in chat-frontend/src/features/workbench/review/components/ — display TagBadge components for each session tag; in excluded view, also show exclusion reason badges with distinct styling
- [x] T031 [US3] Update reviewStore.ts in chat-frontend/src/stores/ — add selectedTags: string[] state, showExcluded: boolean state, setSelectedTags() and setShowExcluded() actions; update the queue fetch logic to pass tags and excluded params to the API

**Checkpoint**: User Story 3 complete — tag filter works in review queue, excluded tab shows excluded sessions with reasons. All P1 stories now complete.

---

## Phase 6: User Story 4 — Manage User Tags (Priority: P2)

**Goal**: Admins can create, edit, and delete custom tags with configurable "exclude from reviews" behavior through a dedicated management page.

**Independent Test**: Create a new tag with "exclude from reviews" enabled → assign to user → verify their sessions are excluded. Edit to disable → verify future sessions appear. Delete tag → verify cascade removal.

### Implementation for User Story 4

- [x] T032 [US4] Create TagManagementPage.tsx in chat-frontend/src/features/workbench/review/ — admin tag CRUD interface: table listing all tag definitions (name, category, description, exclude_from_reviews, active status, created_by); create form (name, description, category selector, exclude checkbox); inline edit; delete with confirmation dialog showing affected user/session counts; uses tagApi CRUD methods; protected by TAG_MANAGE permission check
- [x] T033 [US4] Register /workbench/review/tags route in chat-frontend React Router — add route entry pointing to TagManagementPage, gated by TAG_MANAGE permission; add navigation link in the workbench review sidebar/menu
- [x] T034 [US4] Add minMessageThreshold configuration field to ReviewConfigPage.tsx in chat-frontend/src/features/workbench/review/ — add a number input for the minimum message threshold (FR-006) alongside existing review configuration settings; validate ≥1; save via existing config PUT endpoint

**Checkpoint**: User Story 4 complete — admins have full tag lifecycle management and can configure the short-chat threshold.

---

## Phase 7: User Story 5 — Manage Chat Tags (Priority: P2)

**Goal**: Moderators can manually tag sessions (from predefined list or ad-hoc) and tags are visible in session detail and filterable in queue.

**Independent Test**: Moderator views session detail → selects existing tag from dropdown → tag appears. Types new tag name → ad-hoc tag created and applied. Remove tag → tag removed. Filter queue by the tag → correct sessions shown.

### Implementation for User Story 5

- [x] T035 [US5] Implement sessionTag.service.ts in chat-backend/src/services/ — add/remove session tags: addTag accepts tagDefinitionId OR tagName; if tagName provided and no matching definition exists, auto-create TagDefinition with category='chat', excludeFromReviews=false, createdBy=moderator (FR-011 ad-hoc creation); validate category='chat' for manual tags; prevent removal of system-applied tags; audit log apply/remove events
- [x] T036 [US5] Create review.sessionTags.ts route in chat-backend/src/routes/ — implement GET /api/review/sessions/:sessionId/tags (list), POST (add by tagDefinitionId or tagName with auto-creation response), DELETE /:tagId (remove, reject system tags) per contracts/tags-api.yaml; mount under /api/review/sessions in chat-backend/src/index.ts
- [x] T037 [P] [US5] Create TagInput.tsx in chat-frontend/src/features/workbench/review/components/ — combobox component: fetches chat-category tags from /api/admin/tags?category=chat, displays as filterable dropdown; text input allows typing new names; on selection or enter, calls tagApi.addSessionTag(); shows "Create new tag" option when typed text has no match; includes keyboard navigation and ARIA combobox role
- [x] T038 [US5] Modify ReviewSessionView.tsx in chat-frontend/src/features/workbench/review/ — display all session tags as TagBadge components with remove buttons (for moderators); integrate TagInput combobox for adding tags (for moderators/admins with TAG_ASSIGN_SESSION); display tags section between session header and message transcript (FR-012)

**Checkpoint**: User Story 5 complete — moderators can manage session tags through the review interface, including ad-hoc tag creation.

---

## Phase 8: Polish & Cross-Cutting Concerns

**Purpose**: Dual-target sync, E2E tests, audit logging verification, accessibility

- [x] T039 [P] Mirror all chat-types changes to chat-client/src/types/ — copy tags.ts and updated reviewConfig.ts, rbac.ts, review.ts to monorepo shared types directory
- [x] T040 [P] Mirror all chat-backend changes to chat-client/server/src/ — copy migration 015, all new services (tagDefinition, userTag, sessionTag, sessionExclusion), all new routes (admin.tags, admin.userTags, review.sessionTags), updated reviewQueue.service, reviewAuth middleware, admin.reviewConfig, index.ts route mounts
- [x] T041 [P] Mirror all chat-frontend changes to chat-client/src/ — copy tagApi.ts, all new components (TagBadge, TagFilter, TagInput, ExcludedTab, TagManagementPage, UserTagPanel), updated ReviewQueueView, ReviewSessionView, SessionCard, ReviewConfigPage, reviewStore, router config, i18n locale files
- [x] T042 [P] Create tagging.spec.ts E2E tests in chat-ui/tests/e2e/review/ — cover: admin creates tag and assigns to user (session excluded), short chat auto-excluded, moderator adds/removes session tags (including ad-hoc), tag filter returns correct results, excluded tab shows exclusion reasons, tag management page CRUD operations
- [x] T043 Mirror E2E tests to chat-client/tests/e2e/review/ — copy tagging.spec.ts from chat-ui
- [x] T044 Verify audit logging for all tag operations — confirm tag_definition create/update/delete, user_tag assign/remove, and session_tag apply/remove events are logged to audit_log table with correct target_type values ('tag_definition', 'user_tag', 'session_tag')
- [x] T045 Accessibility review for all new tag components — verify keyboard navigation for TagFilter, TagInput, TagManagementPage; verify ARIA labels on TagBadge, combobox role on TagInput; verify focus management in tag management dialogs; verify contrast ratios for tag badge colors
- [x] T046 Run quickstart.md verification checklist — execute all items in quickstart.md Verification Checklist section to confirm end-to-end feature readiness
- [x] T047 Performance validation for success criteria — write and execute targeted performance checks: SC-001 (tag-based exclusion completes in <1s for sessions with tagged users), SC-004 (tag filter response <1s with 1000+ queue items), SC-008 (session tag add/remove completes in <500ms); use database EXPLAIN ANALYZE on tag-related queries and measure API response times under realistic data volumes; document results in a performance-validation.md report

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — start immediately
- **Foundational (Phase 2)**: Depends on Phase 1 (chat-types published) — BLOCKS all user stories
- **US1 (Phase 3)**: Depends on Phase 2 — can start immediately after foundational
- **US2 (Phase 4)**: Depends on Phase 2 — can run in parallel with US1 (different services/routes)
- **US3 (Phase 5)**: Depends on Phase 2 + benefits from US1/US2 (needs excluded sessions to display, but UI can be built independently)
- **US4 (Phase 6)**: Depends on Phase 2 — can run in parallel with US1/US2/US3 (admin management page is independent)
- **US5 (Phase 7)**: Depends on Phase 2 — can run in parallel with other stories (session tagging is independent)
- **Polish (Phase 8)**: Depends on all user stories being complete

### User Story Dependencies

- **US1 (P1)**: After Foundational — no dependencies on other stories
- **US2 (P1)**: After Foundational — shares sessionExclusion.service with US1 but operates on different exclusion reasons (short-chat vs user-tag); can be implemented in parallel
- **US3 (P1)**: After Foundational — UI can be built independently; full validation requires US1+US2 to produce excluded sessions
- **US4 (P2)**: After Foundational — no dependencies on other stories (tag CRUD already exists in foundational; this adds the admin UI)
- **US5 (P2)**: After Foundational — no dependencies on other stories (session tag management is independent)

### Within Each User Story

- Backend services before routes
- Routes before frontend components that consume them
- Store updates before view components that use the store
- Shared components (TagBadge, TagFilter) built in Foundational, consumed by stories

### Parallel Opportunities

- **Phase 1**: T002, T003, T004 can run in parallel (different files in chat-types)
- **Phase 2**: T011, T012, T013, T014 can run in parallel after T006-T008 (T009 depends on T008)
- **Phase 3-7**: All user story phases can run in parallel after Foundational
- **Phase 8**: T039, T040, T041, T042 can all run in parallel

---

## Parallel Example: After Foundational Phase

```
# All user stories can start simultaneously:
Developer A: US1 — T015→T016→T017→T018→T019→T020→T021
Developer B: US2 — T022→T023→T024
Developer C: US3 — T025→T026→T027,T028→T029→T030→T031
Developer D: US4 — T032→T033→T034  |  US5 — T035→T036→T037→T038
```

---

## Implementation Strategy

### MVP First (User Stories 1 + 2 + 3)

1. Complete Phase 1: Setup (shared types)
2. Complete Phase 2: Foundational (migration + core services + shared components)
3. Complete Phase 3: US1 — Tag users for exclusion
4. Complete Phase 4: US2 — Auto-tag short chats
5. Complete Phase 5: US3 — Tag filtering in queue
6. **STOP and VALIDATE**: Test all P1 stories independently and together
7. Deploy/demo MVP

### Incremental Delivery

1. Setup + Foundational → Foundation ready
2. Add US1 → Test: tag user, verify session excluded → Deploy (MVP v1!)
3. Add US2 → Test: short chat auto-excluded → Deploy (MVP v2!)
4. Add US3 → Test: tag filter, excluded tab → Deploy (full P1!)
5. Add US4 → Test: admin tag management → Deploy (P2a)
6. Add US5 → Test: moderator session tagging → Deploy (P2b)
7. Polish → E2E tests, dual-target, accessibility → Final deploy

### Suggested MVP Scope

**US1 (Tag Users for Exclusion)** alone delivers immediate value — the team can tag QA accounts and clean up the review queue right away. US2 and US3 complete the P1 scope.

---

## Notes

- [P] tasks = different files, no dependencies on incomplete tasks in same phase
- [US#] label maps task to specific user story for traceability
- Each user story is independently completable and testable
- Commit after each task or logical group
- Stop at any checkpoint to validate story independently
- Dual-target mirroring (Phase 8) should be done after all split-repo work is verified
- No test tasks generated (not explicitly requested) — E2E tests in Phase 8 cover integration validation


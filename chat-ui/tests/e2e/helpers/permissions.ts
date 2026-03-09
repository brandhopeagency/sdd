/**
 * Role-Permission Reference for E2E Test Authors
 *
 * This module provides a lightweight reference of which workbench permissions
 * each test role has. Use this when selecting `test.use({ role })` to ensure
 * the chosen role has the permissions required by your test.
 *
 * **Canonical source**: `@mentalhelpglobal/chat-types` → `src/rbac.ts` → `ROLE_PERMISSIONS`
 *
 * ## Permission Matrix (Workbench-related)
 *
 * | Role           | WORKBENCH_ACCESS | WORKBENCH_RESEARCH | WORKBENCH_MODERATION | WORKBENCH_USER_MGMT | WORKBENCH_PRIVACY |
 * |----------------|:---:|:---:|:---:|:---:|:---:|
 * | user           |  -  |  -  |  -  |  -  |  -  |
 * | qa_specialist  |  -  |  -  |  -  |  -  |  -  |
 * | researcher     |  ✓  |  ✓  |  ✓  |  -  |  -  |
 * | moderator      |  ✓  |  ✓  |  ✓  |  ✓  |  -  |
 * | group_admin    |  ✓  |  -*  |  -  |  -  |  -  |
 * | owner          |  ✓  |  ✓  |  ✓  |  ✓  |  ✓  |
 *
 * \* group_admin has WORKBENCH_GROUP_RESEARCH (group-scoped), not global WORKBENCH_RESEARCH.
 *
 * @see specs/008-e2e-test-standards/data-model.md for the full entity reference.
 */

import type { TestRole } from '../fixtures/roles'

/**
 * Maps each test role to the workbench-related permissions it possesses.
 * Use this to verify your test's `test.use({ role })` has the permissions
 * needed for the routes and features under test.
 */
export const ROLE_WORKBENCH_PERMISSIONS: Record<TestRole, string[]> = {
  user: [],
  qa: [],
  researcher: [
    'workbench:access',
    'workbench:research',
    'workbench:moderation',
  ],
  moderator: [
    'workbench:access',
    'workbench:research',
    'workbench:moderation',
    'workbench:user_management',
  ],
  group_admin: [
    'workbench:access',
    'workbench:group_dashboard',
    'workbench:group_users',
    'workbench:group_research',
  ],
  owner: [
    'workbench:access',
    'workbench:research',
    'workbench:moderation',
    'workbench:user_management',
    'workbench:privacy',
  ],
}

/**
 * Maps route patterns to the minimum role required to access them.
 * Use this when choosing `test.use({ role })` for a test that navigates
 * to a specific workbench section.
 *
 * **Usage**:
 * ```ts
 * import { MINIMUM_ROLE_FOR_ROUTE } from '../helpers/permissions'
 * // For a test navigating to /workbench/review:
 * test.use({ role: MINIMUM_ROLE_FOR_ROUTE['/workbench/review'] })
 * ```
 */
export const MINIMUM_ROLE_FOR_ROUTE: Record<string, TestRole> = {
  '/chat': 'user',
  '/workbench': 'researcher',
  '/workbench/review': 'researcher',
  '/workbench/research': 'researcher',
  '/workbench/users': 'moderator',
  '/workbench/approvals': 'moderator',
  '/workbench/privacy': 'owner',
  '/workbench/settings': 'owner',
  '/workbench/group': 'group_admin',
}

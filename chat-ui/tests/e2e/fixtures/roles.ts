/**
 * Centralized test role configuration for E2E tests.
 *
 * Each role maps to a pre-seeded test account in the dev database.
 * See: specs/007-e2e-coverage/data-model.md for the seed SQL.
 */
export const TEST_ROLES = {
  user:        { email: 'e2e-user@test.local',        role: 'user' },
  qa:          { email: 'e2e-qa@test.local',           role: 'qa_specialist' },
  researcher:  { email: 'e2e-researcher@test.local',   role: 'researcher' },
  moderator:   { email: 'e2e-moderator@test.local',    role: 'moderator' },
  group_admin: { email: 'e2e-group-admin@test.local',  role: 'group_admin' },
  owner:       { email: 'e2e-owner@test.local',        role: 'owner' },
} as const;

export type TestRole = keyof typeof TEST_ROLES;

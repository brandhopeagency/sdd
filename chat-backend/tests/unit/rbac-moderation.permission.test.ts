/// <reference types="vitest/globals" />

import { describe, it, expect } from 'vitest'
import { Permission, ROLE_PERMISSIONS, UserRole } from '../../src/types'

describe('RBAC: moderation permission', () => {
  it('grants workbench:moderation to moderator and researcher roles', () => {
    expect(ROLE_PERMISSIONS[UserRole.RESEARCHER]).toContain(Permission.WORKBENCH_MODERATION)
    expect(ROLE_PERMISSIONS[UserRole.MODERATOR]).toContain(Permission.WORKBENCH_MODERATION)
  })

  it('owner retains full access (includes workbench:moderation)', () => {
    expect(ROLE_PERMISSIONS[UserRole.OWNER]).toContain(Permission.WORKBENCH_MODERATION)
  })
})



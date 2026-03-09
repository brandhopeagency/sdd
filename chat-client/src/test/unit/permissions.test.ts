/// <reference types="vitest/globals" />

import {
  hasAllPermissions,
  hasAnyPermission,
  hasPermission,
  getPermissionsForRole,
  canAccessWorkbench,
  canUseDebugMode,
  getRoleDisplayName,
  getRoleBadgeClass,
} from '@/utils/permissions'
import { Permission, ROLE_PERMISSIONS, UserRole } from '@/types'

describe('permissions utils', () => {
  describe('hasPermission / hasAnyPermission / hasAllPermissions', () => {
    const perms = [Permission.CHAT_ACCESS, Permission.WORKBENCH_ACCESS]

    it('hasPermission', () => {
      expect(hasPermission(perms, Permission.CHAT_ACCESS)).toBe(true)
      expect(hasPermission(perms, Permission.CHAT_DEBUG)).toBe(false)
    })

    it('hasAnyPermission', () => {
      expect(hasAnyPermission(perms, [Permission.CHAT_DEBUG, Permission.CHAT_ACCESS])).toBe(true)
      expect(hasAnyPermission(perms, [Permission.CHAT_DEBUG, Permission.DATA_VIEW_PII])).toBe(false)
      expect(hasAnyPermission(perms, [])).toBe(false)
    })

    it('hasAllPermissions', () => {
      expect(hasAllPermissions(perms, [Permission.CHAT_ACCESS, Permission.WORKBENCH_ACCESS])).toBe(true)
      expect(hasAllPermissions(perms, [Permission.CHAT_ACCESS, Permission.CHAT_DEBUG])).toBe(false)
      expect(hasAllPermissions(perms, [])).toBe(true)
    })
  })

  describe('getPermissionsForRole', () => {
    it('matches ROLE_PERMISSIONS mapping for all roles', () => {
      for (const role of Object.values(UserRole)) {
        expect(getPermissionsForRole(role)).toEqual(ROLE_PERMISSIONS[role] || [])
      }
    })
  })

  describe('canAccessWorkbench / canUseDebugMode', () => {
    it('canAccessWorkbench reflects WORKBENCH_ACCESS', () => {
      expect(canAccessWorkbench(UserRole.USER)).toBe(false)
      expect(canAccessWorkbench(UserRole.RESEARCHER)).toBe(true)
      expect(canAccessWorkbench(UserRole.MODERATOR)).toBe(true)
      expect(canAccessWorkbench(UserRole.GROUP_ADMIN)).toBe(true)
      expect(canAccessWorkbench(UserRole.OWNER)).toBe(true)
    })

    it('canUseDebugMode reflects CHAT_DEBUG', () => {
      expect(canUseDebugMode(UserRole.USER)).toBe(false)
      expect(canUseDebugMode(UserRole.QA_SPECIALIST)).toBe(true)
      expect(canUseDebugMode(UserRole.OWNER)).toBe(true)
    })
  })

  describe('getRoleDisplayName / getRoleBadgeClass', () => {
    it('returns stable display names', () => {
      expect(getRoleDisplayName(UserRole.USER)).toBe('User')
      expect(getRoleDisplayName(UserRole.QA_SPECIALIST)).toBe('QA Specialist')
      expect(getRoleDisplayName(UserRole.RESEARCHER)).toBe('Researcher')
      expect(getRoleDisplayName(UserRole.MODERATOR)).toBe('Moderator')
      expect(getRoleDisplayName(UserRole.GROUP_ADMIN)).toBe('Group Admin')
      expect(getRoleDisplayName(UserRole.OWNER)).toBe('Owner')
    })

    it('returns badge classes for roles', () => {
      expect(getRoleBadgeClass(UserRole.USER)).toBe('badge-info')
      expect(getRoleBadgeClass(UserRole.QA_SPECIALIST)).toBe('badge-warning')
      expect(getRoleBadgeClass(UserRole.RESEARCHER)).toBe('badge-success')
      expect(getRoleBadgeClass(UserRole.MODERATOR)).toBe('badge-warning')
      expect(getRoleBadgeClass(UserRole.GROUP_ADMIN)).toBe('badge-info')
      expect(getRoleBadgeClass(UserRole.OWNER)).toBe('bg-purple-100 text-purple-800')
    })
  })
})



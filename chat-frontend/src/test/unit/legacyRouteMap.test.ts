/// <reference types="vitest/globals" />

import { findLegacyRedirect, LEGACY_ROUTES } from '@/routes/legacyRouteMap';

describe('legacyRouteMap', () => {
  describe('findLegacyRedirect', () => {
    it('finds known hash-based chat route', () => {
      const result = findLegacyRedirect('/#/chat');
      expect(result).toBeDefined();
      expect(result?.target).toBe('/chat');
      expect(result?.surface).toBe('chat');
    });

    it('finds known hash-based workbench route', () => {
      const result = findLegacyRedirect('/#/workbench');
      expect(result).toBeDefined();
      expect(result?.target).toBe('/workbench');
      expect(result?.surface).toBe('workbench');
    });

    it('finds known workbench users route', () => {
      const result = findLegacyRedirect('/workbench/users');
      expect(result).toBeDefined();
      expect(result?.target).toBe('/workbench/users');
      expect(result?.surface).toBe('workbench');
    });

    it('matches sub-paths of known routes', () => {
      const result = findLegacyRedirect('/workbench/users/some-user-id');
      expect(result).toBeDefined();
      expect(result?.target).toBe('/workbench/users');
    });

    it('returns undefined for unknown routes', () => {
      expect(findLegacyRedirect('/unknown')).toBeUndefined();
      expect(findLegacyRedirect('/foo/bar')).toBeUndefined();
    });

    it('returns undefined for empty path', () => {
      expect(findLegacyRedirect('')).toBeUndefined();
    });
  });

  describe('LEGACY_ROUTES', () => {
    it('contains entries for both chat and workbench surfaces', () => {
      const chatRoutes = LEGACY_ROUTES.filter(r => r.surface === 'chat');
      const workbenchRoutes = LEGACY_ROUTES.filter(r => r.surface === 'workbench');
      expect(chatRoutes.length).toBeGreaterThan(0);
      expect(workbenchRoutes.length).toBeGreaterThan(0);
    });
  });
});

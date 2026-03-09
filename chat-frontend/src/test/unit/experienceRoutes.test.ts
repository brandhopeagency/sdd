/// <reference types="vitest/globals" />

describe('experienceRoutes', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  async function importModule() {
    return await import('@/routes/experienceRoutes');
  }

  describe('getSurface', () => {
    it('always returns "chat" (this is the chat-only app)', async () => {
      const { getSurface } = await importModule();
      expect(getSurface()).toBe('chat');
    });
  });

  describe('getSurfaceEntry', () => {
    it('returns "/chat" as the entry route', async () => {
      const { getSurfaceEntry } = await importModule();
      expect(getSurfaceEntry()).toBe('/chat');
    });
  });

  describe('SURFACE_ROUTES', () => {
    it('defines chat entry and routes', async () => {
      const { SURFACE_ROUTES } = await importModule();
      expect(SURFACE_ROUTES.chat.entry).toBe('/chat');
      expect(SURFACE_ROUTES.chat.routes).toContain('/chat');
      expect(SURFACE_ROUTES.chat.routes).toContain('/chat/:sessionId');
    });

    it('does not define workbench routes (workbench is a separate app)', async () => {
      const { SURFACE_ROUTES } = await importModule();
      expect(SURFACE_ROUTES).not.toHaveProperty('workbench');
    });
  });
});

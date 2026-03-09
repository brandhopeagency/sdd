/// <reference types="vitest/globals" />

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Request, Response } from 'express';
import { resolveSessionCreatePrincipal } from '../../src/routes/chat.sessionCreate';

function makeRes() {
  const res: Partial<Response> = {};
  res.status = vi.fn(() => res as Response);
  res.json = vi.fn(() => res as Response);
  return res as Response & { status: ReturnType<typeof vi.fn>; json: ReturnType<typeof vi.fn> };
}

function makeReq(partial?: Partial<Request>) {
  return {
    body: {},
    headers: {},
    ...partial,
  } as unknown as Request;
}

describe('resolveSessionCreatePrincipal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 401 for unauthenticated UUID userId (auth refresh path)', async () => {
    const req = makeReq({
      user: undefined,
      body: {
        userId: 'e75209ef-1bfe-4535-822f-1895ccfb7caf',
        languageCode: 'en',
      },
    });
    const res = makeRes();
    const ensureGuestAllowed = vi.fn(async () => true);

    const result = await resolveSessionCreatePrincipal(req, res, ensureGuestAllowed);

    expect(result).toBeNull();
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        error: expect.objectContaining({ code: 'UNAUTHORIZED' }),
      }),
    );
    expect(ensureGuestAllowed).not.toHaveBeenCalled();
  });

  it('returns 403 for guest userId when guest mode is disabled', async () => {
    const req = makeReq({
      user: undefined,
      body: {
        userId: 'guest_123',
        languageCode: 'en',
      },
    });
    const res = makeRes();
    const ensureGuestAllowed = vi.fn(async (_req: Request, guestRes: Response) => {
      guestRes.status(403).json({
        success: false,
        error: { code: 'GUEST_DISABLED', message: 'Guest mode is disabled' },
      });
      return false;
    });

    const result = await resolveSessionCreatePrincipal(req, res, ensureGuestAllowed);

    expect(result).toBeNull();
    expect(ensureGuestAllowed).toHaveBeenCalledOnce();
    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        error: expect.objectContaining({ code: 'GUEST_DISABLED' }),
      }),
    );
  });

  it('returns principal for authenticated active user', async () => {
    const req = makeReq({
      user: { id: 'user_1' } as any,
      body: {
        languageCode: 'en',
      },
    });
    const res = makeRes();
    const ensureGuestAllowed = vi.fn(async () => true);

    const result = await resolveSessionCreatePrincipal(req, res, ensureGuestAllowed);

    expect(result).toEqual({ userId: 'user_1', languageCode: 'en' });
    expect(ensureGuestAllowed).not.toHaveBeenCalled();
    expect(res.status).not.toHaveBeenCalled();
  });
});

import type { Request, Response } from 'express';

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
}

export function classifySessionCreateUserId(
  requestUserId: unknown
): 'none' | 'guest' | 'uuid' | 'invalid' {
  if (requestUserId == null || requestUserId === '') return 'none';
  if (typeof requestUserId !== 'string') return 'invalid';
  if (requestUserId.startsWith('guest_')) return 'guest';
  if (isUuid(requestUserId)) return 'uuid';
  return 'invalid';
}

export async function resolveSessionCreatePrincipal(
  req: Request,
  res: Response,
  ensureGuestAllowed: (req: Request, res: Response) => Promise<boolean>
): Promise<{ userId: string | null; languageCode: string } | null> {
  const languageCode = req.body.languageCode || 'uk';

  // Security: Authenticated users MUST use token-verified user ID
  if (req.user?.id) {
    return { userId: req.user.id, languageCode };
  }

  const requestUserId = req.body.userId;
  const requestType = classifySessionCreateUserId(requestUserId);

  // For stale/expired token flows where UI still knows real user ID, force auth retry path.
  if (requestType === 'uuid') {
    res.status(401).json({
      success: false,
      error: { code: 'UNAUTHORIZED', message: 'Authentication required' }
    });
    return null;
  }

  if (requestType === 'invalid') {
    res.status(400).json({
      success: false,
      error: 'Invalid userId format. Guest sessions must use IDs starting with "guest_"'
    });
    return null;
  }

  // True guest requests (or no userId) still depend on guest mode setting.
  if (!(await ensureGuestAllowed(req, res))) {
    return null;
  }

  if (requestType === 'guest') {
    return { userId: requestUserId, languageCode };
  }

  return { userId: null, languageCode };
}

/// <reference types="vitest/globals" />

import { describe, it, expect, vi, beforeEach } from 'vitest'
import express, { Request, Response, NextFunction } from 'express'
import request from 'supertest'
import { Permission } from '../../src/types'

// ── Helpers ──

/** Stub router that returns 200 { route } for any request */
function stubRouter(routeName: string) {
  const router = express.Router()
  router.all('/', (_req: Request, res: Response) => {
    res.json({ route: routeName })
  })
  router.all('/{*rest}', (_req: Request, res: Response) => {
    res.json({ route: routeName })
  })
  return router
}

/**
 * Fake authenticate middleware that sets req.user from an x-test-user header.
 * Pass JSON-encoded user via the header; if missing the request continues
 * without user (simulating unauthenticated state).
 */
function fakeAuthenticate(req: Request, _res: Response, next: NextFunction) {
  const header = req.headers['x-test-user'] as string | undefined
  if (header) {
    try { (req as any).user = JSON.parse(header) } catch { /* keep undefined */ }
  }
  next()
}

/** Fake requireActiveAccount — passes through for tests */
function fakeRequireActiveAccount(_req: Request, _res: Response, next: NextFunction) {
  next()
}

/**
 * Build a minimal Express app that replicates the surface-aware route
 * mounting logic from src/index.ts, including the real middleware chain:
 *   authenticate → requireActiveAccount → workbenchGuard → router
 */
function buildApp(surface: string | undefined) {
  const app = express()
  app.use(express.json())

  // X-Service-Surface header (Task 4)
  app.use((_req: Request, res: Response, next: NextFunction) => {
    res.setHeader('X-Service-Surface', surface || 'all')
    next()
  })

  // Health is always mounted
  app.get('/api/health', (_req: Request, res: Response) => {
    res.json({ status: 'ok' })
  })

  // Auth & settings are always mounted
  app.use('/api/auth', stubRouter('auth'))
  app.use('/api/settings', stubRouter('settings'))

  const mountChat = !surface || surface === 'chat'
  const mountWorkbench = !surface || surface === 'workbench'

  if (mountChat) {
    app.use('/api/chat', stubRouter('chat'))
  }

  if (mountWorkbench) {
    // Mirror real index.ts: authenticate → requireActiveAccount → workbenchGuard
    app.use('/api/admin', fakeAuthenticate, fakeRequireActiveAccount, workbenchGuard)
    app.use('/api/group', fakeAuthenticate, fakeRequireActiveAccount, workbenchGuard)
    app.use('/api/review', fakeAuthenticate, fakeRequireActiveAccount, workbenchGuard)

    app.use('/api/admin/users', stubRouter('admin.users'))
    app.use('/api/admin/groups', stubRouter('admin.groups'))
    app.use('/api/group', stubRouter('group'))
    app.use('/api/review', stubRouter('review'))
  }

  return app
}

// ── workbenchGuard (standalone, mirrors src/middleware/workbenchGuard.ts) ──

import { workbenchGuard } from '../../src/middleware/workbenchGuard'

function makeRes() {
  const res: Partial<Response> = {}
  res.status = vi.fn(() => res as Response)
  res.json = vi.fn(() => res as Response)
  res.setHeader = vi.fn(() => res as Response)
  return res as Response & { status: any; json: any }
}

function makeReq(partial?: Partial<Request>) {
  return {
    headers: {},
    socket: { remoteAddress: '10.0.0.1' },
    ...partial,
  } as unknown as Request
}

// ── Tests ──

describe('surface-aware routing', () => {
  // Helper: JSON user header for authenticated workbench requests
  const workbenchUser = JSON.stringify({
    id: 'u1',
    permissions: [Permission.WORKBENCH_ACCESS],
  })

  describe('SERVICE_SURFACE undefined (all routes mounted)', () => {
    const app = buildApp(undefined)

    it('health endpoint is accessible', async () => {
      const res = await request(app).get('/api/health')
      expect(res.status).toBe(200)
      expect(res.body.status).toBe('ok')
    })

    it('auth routes are accessible', async () => {
      const res = await request(app).get('/api/auth/test')
      expect(res.status).toBe(200)
      expect(res.body.route).toBe('auth')
    })

    it('settings routes are accessible', async () => {
      const res = await request(app).get('/api/settings/test')
      expect(res.status).toBe(200)
      expect(res.body.route).toBe('settings')
    })

    it('chat routes are accessible', async () => {
      const res = await request(app).get('/api/chat/message')
      expect(res.status).toBe(200)
      expect(res.body.route).toBe('chat')
    })

    it('admin routes are accessible with workbench user', async () => {
      const res = await request(app)
        .get('/api/admin/users')
        .set('x-test-user', workbenchUser)
      expect(res.status).toBe(200)
      expect(res.body.route).toBe('admin.users')
    })

    it('group routes are accessible with workbench user', async () => {
      const res = await request(app)
        .get('/api/group/test')
        .set('x-test-user', workbenchUser)
      expect(res.status).toBe(200)
      expect(res.body.route).toBe('group')
    })

    it('review routes are accessible with workbench user', async () => {
      const res = await request(app)
        .get('/api/review/test')
        .set('x-test-user', workbenchUser)
      expect(res.status).toBe(200)
      expect(res.body.route).toBe('review')
    })

    it('returns X-Service-Surface: all header', async () => {
      const res = await request(app).get('/api/health')
      expect(res.headers['x-service-surface']).toBe('all')
    })
  })

  describe('SERVICE_SURFACE = "chat"', () => {
    const app = buildApp('chat')

    it('chat routes are accessible', async () => {
      const res = await request(app).get('/api/chat/message')
      expect(res.status).toBe(200)
      expect(res.body.route).toBe('chat')
    })

    it('auth routes are accessible', async () => {
      const res = await request(app).get('/api/auth/login')
      expect(res.status).toBe(200)
      expect(res.body.route).toBe('auth')
    })

    it('settings routes are accessible', async () => {
      const res = await request(app).get('/api/settings')
      expect(res.status).toBe(200)
      expect(res.body.route).toBe('settings')
    })

    it('health endpoint is accessible', async () => {
      const res = await request(app).get('/api/health')
      expect(res.status).toBe(200)
    })

    it('admin routes return 404', async () => {
      const res = await request(app).get('/api/admin/users')
      expect(res.status).toBe(404)
    })

    it('group routes return 404', async () => {
      const res = await request(app).get('/api/group/test')
      expect(res.status).toBe(404)
    })

    it('review routes return 404', async () => {
      const res = await request(app).get('/api/review/test')
      expect(res.status).toBe(404)
    })

    it('returns X-Service-Surface: chat header', async () => {
      const res = await request(app).get('/api/health')
      expect(res.headers['x-service-surface']).toBe('chat')
    })
  })

  describe('SERVICE_SURFACE = "workbench"', () => {
    const app = buildApp('workbench')

    it('admin routes are accessible with workbench user', async () => {
      const res = await request(app)
        .get('/api/admin/users')
        .set('x-test-user', workbenchUser)
      expect(res.status).toBe(200)
      expect(res.body.route).toBe('admin.users')
    })

    it('group routes are accessible with workbench user', async () => {
      const res = await request(app)
        .get('/api/group/test')
        .set('x-test-user', workbenchUser)
      expect(res.status).toBe(200)
      expect(res.body.route).toBe('group')
    })

    it('review routes are accessible with workbench user', async () => {
      const res = await request(app)
        .get('/api/review/test')
        .set('x-test-user', workbenchUser)
      expect(res.status).toBe(200)
      expect(res.body.route).toBe('review')
    })

    it('admin routes reject user without WORKBENCH_ACCESS', async () => {
      const chatOnlyUser = JSON.stringify({
        id: 'u2',
        permissions: [Permission.CHAT_SEND_MESSAGE],
      })
      const res = await request(app)
        .get('/api/admin/users')
        .set('x-test-user', chatOnlyUser)
      expect(res.status).toBe(403)
      expect(res.body.error.code).toBe('FORBIDDEN')
    })

    it('admin routes reject unauthenticated requests', async () => {
      const res = await request(app).get('/api/admin/users')
      expect(res.status).toBe(401)
      expect(res.body.error.code).toBe('UNAUTHORIZED')
    })

    it('auth routes are accessible', async () => {
      const res = await request(app).get('/api/auth/login')
      expect(res.status).toBe(200)
      expect(res.body.route).toBe('auth')
    })

    it('settings routes are accessible', async () => {
      const res = await request(app).get('/api/settings')
      expect(res.status).toBe(200)
      expect(res.body.route).toBe('settings')
    })

    it('health endpoint is accessible', async () => {
      const res = await request(app).get('/api/health')
      expect(res.status).toBe(200)
    })

    it('chat routes return 404', async () => {
      const res = await request(app).get('/api/chat/message')
      expect(res.status).toBe(404)
    })

    it('returns X-Service-Surface: workbench header', async () => {
      const res = await request(app).get('/api/health')
      expect(res.headers['x-service-surface']).toBe('workbench')
    })
  })
})

describe('workbenchGuard middleware', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns 401 when user is not authenticated', () => {
    const req = makeReq({ user: undefined })
    const res = makeRes()
    const next = vi.fn() as unknown as NextFunction

    workbenchGuard(req, res, next)

    expect(res.status).toHaveBeenCalledWith(401)
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        error: expect.objectContaining({ code: 'UNAUTHORIZED' }),
      }),
    )
    expect(next).not.toHaveBeenCalled()
  })

  it('returns 403 when user lacks WORKBENCH_ACCESS permission', () => {
    const req = makeReq({
      user: {
        id: 'u1',
        permissions: [Permission.CHAT_SEND_MESSAGE],
      } as any,
    })
    const res = makeRes()
    const next = vi.fn() as unknown as NextFunction

    workbenchGuard(req, res, next)

    expect(res.status).toHaveBeenCalledWith(403)
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        error: expect.objectContaining({ code: 'FORBIDDEN' }),
      }),
    )
    expect(next).not.toHaveBeenCalled()
  })

  it('calls next when user has WORKBENCH_ACCESS permission', () => {
    const req = makeReq({
      user: {
        id: 'u1',
        permissions: [Permission.WORKBENCH_ACCESS],
      } as any,
    })
    const res = makeRes()
    const next = vi.fn() as unknown as NextFunction

    workbenchGuard(req, res, next)

    expect(next).toHaveBeenCalled()
    expect(res.status).not.toHaveBeenCalled()
  })

  it('calls next when user has WORKBENCH_ACCESS among other permissions', () => {
    const req = makeReq({
      user: {
        id: 'u1',
        permissions: [
          Permission.CHAT_SEND_MESSAGE,
          Permission.WORKBENCH_ACCESS,
          Permission.WORKBENCH_PRIVACY,
        ],
      } as any,
    })
    const res = makeRes()
    const next = vi.fn() as unknown as NextFunction

    workbenchGuard(req, res, next)

    expect(next).toHaveBeenCalled()
  })

  it('integrated: guard blocks unauthenticated requests on admin routes', async () => {
    const app = express()
    app.use(express.json())
    app.use('/api/admin', fakeAuthenticate, fakeRequireActiveAccount, workbenchGuard)
    app.use('/api/admin/users', stubRouter('admin.users'))

    // No x-test-user header → unauthenticated
    const res = await request(app).get('/api/admin/users')
    expect(res.status).toBe(401)
  })

  it('integrated: guard permits authenticated user with WORKBENCH_ACCESS', async () => {
    const app = express()
    app.use(express.json())
    app.use('/api/admin', fakeAuthenticate, fakeRequireActiveAccount, workbenchGuard)
    app.use('/api/admin/users', stubRouter('admin.users'))

    const res = await request(app)
      .get('/api/admin/users')
      .set('x-test-user', JSON.stringify({ id: 'u1', permissions: [Permission.WORKBENCH_ACCESS] }))
    expect(res.status).toBe(200)
    expect(res.body.route).toBe('admin.users')
  })

  it('integrated: guard blocks user without WORKBENCH_ACCESS with 403', async () => {
    const app = express()
    app.use(express.json())
    app.use('/api/admin', fakeAuthenticate, fakeRequireActiveAccount, workbenchGuard)
    app.use('/api/admin/users', stubRouter('admin.users'))

    const res = await request(app)
      .get('/api/admin/users')
      .set('x-test-user', JSON.stringify({ id: 'u2', permissions: [Permission.CHAT_SEND_MESSAGE] }))
    expect(res.status).toBe(403)
    expect(res.body.error.code).toBe('FORBIDDEN')
  })
})

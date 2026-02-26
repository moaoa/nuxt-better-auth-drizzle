import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock authClient
const { mockUseSession } = vi.hoisted(() => ({
  mockUseSession: vi.fn(),
}))

vi.mock('~~/lib/auth-client', () => ({
  authClient: {
    useSession: mockUseSession,
  },
}))

// Track navigateTo calls
;(globalThis as any).navigateTo = (path: string) => ({ redirect: path })
;(globalThis as any).defineNuxtRouteMiddleware = (fn: Function) => fn

import adminMiddleware from '~/middleware/02.admin.global'

describe('Admin Middleware (02.admin.global.ts)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('non-admin user', () => {
    beforeEach(() => {
      mockUseSession.mockResolvedValue({
        data: ref({
          user: { id: '1', name: 'Regular User', email: 'user@example.com', role: 'user' },
          session: { id: 'session-1' },
        }),
      })
    })

    it('redirects to /app when navigating to /app/admin', async () => {
      const result = await (adminMiddleware as Function)({ path: '/app/admin' })

      expect(result).toEqual({ redirect: '/app' })
    })

    it('redirects to /app when navigating to /app/admin/users', async () => {
      const result = await (adminMiddleware as Function)({ path: '/app/admin/users' })

      expect(result).toEqual({ redirect: '/app' })
    })

    it('redirects to /app when navigating to /app/admin/settings', async () => {
      const result = await (adminMiddleware as Function)({ path: '/app/admin/settings' })

      expect(result).toEqual({ redirect: '/app' })
    })

    it('does not redirect when navigating to /app', async () => {
      const result = await (adminMiddleware as Function)({ path: '/app' })

      expect(result).toBeUndefined()
    })

    it('does not redirect when navigating to /app/dialer', async () => {
      const result = await (adminMiddleware as Function)({ path: '/app/dialer' })

      expect(result).toBeUndefined()
    })

    it('does not redirect when navigating to /app/wallet', async () => {
      const result = await (adminMiddleware as Function)({ path: '/app/wallet' })

      expect(result).toBeUndefined()
    })
  })

  describe('admin user', () => {
    beforeEach(() => {
      mockUseSession.mockResolvedValue({
        data: ref({
          user: { id: '1', name: 'Admin User', email: 'admin@example.com', role: 'admin' },
          session: { id: 'session-1' },
        }),
      })
    })

    it('allows access to /app/admin', async () => {
      const result = await (adminMiddleware as Function)({ path: '/app/admin' })

      expect(result).toBeUndefined()
    })

    it('allows access to /app/admin/users', async () => {
      const result = await (adminMiddleware as Function)({ path: '/app/admin/users' })

      expect(result).toBeUndefined()
    })

    it('allows access to /app/admin/settings', async () => {
      const result = await (adminMiddleware as Function)({ path: '/app/admin/settings' })

      expect(result).toBeUndefined()
    })

    it('allows access to regular /app routes', async () => {
      const result = await (adminMiddleware as Function)({ path: '/app/dialer' })

      expect(result).toBeUndefined()
    })
  })

  describe('unauthenticated user', () => {
    beforeEach(() => {
      mockUseSession.mockResolvedValue({
        data: ref(null),
      })
    })

    it('redirects to /app when navigating to /app/admin (no user data)', async () => {
      const result = await (adminMiddleware as Function)({ path: '/app/admin' })

      expect(result).toEqual({ redirect: '/app' })
    })

    it('does not redirect when navigating to /app', async () => {
      const result = await (adminMiddleware as Function)({ path: '/app' })

      expect(result).toBeUndefined()
    })
  })
})

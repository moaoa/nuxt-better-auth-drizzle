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
const navigateToResults: string[] = []
;(globalThis as any).navigateTo = (path: string) => {
  navigateToResults.push(path)
  return { redirect: path }
}

// defineNuxtRouteMiddleware just returns the function
;(globalThis as any).defineNuxtRouteMiddleware = (fn: Function) => fn

import authMiddleware from '~/middleware/00.auth.global'

describe('Auth Middleware (00.auth.global.ts)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    navigateToResults.length = 0
  })

  describe('unauthenticated user', () => {
    beforeEach(() => {
      mockUseSession.mockResolvedValue({
        data: ref(null),
      })
    })

    it('redirects to /login when navigating to /app', async () => {
      const result = await (authMiddleware as Function)({ path: '/app' })

      expect(result).toEqual({ redirect: '/login' })
    })

    it('redirects to /login when navigating to /app/dialer', async () => {
      const result = await (authMiddleware as Function)({ path: '/app/dialer' })

      expect(result).toEqual({ redirect: '/login' })
    })

    it('redirects to /login when navigating to /app/wallet', async () => {
      const result = await (authMiddleware as Function)({ path: '/app/wallet' })

      expect(result).toEqual({ redirect: '/login' })
    })

    it('redirects to /login when navigating to /dashboard', async () => {
      const result = await (authMiddleware as Function)({ path: '/dashboard' })

      expect(result).toEqual({ redirect: '/login' })
    })

    it('does not redirect when navigating to /login', async () => {
      const result = await (authMiddleware as Function)({ path: '/login' })

      expect(result).toBeUndefined()
    })

    it('does not redirect when navigating to /register', async () => {
      const result = await (authMiddleware as Function)({ path: '/register' })

      expect(result).toBeUndefined()
    })

    it('does not redirect when navigating to public routes', async () => {
      const result = await (authMiddleware as Function)({ path: '/' })

      expect(result).toBeUndefined()
    })

    it('does not redirect when navigating to /tools', async () => {
      const result = await (authMiddleware as Function)({ path: '/tools/phone-number-formatter' })

      expect(result).toBeUndefined()
    })
  })

  describe('authenticated user', () => {
    beforeEach(() => {
      mockUseSession.mockResolvedValue({
        data: ref({
          user: { id: '1', name: 'Test User', email: 'test@example.com', role: 'user' },
          session: { id: 'session-1' },
        }),
      })
    })

    it('redirects to /app when navigating to /login', async () => {
      const result = await (authMiddleware as Function)({ path: '/login' })

      expect(result).toEqual({ redirect: '/app' })
    })

    it('redirects to /app when navigating to /register', async () => {
      const result = await (authMiddleware as Function)({ path: '/register' })

      expect(result).toEqual({ redirect: '/app' })
    })

    it('does not redirect when navigating to /app', async () => {
      const result = await (authMiddleware as Function)({ path: '/app' })

      expect(result).toBeUndefined()
    })

    it('does not redirect when navigating to /app/dialer', async () => {
      const result = await (authMiddleware as Function)({ path: '/app/dialer' })

      expect(result).toBeUndefined()
    })

    it('does not redirect when navigating to /app/wallet', async () => {
      const result = await (authMiddleware as Function)({ path: '/app/wallet' })

      expect(result).toBeUndefined()
    })

    it('does not redirect when navigating to /', async () => {
      const result = await (authMiddleware as Function)({ path: '/' })

      expect(result).toBeUndefined()
    })
  })
})

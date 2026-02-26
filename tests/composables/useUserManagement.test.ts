import { describe, it, expect, vi, beforeEach } from 'vitest'

// Use vi.hoisted so mock fns are available before vi.mock factory runs
const {
  mockToast,
  mockListUsers,
  mockCreateUser,
  mockRemoveUser,
  mockSetRole,
  mockImpersonateUser,
  mockBanUser,
  mockUnbanUser,
} = vi.hoisted(() => ({
  mockToast: vi.fn(),
  mockListUsers: vi.fn(),
  mockCreateUser: vi.fn(),
  mockRemoveUser: vi.fn(),
  mockSetRole: vi.fn(),
  mockImpersonateUser: vi.fn(),
  mockBanUser: vi.fn(),
  mockUnbanUser: vi.fn(),
}))

vi.mock('~/components/ui/toast', () => ({
  useToast: () => ({ toast: mockToast }),
}))

vi.mock('~~/lib/auth-client', () => ({
  authClient: {
    admin: {
      listUsers: (...args: any[]) => mockListUsers(...args),
      createUser: (...args: any[]) => mockCreateUser(...args),
      removeUser: (...args: any[]) => mockRemoveUser(...args),
      setRole: (...args: any[]) => mockSetRole(...args),
      impersonateUser: (...args: any[]) => mockImpersonateUser(...args),
      banUser: (...args: any[]) => mockBanUser(...args),
      unbanUser: (...args: any[]) => mockUnbanUser(...args),
    },
  },
}))

import { useUserManagement } from '~/composables/useUserManagement'

describe('useUserManagement', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns expected properties', () => {
    const result = useUserManagement()

    expect(result).toHaveProperty('users')
    expect(result).toHaveProperty('isLoading')
    expect(result).toHaveProperty('error')
    expect(result).toHaveProperty('fetchUsers')
    expect(result).toHaveProperty('deleteUser')
    expect(result).toHaveProperty('updateUserRole')
    expect(result).toHaveProperty('updateUserBan')
    expect(result).toHaveProperty('createUserAsAdmin')
    expect(result).toHaveProperty('impersonateUser')
  })

  describe('fetchUsers', () => {
    it('fetches users successfully', async () => {
      const mockUsers = [
        { id: '1', name: 'User 1', email: 'user1@test.com' },
        { id: '2', name: 'User 2', email: 'user2@test.com' },
      ]
      mockListUsers.mockResolvedValue({ data: { users: mockUsers } })

      const { fetchUsers, users, isLoading } = useUserManagement()

      await fetchUsers()

      expect(mockListUsers).toHaveBeenCalledWith({ query: { limit: 10 } })
      expect(users.value).toEqual(mockUsers)
      expect(isLoading.value).toBe(false)
    })

    it('shows toast on fetch error', async () => {
      mockListUsers.mockRejectedValue(new Error('Network error'))

      const { fetchUsers } = useUserManagement()
      await fetchUsers()

      expect(mockToast).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'Error',
          variant: 'destructive',
        })
      )
    })

    it('sets isLoading during fetch', async () => {
      let resolvePromise: Function
      mockListUsers.mockReturnValue(
        new Promise((resolve) => {
          resolvePromise = resolve
        })
      )

      const { fetchUsers, isLoading } = useUserManagement()

      const fetchPromise = fetchUsers()
      expect(isLoading.value).toBe(true)

      resolvePromise!({ data: { users: [] } })
      await fetchPromise

      expect(isLoading.value).toBe(false)
    })
  })

  describe('createUserAsAdmin', () => {
    it('creates user and shows success toast', async () => {
      mockCreateUser.mockResolvedValue({})

      const { createUserAsAdmin } = useUserManagement()
      await createUserAsAdmin({
        name: 'New User',
        email: 'new@test.com',
        password: 'password123',
        role: 'user',
        firstName: 'New',
        lastName: 'User',
        emailVerified: false,
        banned: false,
        image: null,
      })

      expect(mockCreateUser).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'New User',
          email: 'new@test.com',
          password: 'password123',
          role: 'user',
        })
      )
      expect(mockToast).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'Success',
          description: 'User created successfully',
        })
      )
    })

    it('shows error toast on create failure', async () => {
      mockCreateUser.mockRejectedValue(new Error('Create failed'))

      const { createUserAsAdmin } = useUserManagement()
      await createUserAsAdmin({
        name: 'New User',
        email: 'new@test.com',
        password: 'password123',
        role: 'user',
        firstName: 'New',
        lastName: 'User',
        emailVerified: false,
        banned: false,
        image: null,
      })

      expect(mockToast).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'Error',
          variant: 'destructive',
        })
      )
    })
  })

  describe('deleteUser', () => {
    it('deletes user and shows success toast', async () => {
      mockRemoveUser.mockResolvedValue({})

      const { deleteUser } = useUserManagement()
      await deleteUser('user-123')

      expect(mockRemoveUser).toHaveBeenCalledWith({ userId: 'user-123' })
      expect(mockToast).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'Success',
          description: 'User deleted successfully',
        })
      )
    })

    it('shows error toast on delete failure', async () => {
      mockRemoveUser.mockRejectedValue(new Error('Delete failed'))

      const { deleteUser } = useUserManagement()
      await deleteUser('user-123')

      expect(mockToast).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'Error',
          variant: 'destructive',
        })
      )
    })
  })

  describe('updateUserRole', () => {
    it('updates role and shows success toast', async () => {
      mockSetRole.mockResolvedValue({})

      const { updateUserRole } = useUserManagement()
      await updateUserRole('user-123', 'admin')

      expect(mockSetRole).toHaveBeenCalledWith({
        userId: 'user-123',
        role: 'admin',
      })
      expect(mockToast).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'Success',
          description: 'Updated user role successfully',
        })
      )
    })

    it('shows error toast on role update failure', async () => {
      mockSetRole.mockRejectedValue(new Error('Update failed'))

      const { updateUserRole } = useUserManagement()
      await updateUserRole('user-123', 'admin')

      expect(mockToast).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'Error',
          variant: 'destructive',
        })
      )
    })
  })

  describe('updateUserBan', () => {
    it('bans user when banUser is true', async () => {
      mockBanUser.mockResolvedValue({})

      const { updateUserBan } = useUserManagement()
      await updateUserBan('user-123', true)

      expect(mockBanUser).toHaveBeenCalledWith({ userId: 'user-123' })
      expect(mockUnbanUser).not.toHaveBeenCalled()
      expect(mockToast).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'Success',
        })
      )
    })

    it('unbans user when banUser is false', async () => {
      mockUnbanUser.mockResolvedValue({})

      const { updateUserBan } = useUserManagement()
      await updateUserBan('user-123', false)

      expect(mockUnbanUser).toHaveBeenCalledWith({ userId: 'user-123' })
      expect(mockBanUser).not.toHaveBeenCalled()
      expect(mockToast).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'Success',
        })
      )
    })

    it('shows error toast on ban failure', async () => {
      mockBanUser.mockRejectedValue(new Error('Ban failed'))

      const { updateUserBan } = useUserManagement()
      await updateUserBan('user-123', true)

      expect(mockToast).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'Error',
          variant: 'destructive',
        })
      )
    })
  })

  describe('impersonateUser', () => {
    it('impersonates user successfully', async () => {
      mockImpersonateUser.mockResolvedValue({})

      const { impersonateUser } = useUserManagement()
      await impersonateUser('user-123')

      expect(mockImpersonateUser).toHaveBeenCalledWith({ userId: 'user-123' })
    })

    it('shows error toast on impersonation failure', async () => {
      mockImpersonateUser.mockRejectedValue(new Error('Impersonation failed'))

      const { impersonateUser } = useUserManagement()
      await impersonateUser('user-123')

      expect(mockToast).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'Error',
          variant: 'destructive',
        })
      )
    })
  })
})

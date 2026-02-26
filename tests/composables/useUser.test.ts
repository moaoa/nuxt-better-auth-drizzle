import { describe, it, expect, beforeEach } from 'vitest'
import { ref } from 'vue'
import { useUser } from '~/composables/useUser'

// Mock the User type
interface MockUser {
  id: string
  name: string
  email: string
  emailVerified: boolean
  image: string | null
  createdAt: Date
  updatedAt: Date
  role: string | null
  banned: boolean | null
  banReason: string | null
  banExpires: Date | null
  firstName: string
  lastName: string
}

const createMockUser = (overrides: Partial<MockUser> = {}): MockUser => ({
  id: '1',
  name: 'John Doe',
  email: 'john@example.com',
  emailVerified: true,
  image: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  role: 'user',
  banned: false,
  banReason: null,
  banExpires: null,
  firstName: 'John',
  lastName: 'Doe',
  ...overrides,
})

describe('useUser', () => {
  beforeEach(() => {
    // Reset state before each test by closing all modals
    const { closeEditUser, closeDeleteUser, closeCreateUser } = useUser()
    closeEditUser()
    closeDeleteUser()
    closeCreateUser()
  })

  it('returns all expected properties', () => {
    const result = useUser()

    expect(result).toHaveProperty('isEditOpen')
    expect(result).toHaveProperty('isDeleteOpen')
    expect(result).toHaveProperty('isLoading')
    expect(result).toHaveProperty('userToEdit')
    expect(result).toHaveProperty('openEditUser')
    expect(result).toHaveProperty('closeEditUser')
    expect(result).toHaveProperty('openDeleteUser')
    expect(result).toHaveProperty('closeDeleteUser')
    expect(result).toHaveProperty('openAddUser')
    expect(result).toHaveProperty('isCreateOpen')
    expect(result).toHaveProperty('closeCreateUser')
  })

  it('starts with all modals closed', () => {
    const { isEditOpen, isDeleteOpen, isCreateOpen, userToEdit } = useUser()

    expect(isEditOpen.value).toBe(false)
    expect(isDeleteOpen.value).toBe(false)
    expect(isCreateOpen.value).toBe(false)
    expect(userToEdit.value).toBeNull()
  })

  describe('openEditUser', () => {
    it('opens edit modal and sets user to edit', () => {
      const { openEditUser, isEditOpen, userToEdit } = useUser()
      const mockUser = createMockUser()

      openEditUser(mockUser as any)

      expect(isEditOpen.value).toBe(true)
      expect(userToEdit.value).toEqual(mockUser)
    })

    it('closes other modals when opening edit', () => {
      const { openAddUser, openEditUser, isCreateOpen, isEditOpen, isDeleteOpen } = useUser()

      // First open create modal
      openAddUser()
      expect(isCreateOpen.value).toBe(true)

      // Opening edit should close create
      openEditUser(createMockUser() as any)
      expect(isEditOpen.value).toBe(true)
      expect(isCreateOpen.value).toBe(false)
      expect(isDeleteOpen.value).toBe(false)
    })
  })

  describe('closeEditUser', () => {
    it('closes edit modal and clears user to edit', () => {
      const { openEditUser, closeEditUser, isEditOpen, userToEdit } = useUser()

      openEditUser(createMockUser() as any)
      expect(isEditOpen.value).toBe(true)

      closeEditUser()
      expect(isEditOpen.value).toBe(false)
      expect(userToEdit.value).toBeNull()
    })
  })

  describe('openDeleteUser', () => {
    it('opens delete modal', () => {
      const { openDeleteUser, isDeleteOpen } = useUser()

      openDeleteUser()
      expect(isDeleteOpen.value).toBe(true)
    })

    it('closes other modals when opening delete', () => {
      const { openEditUser, openDeleteUser, isEditOpen, isDeleteOpen, isCreateOpen } = useUser()

      openEditUser(createMockUser() as any)
      expect(isEditOpen.value).toBe(true)

      openDeleteUser()
      expect(isDeleteOpen.value).toBe(true)
      expect(isEditOpen.value).toBe(false)
      expect(isCreateOpen.value).toBe(false)
    })
  })

  describe('closeDeleteUser', () => {
    it('closes delete modal', () => {
      const { openDeleteUser, closeDeleteUser, isDeleteOpen } = useUser()

      openDeleteUser()
      expect(isDeleteOpen.value).toBe(true)

      closeDeleteUser()
      expect(isDeleteOpen.value).toBe(false)
    })
  })

  describe('openAddUser', () => {
    it('opens create modal', () => {
      const { openAddUser, isCreateOpen } = useUser()

      openAddUser()
      expect(isCreateOpen.value).toBe(true)
    })

    it('closes other modals when opening add', () => {
      const { openEditUser, openAddUser, isEditOpen, isDeleteOpen, isCreateOpen } = useUser()

      openEditUser(createMockUser() as any)
      expect(isEditOpen.value).toBe(true)

      openAddUser()
      expect(isCreateOpen.value).toBe(true)
      expect(isEditOpen.value).toBe(false)
      expect(isDeleteOpen.value).toBe(false)
    })
  })

  describe('closeCreateUser', () => {
    it('closes create modal', () => {
      const { openAddUser, closeCreateUser, isCreateOpen } = useUser()

      openAddUser()
      expect(isCreateOpen.value).toBe(true)

      closeCreateUser()
      expect(isCreateOpen.value).toBe(false)
    })
  })

  describe('only one modal open at a time', () => {
    it('ensures only one modal is open at any time', () => {
      const {
        openEditUser,
        openDeleteUser,
        openAddUser,
        isEditOpen,
        isDeleteOpen,
        isCreateOpen,
      } = useUser()

      // Open edit
      openEditUser(createMockUser() as any)
      expect(isEditOpen.value).toBe(true)
      expect(isDeleteOpen.value).toBe(false)
      expect(isCreateOpen.value).toBe(false)

      // Open delete (should close edit)
      openDeleteUser()
      expect(isEditOpen.value).toBe(false)
      expect(isDeleteOpen.value).toBe(true)
      expect(isCreateOpen.value).toBe(false)

      // Open add (should close delete)
      openAddUser()
      expect(isEditOpen.value).toBe(false)
      expect(isDeleteOpen.value).toBe(false)
      expect(isCreateOpen.value).toBe(true)
    })
  })

  describe('shared state across calls', () => {
    it('shares state between multiple useUser() calls', () => {
      const instance1 = useUser()
      const instance2 = useUser()

      instance1.openAddUser()
      expect(instance2.isCreateOpen.value).toBe(true)
    })
  })
})

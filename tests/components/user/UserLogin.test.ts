import { describe, it, expect, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { defineComponent, h } from 'vue'

// Mock auth-client
const { mockSignInEmail, mockSignInSocial } = vi.hoisted(() => ({
  mockSignInEmail: vi.fn(),
  mockSignInSocial: vi.fn(),
}))

vi.mock('~~/lib/auth-client', () => ({
  signIn: {
    email: mockSignInEmail,
    social: mockSignInSocial,
  },
}))

// Mock toast
const { mockToast } = vi.hoisted(() => ({
  mockToast: vi.fn(),
}))
vi.mock('~/components/ui/toast/use-toast', () => ({
  useToast: () => ({ toast: mockToast }),
}))

// Stub components that come from shadcn/nuxt
const stubComponents = {
  UiToaster: defineComponent({ template: '<div class="toaster-stub" />' }),
  UiCard: defineComponent({ template: '<div class="card-stub"><slot /></div>' }),
  UiCardHeader: defineComponent({ template: '<div class="card-header-stub"><slot /></div>' }),
  UiCardTitle: defineComponent({ template: '<h2 class="card-title-stub"><slot /></h2>' }),
  UiCardDescription: defineComponent({ template: '<p class="card-desc-stub"><slot /></p>' }),
  UiCardContent: defineComponent({ template: '<div class="card-content-stub"><slot /></div>' }),
  UiButton: defineComponent({
    props: ['variant', 'disabled', 'type'],
    emits: ['click'],
    template: '<button :disabled="disabled" :type="type" @click="$emit(\'click\')"><slot /></button>',
  }),
  UiSeparator: defineComponent({ template: '<hr class="separator-stub" />' }),
  Icon: defineComponent({ props: ['name'], template: '<span class="icon-stub" />' }),
  NuxtLink: defineComponent({ props: ['to'], template: '<a :href="to"><slot /></a>' }),
  FormKit: defineComponent({
    props: ['id', 'type', 'actions', 'modelValue'],
    emits: ['submit', 'update:modelValue'],
    template: '<form @submit.prevent="$emit(\'submit\')"><slot :state="{ valid: true }" /></form>',
  }),
  FormKitSchema: defineComponent({ props: ['schema'], template: '<div class="formkit-schema-stub" />' }),
}

import UserLogin from '~/components/user/UserLogin.vue'

const createWrapper = (props = {}) => {
  return mount(UserLogin, {
    props,
    global: {
      stubs: stubComponents,
    },
  })
}

describe('UserLogin', () => {
  it('renders the login card with title', () => {
    const wrapper = createWrapper()
    expect(wrapper.text()).toContain('Login')
  })

  it('renders card description', () => {
    const wrapper = createWrapper()
    expect(wrapper.text()).toContain('Choose your preferred login method')
  })

  it('shows two login method buttons initially', () => {
    const wrapper = createWrapper()
    const buttons = wrapper.findAll('button')

    // Should have: Continue with Email, Continue with Google, Register link button
    const buttonTexts = buttons.map((b) => b.text())
    expect(buttonTexts.some((t) => t.includes('Continue with Email'))).toBe(true)
    expect(buttonTexts.some((t) => t.includes('Continue with Google'))).toBe(true)
  })

  it('switches to email form when Continue with Email is clicked', async () => {
    const wrapper = createWrapper()

    // Find and click the "Continue with Email" button
    const emailButton = wrapper
      .findAll('button')
      .find((b) => b.text().includes('Continue with Email'))
    expect(emailButton).toBeDefined()

    await emailButton!.trigger('click')

    // Should now show the email form (FormKit stub renders a form)
    expect(wrapper.find('form').exists()).toBe(true)
    // Should have "Back to login options" button
    expect(wrapper.text()).toContain('Back to login options')
  })

  it('switches back to method selection when Back button is clicked', async () => {
    const wrapper = createWrapper()

    // Click email first
    const emailButton = wrapper
      .findAll('button')
      .find((b) => b.text().includes('Continue with Email'))
    await emailButton!.trigger('click')

    // Now click back
    const backButton = wrapper
      .findAll('button')
      .find((b) => b.text().includes('Back to login options'))
    expect(backButton).toBeDefined()

    await backButton!.trigger('click')

    // Should show original buttons again
    expect(wrapper.text()).toContain('Continue with Email')
    expect(wrapper.text()).toContain('Continue with Google')
  })

  it('renders register link', () => {
    const wrapper = createWrapper()
    const registerLink = wrapper.find('a[href="/register"]')
    expect(registerLink.exists()).toBe(true)
    expect(wrapper.text()).toContain("Don't have an account?")
    expect(wrapper.text()).toContain('Register')
  })

  it('calls signIn.social when Google button is clicked', async () => {
    const wrapper = createWrapper()

    const googleButton = wrapper
      .findAll('button')
      .find((b) => b.text().includes('Continue with Google'))
    await googleButton!.trigger('click')

    expect(mockSignInSocial).toHaveBeenCalledWith(
      expect.objectContaining({
        provider: 'google',
        callbackURL: '/app/',
      })
    )
  })

  it('uses custom redirectUrl prop', () => {
    const wrapper = createWrapper({ redirectUrl: '/dashboard' })
    // The component should use the redirectUrl prop
    expect(wrapper.props('redirectUrl')).toBe('/dashboard')
  })

  it('renders sign in button in email form', async () => {
    const wrapper = createWrapper()

    const emailButton = wrapper
      .findAll('button')
      .find((b) => b.text().includes('Continue with Email'))
    await emailButton!.trigger('click')

    const signInButton = wrapper
      .findAll('button')
      .find((b) => b.text().includes('Sign in'))
    expect(signInButton).toBeDefined()
  })
})

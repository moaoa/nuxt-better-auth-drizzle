import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { defineComponent, nextTick } from 'vue'

// Mock dependencies using vi.hoisted
const { mockToast } = vi.hoisted(() => ({
  mockToast: vi.fn(),
}))

vi.mock('~/components/ui/toast/use-toast', () => ({
  useToast: () => ({ toast: mockToast }),
}))

vi.mock('libphonenumber-js', () => ({
  isValidPhoneNumber: (phone: string) => {
    // Simple mock validation
    const e164Regex = /^\+[1-9]\d{6,14}$/
    return e164Regex.test(phone)
  },
}))

vi.mock('@twilio/voice-sdk', () => ({
  Device: vi.fn(),
  Call: vi.fn(),
}))

// Mock vue-query
const mockInvalidateQueries = vi.fn()
vi.mock('@tanstack/vue-query', () => ({
  useQuery: ({ queryKey }: any) => {
    if (queryKey === 'wallet' || (Array.isArray(queryKey) && queryKey[0] === 'wallet')) {
      return {
        data: ref({ balanceUsd: 50.0 }),
        isLoading: ref(false),
      }
    }
    // callRate query
    return {
      data: ref({ maxAllowedMinutes: 100, userRatePerMinUsd: 0.015 }),
      isLoading: ref(false),
      error: ref(null),
    }
  },
  useMutation: ({ mutationFn, onSuccess, onError }: any) => ({
    mutate: vi.fn(),
    isPending: ref(false),
  }),
  useQueryClient: () => ({
    invalidateQueries: mockInvalidateQueries,
  }),
}))

// Stub components
const stubComponents = {
  UiButton: defineComponent({
    props: ['variant', 'disabled', 'asChild'],
    emits: ['click'],
    template: '<button :disabled="disabled" @click="$emit(\'click\')"><slot /></button>',
  }),
  UiInput: defineComponent({
    props: ['modelValue', 'type', 'placeholder', 'disabled'],
    emits: ['update:modelValue'],
    template: '<input :value="modelValue" @input="$emit(\'update:modelValue\', $event.target.value)" :disabled="disabled" :placeholder="placeholder" />',
  }),
  Icon: defineComponent({ props: ['name'], template: '<span class="icon-stub" />' }),
  NuxtLink: defineComponent({ props: ['to'], template: '<a :href="to"><slot /></a>' }),
}

import Dialer from '~/pages/app/dialer.vue'

const createWrapper = () => {
  return mount(Dialer, {
    global: {
      stubs: stubComponents,
      mocks: {
        $fetch: vi.fn(),
      },
    },
  })
}

describe('Dialer Page', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders the page title', () => {
    const wrapper = createWrapper()
    expect(wrapper.text()).toContain('Phone Dialer')
  })

  it('renders the wallet balance', () => {
    const wrapper = createWrapper()
    expect(wrapper.text()).toContain('Balance')
    expect(wrapper.text()).toContain('$50.00')
  })

  it('renders the phone number input', () => {
    const wrapper = createWrapper()
    const input = wrapper.find('input')
    expect(input.exists()).toBe(true)
  })

  it('renders all 12 keypad buttons', () => {
    const wrapper = createWrapper()
    const buttons = wrapper.findAll('button')
    // Keypad: 1-9, +, 0, backspace = 12 keypad buttons
    // Plus: Start Call button, Manage Wallet link button
    // Total is more than 12 but at least 12 keypad buttons
    const keypadDigits = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0', '+']
    for (const digit of keypadDigits) {
      const found = buttons.filter((b) => b.text().trim() === digit)
      expect(found.length).toBeGreaterThanOrEqual(1)
    }
  })

  it('appends digit when keypad button is pressed', async () => {
    const wrapper = createWrapper()
    const input = wrapper.find('input')

    // Find button "1"
    const button1 = wrapper.findAll('button').find((b) => b.text().trim() === '1')
    await button1!.trigger('click')

    await nextTick()

    // The phone number should now include "1"
    expect((input.element as HTMLInputElement).value).toContain('1')
  })

  it('appends multiple digits', async () => {
    const wrapper = createWrapper()
    const input = wrapper.find('input')

    // Press +, 1, 2, 3
    const findButton = (text: string) =>
      wrapper.findAll('button').find((b) => b.text().trim() === text)

    await findButton('+')!.trigger('click')
    await nextTick()
    await findButton('1')!.trigger('click')
    await nextTick()
    await findButton('2')!.trigger('click')
    await nextTick()
    await findButton('3')!.trigger('click')
    await nextTick()

    expect((input.element as HTMLInputElement).value).toBe('+123')
  })

  it('disables + button when + is already in the number', async () => {
    const wrapper = createWrapper()

    const plusButton = wrapper.findAll('button').find((b) => b.text().trim() === '+')

    // First press should work
    await plusButton!.trigger('click')
    await nextTick()

    // After pressing +, the + button should be disabled
    const plusButtonAfter = wrapper.findAll('button').find((b) => b.text().trim() === '+')
    expect(plusButtonAfter!.attributes('disabled')).toBeDefined()
  })

  it('backspace removes last character', async () => {
    const wrapper = createWrapper()
    const input = wrapper.find('input')

    const findButton = (text: string) =>
      wrapper.findAll('button').find((b) => b.text().trim() === text)

    // Type +12
    await findButton('+')!.trigger('click')
    await findButton('1')!.trigger('click')
    await findButton('2')!.trigger('click')
    await nextTick()

    expect((input.element as HTMLInputElement).value).toBe('+12')

    // Find backspace button (contains Icon with lucide:delete)
    // It's the last button in the keypad grid
    const allButtons = wrapper.findAll('button')
    const backspaceButton = allButtons.find((b) => b.find('.icon-stub').exists() && !b.text().includes('Start') && !b.text().includes('End'))

    if (backspaceButton) {
      await backspaceButton.trigger('click')
      await nextTick()
      expect((input.element as HTMLInputElement).value).toBe('+1')
    }
  })

  it('shows validation hint text initially', () => {
    const wrapper = createWrapper()
    expect(wrapper.text()).toContain('Enter number in E.164 format')
  })

  it('renders Start Call button', () => {
    const wrapper = createWrapper()
    expect(wrapper.text()).toContain('Start Call')
  })

  it('renders Manage Wallet link', () => {
    const wrapper = createWrapper()
    expect(wrapper.text()).toContain('Manage Wallet')
    const walletLink = wrapper.find('a[href="/app/wallet"]')
    expect(walletLink.exists()).toBe(true)
  })

  it('Start Call button is disabled when phone is empty', () => {
    const wrapper = createWrapper()
    const startButton = wrapper
      .findAll('button')
      .find((b) => b.text().includes('Start Call'))
    expect(startButton!.attributes('disabled')).toBeDefined()
  })
})

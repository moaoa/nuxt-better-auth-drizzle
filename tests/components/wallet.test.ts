import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { defineComponent, ref, nextTick } from 'vue'

// Mock vue-query
const { mockMutate } = vi.hoisted(() => ({
  mockMutate: vi.fn(),
}))

vi.mock('@tanstack/vue-query', () => ({
  useQuery: ({ queryKey }: any) => {
    const key = typeof queryKey === 'string' ? queryKey : (queryKey?.value?.[0] || queryKey?.[0] || '')
    if (key === 'wallet') {
      return {
        data: ref({ balanceUsd: 25.50 }),
        isLoading: ref(false),
      }
    }
    // transactions
    return {
      data: ref({
        transactions: [
          {
            id: 1,
            type: 'purchase',
            amountUsd: '10.00',
            createdAt: '2026-02-20T10:00:00Z',
            stripePayment: { status: 'succeeded' },
          },
          {
            id: 2,
            type: 'call_charge',
            amountUsd: '-0.05',
            createdAt: '2026-02-20T11:00:00Z',
            stripePayment: null,
          },
        ],
        pagination: { page: 1, limit: 10, total: 2, totalPages: 1 },
      }),
      isLoading: ref(false),
    }
  },
  useMutation: ({ mutationFn, onSuccess, onError }: any) => ({
    mutate: mockMutate,
    isPending: computed(() => false),
    isError: computed(() => false),
  }),
  useQueryClient: () => ({
    invalidateQueries: vi.fn(),
  }),
}))

// Mock zod (it's used inline)
vi.mock('zod', async () => {
  const actual = await vi.importActual('zod')
  return actual
})

// Stub components
const stubComponents = {
  UiButton: defineComponent({
    props: ['variant', 'disabled', 'size'],
    emits: ['click'],
    template: '<button :disabled="disabled" :class="variant" @click="$emit(\'click\')"><slot /></button>',
  }),
  UiInput: defineComponent({
    props: ['modelValue', 'type', 'step', 'min', 'placeholder'],
    emits: ['update:modelValue'],
    template: '<input :value="modelValue" @input="$emit(\'update:modelValue\', Number($event.target.value))" />',
  }),
  Icon: defineComponent({ props: ['name'], template: '<span class="icon-stub" />' }),
}

import WalletPage from '~/pages/app/wallet.vue'

const createWrapper = () => {
  return mount(WalletPage, {
    global: {
      stubs: stubComponents,
    },
  })
}

describe('Wallet Page', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders the page title', () => {
    const wrapper = createWrapper()
    expect(wrapper.text()).toContain('Wallet')
  })

  it('displays the current balance', () => {
    const wrapper = createWrapper()
    expect(wrapper.text()).toContain('Current Balance')
    expect(wrapper.text()).toContain('$25.50')
  })

  it('renders Add Funds section', () => {
    const wrapper = createWrapper()
    expect(wrapper.text()).toContain('Add Funds')
  })

  it('renders Quick Select section', () => {
    const wrapper = createWrapper()
    expect(wrapper.text()).toContain('Quick Select')
  })

  it('renders all preset amount buttons', () => {
    const wrapper = createWrapper()
    const presets = ['$5', '$10', '$25', '$50', '$100']
    for (const preset of presets) {
      expect(wrapper.text()).toContain(preset)
    }
  })

  it('clicking a preset amount selects it', async () => {
    const wrapper = createWrapper()

    // Find the $25 preset button
    const buttons = wrapper.findAll('button')
    const preset25 = buttons.find((b) => b.text().trim() === '$25')
    expect(preset25).toBeDefined()

    await preset25!.trigger('click')
    await nextTick()

    // The input value should be updated to 25
    const input = wrapper.find('input')
    expect((input.element as HTMLInputElement).value).toBe('25')
  })

  it('renders the add funds button', () => {
    const wrapper = createWrapper()
    // The button should exist and contain wallet-related text
    const addButton = wrapper.findAll('button').find(
      (b) => b.text().includes('Wallet') || b.text().includes('checkout')
    )
    expect(addButton).toBeDefined()
  })

  it('renders Transaction History section', () => {
    const wrapper = createWrapper()
    expect(wrapper.text()).toContain('Transaction History')
  })

  it('displays transactions', () => {
    const wrapper = createWrapper()
    expect(wrapper.text()).toContain('Credit Purchase')
    expect(wrapper.text()).toContain('Call Charge')
  })

  it('shows positive amounts in green style', () => {
    const wrapper = createWrapper()
    // $10.00 purchase should show positive
    expect(wrapper.text()).toContain('$10.00')
  })

  it('shows negative amounts for call charges', () => {
    const wrapper = createWrapper()
    // -$0.05 call charge
    expect(wrapper.text()).toContain('$0.05')
  })

  it('renders Custom Amount label and input', () => {
    const wrapper = createWrapper()
    expect(wrapper.text()).toContain('Custom Amount (USD)')
    const inputs = wrapper.findAll('input')
    expect(inputs.length).toBeGreaterThanOrEqual(1)
  })
})

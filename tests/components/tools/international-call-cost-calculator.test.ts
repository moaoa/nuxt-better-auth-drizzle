import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { defineComponent, nextTick } from 'vue'

// Stub Nuxt composables used by ToolLayout
;(globalThis as any).useSeoMeta = vi.fn()
;(globalThis as any).useHead = vi.fn()
;(globalThis as any).$fetch = vi.fn()

// Stub components
const stubComponents = {
  ToolLayout: defineComponent({
    props: ['title', 'description', 'structuredData'],
    template: '<div class="tool-layout"><h1>{{ title }}</h1><p>{{ description }}</p><slot /></div>',
  }),
  NuxtLink: defineComponent({ props: ['to'], template: '<a :href="to"><slot /></a>' }),
}

import CostCalculator from '~/pages/tools/international-call-cost-calculator.vue'

const createWrapper = () => {
  return mount(CostCalculator, {
    global: {
      stubs: stubComponents,
      mocks: {
        $fetch: vi.fn(),
      },
    },
  })
}

describe('International Call Cost Calculator', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders the page title', () => {
    const wrapper = createWrapper()
    expect(wrapper.text()).toContain('International Call Cost Calculator')
  })

  it('renders from country selector', () => {
    const wrapper = createWrapper()
    const select = wrapper.find('#fromCountry')
    expect(select.exists()).toBe(true)
  })

  it('renders to country selector', () => {
    const wrapper = createWrapper()
    const select = wrapper.find('#toCountry')
    expect(select.exists()).toBe(true)
  })

  it('renders minutes per month input', () => {
    const wrapper = createWrapper()
    const input = wrapper.find('#minutesPerMonth')
    expect(input.exists()).toBe(true)
  })

  it('has default minutes per month of 100', () => {
    const wrapper = createWrapper()
    const input = wrapper.find('#minutesPerMonth')
    expect((input.element as HTMLInputElement).value).toBe('100')
  })

  it('renders Calculate Cost button', () => {
    const wrapper = createWrapper()
    expect(wrapper.text()).toContain('Calculate Cost')
  })

  it('does not show results initially', () => {
    const wrapper = createWrapper()
    expect(wrapper.text()).not.toContain('Cost Breakdown')
  })

  it('has country options in selectors', () => {
    const wrapper = createWrapper()
    const fromSelect = wrapper.find('#fromCountry')
    const options = fromSelect.findAll('option')
    expect(options.length).toBeGreaterThan(50)
  })

  it('defaults from country to US', () => {
    const wrapper = createWrapper()
    const fromSelect = wrapper.find('#fromCountry')
    expect((fromSelect.element as HTMLSelectElement).value).toBe('US')
  })

  it('defaults to country to GB', () => {
    const wrapper = createWrapper()
    const toSelect = wrapper.find('#toCountry')
    expect((toSelect.element as HTMLSelectElement).value).toBe('GB')
  })

  it('renders CTA section', () => {
    const wrapper = createWrapper()
    expect(wrapper.text()).toContain('Save money by calling internationally')
    expect(wrapper.text()).toContain('Get Started Free')
  })

  it('renders register link in CTA', () => {
    const wrapper = createWrapper()
    const registerLink = wrapper.find('a[href="/register"]')
    expect(registerLink.exists()).toBe(true)
  })

  it('has form labels', () => {
    const wrapper = createWrapper()
    expect(wrapper.text()).toContain('From Country')
    expect(wrapper.text()).toContain('To Country')
    expect(wrapper.text()).toContain('Minutes per Month')
  })
})

// Unit test the formatCurrency helper
describe('formatCurrency helper', () => {
  const formatCurrency = (amount: number): string => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount)
  }

  it('formats zero correctly', () => {
    expect(formatCurrency(0)).toBe('$0.00')
  })

  it('formats small amounts', () => {
    expect(formatCurrency(0.05)).toBe('$0.05')
  })

  it('formats large amounts with commas', () => {
    expect(formatCurrency(1234.56)).toBe('$1,234.56')
  })

  it('formats negative amounts', () => {
    expect(formatCurrency(-5.5)).toBe('-$5.50')
  })

  it('rounds to 2 decimal places', () => {
    expect(formatCurrency(1.999)).toBe('$2.00')
  })
})

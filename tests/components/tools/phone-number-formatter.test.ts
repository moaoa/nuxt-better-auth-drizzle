import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { defineComponent, nextTick } from 'vue'

// Stub Nuxt composables used by ToolLayout
;(globalThis as any).useSeoMeta = vi.fn()
;(globalThis as any).useHead = vi.fn()

// Stub components
const stubComponents = {
  ToolLayout: defineComponent({
    props: ['title', 'description', 'structuredData'],
    template: '<div class="tool-layout"><h1>{{ title }}</h1><p>{{ description }}</p><slot /></div>',
  }),
  NuxtLink: defineComponent({ props: ['to'], template: '<a :href="to"><slot /></a>' }),
}

import PhoneNumberFormatter from '~/pages/tools/phone-number-formatter.vue'

const createWrapper = () => {
  return mount(PhoneNumberFormatter, {
    global: {
      stubs: stubComponents,
    },
  })
}

describe('Phone Number Formatter', () => {
  it('renders the page title', () => {
    const wrapper = createWrapper()
    expect(wrapper.text()).toContain('Phone Number Formatter')
  })

  it('renders phone number input', () => {
    const wrapper = createWrapper()
    const input = wrapper.find('#phoneNumber')
    expect(input.exists()).toBe(true)
  })

  it('renders country selector', () => {
    const wrapper = createWrapper()
    const select = wrapper.find('#country')
    expect(select.exists()).toBe(true)
  })

  it('has auto-detect as default country option', () => {
    const wrapper = createWrapper()
    const select = wrapper.find('#country')
    const defaultOption = select.find('option[value=""]')
    expect(defaultOption.text()).toBe('Auto-detect')
  })

  it('does not show results initially', () => {
    const wrapper = createWrapper()
    expect(wrapper.text()).not.toContain('Formatted Numbers')
  })

  it('shows formatted results when valid number is entered', async () => {
    const wrapper = createWrapper()
    const input = wrapper.find('#phoneNumber')

    await input.setValue('+14155551234')
    await nextTick()
    // Wait for watcher
    await nextTick()

    expect(wrapper.text()).toContain('Formatted Numbers')
    expect(wrapper.text()).toContain('E.164 Format')
    expect(wrapper.text()).toContain('National Format')
    expect(wrapper.text()).toContain('International Format')
    expect(wrapper.text()).toContain('RFC3966 Format')
  })

  it('shows country and validity info', async () => {
    const wrapper = createWrapper()
    const input = wrapper.find('#phoneNumber')

    await input.setValue('+14155551234')
    await nextTick()
    await nextTick()

    expect(wrapper.text()).toContain('Country:')
    expect(wrapper.text()).toContain('US')
    expect(wrapper.text()).toContain('Valid:')
  })

  it('shows E.164 format correctly', async () => {
    const wrapper = createWrapper()
    const input = wrapper.find('#phoneNumber')

    await input.setValue('+14155551234')
    await nextTick()
    await nextTick()

    expect(wrapper.text()).toContain('+14155551234')
  })

  it('has copy buttons for each format', async () => {
    const wrapper = createWrapper()
    const input = wrapper.find('#phoneNumber')

    await input.setValue('+14155551234')
    await nextTick()
    await nextTick()

    const copyButtons = wrapper.findAll('button').filter((b) => b.text().includes('Copy'))
    // E.164, National, International, RFC3966 = 4 copy buttons
    expect(copyButtons.length).toBe(4)
  })

  it('clears results when input is emptied', async () => {
    const wrapper = createWrapper()
    const input = wrapper.find('#phoneNumber')

    // Enter a number first
    await input.setValue('+14155551234')
    await nextTick()
    await nextTick()
    expect(wrapper.text()).toContain('Formatted Numbers')

    // Clear the input
    await input.setValue('')
    await nextTick()
    await nextTick()
    expect(wrapper.text()).not.toContain('Formatted Numbers')
  })

  it('renders CTA section', () => {
    const wrapper = createWrapper()
    expect(wrapper.text()).toContain('Get Started Free')
  })

  it('renders the register link in CTA', () => {
    const wrapper = createWrapper()
    const registerLink = wrapper.find('a[href="/register"]')
    expect(registerLink.exists()).toBe(true)
  })

  it('lists country options from libphonenumber-js', () => {
    const wrapper = createWrapper()
    const select = wrapper.find('#country')
    const options = select.findAll('option')
    // Should have auto-detect + many countries
    expect(options.length).toBeGreaterThan(50)
  })
})

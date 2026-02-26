import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { defineComponent, ref } from 'vue'

// Mock vue-query
vi.mock('@tanstack/vue-query', () => ({
  useQuery: () => ({
    data: ref({
      calls: [
        {
          id: 1,
          toNumber: '+14155551234',
          fromNumber: '+15005550006',
          status: 'completed',
          durationSeconds: 90,
          createdAt: '2026-02-20T10:00:00Z',
          cost: { userPriceUsd: 0.05, durationSeconds: 90 },
        },
        {
          id: 2,
          toNumber: '+442071234567',
          fromNumber: '+15005550006',
          status: 'failed',
          durationSeconds: null,
          createdAt: '2026-02-20T11:00:00Z',
          cost: null,
        },
      ],
      pagination: { page: 1, totalPages: 1 },
    }),
    isLoading: ref(false),
    refetch: vi.fn(),
  }),
}))

// Stub components
const stubComponents = {
  UiButton: defineComponent({
    props: ['variant', 'disabled'],
    emits: ['click'],
    template: '<button :disabled="disabled" @click="$emit(\'click\')"><slot /></button>',
  }),
  Icon: defineComponent({ props: ['name'], template: '<span class="icon-stub" />' }),
}

import CallsPage from '~/pages/app/calls.vue'

const createWrapper = () => {
  return mount(CallsPage, {
    global: {
      stubs: stubComponents,
    },
  })
}

describe('Calls Page', () => {
  it('renders page title', () => {
    const wrapper = createWrapper()
    expect(wrapper.text()).toContain('Call History')
  })

  it('renders refresh button', () => {
    const wrapper = createWrapper()
    expect(wrapper.text()).toContain('Refresh')
  })

  it('renders the calls table', () => {
    const wrapper = createWrapper()
    const table = wrapper.find('table')
    expect(table.exists()).toBe(true)
  })

  it('renders table headers', () => {
    const wrapper = createWrapper()
    const headers = wrapper.findAll('th')
    const headerTexts = headers.map((h) => h.text())
    expect(headerTexts).toContain('To')
    expect(headerTexts).toContain('From')
    expect(headerTexts).toContain('Status')
    expect(headerTexts).toContain('Duration')
    expect(headerTexts).toContain('Cost')
    expect(headerTexts).toContain('Date')
  })

  it('renders call data in table rows', () => {
    const wrapper = createWrapper()
    const rows = wrapper.findAll('tbody tr')
    expect(rows.length).toBe(2)

    // First call
    expect(rows[0].text()).toContain('+14155551234')
    expect(rows[0].text()).toContain('+15005550006')
    expect(rows[0].text()).toContain('completed')

    // Second call
    expect(rows[1].text()).toContain('+442071234567')
    expect(rows[1].text()).toContain('failed')
  })

  it('formats duration correctly (90 seconds = 1:30)', () => {
    const wrapper = createWrapper()
    expect(wrapper.text()).toContain('1:30')
  })

  it('shows dash for null duration', () => {
    const wrapper = createWrapper()
    // The second call has no duration
    expect(wrapper.text()).toContain('—')
  })

  it('displays cost for billed calls', () => {
    const wrapper = createWrapper()
    expect(wrapper.text()).toContain('$0.05')
  })

  it('applies correct status colors', () => {
    const wrapper = createWrapper()
    const statusCells = wrapper.findAll('.capitalize')

    // Find completed status
    const completedCell = statusCells.find((c) => c.text() === 'completed')
    expect(completedCell?.classes().some((c) => c.includes('green'))).toBe(true)

    // Find failed status
    const failedCell = statusCells.find((c) => c.text() === 'failed')
    expect(failedCell?.classes().some((c) => c.includes('red'))).toBe(true)
  })
})

// Unit test the helper functions extracted from the component
describe('calls helper functions', () => {
  // These functions are defined inside the component, so we re-implement them for testing
  const formatDuration = (seconds: number | null) => {
    if (!seconds) return '—'
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  const formatDate = (date: string | Date | null) => {
    if (!date) return '—'
    return new Date(date).toLocaleString()
  }

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      completed: 'text-green-600 dark:text-green-400',
      failed: 'text-red-600 dark:text-red-400',
      busy: 'text-orange-600 dark:text-orange-400',
      'no-answer': 'text-yellow-600 dark:text-yellow-400',
      answered: 'text-blue-600 dark:text-blue-400',
      ringing: 'text-blue-600 dark:text-blue-400',
      initiated: 'text-gray-600 dark:text-gray-400',
    }
    return colors[status] || 'text-muted-foreground'
  }

  describe('formatDuration', () => {
    it('formats 90 seconds as 1:30', () => {
      expect(formatDuration(90)).toBe('1:30')
    })

    it('formats 60 seconds as 1:00', () => {
      expect(formatDuration(60)).toBe('1:00')
    })

    it('formats 0 as dash', () => {
      expect(formatDuration(0)).toBe('—')
    })

    it('formats null as dash', () => {
      expect(formatDuration(null)).toBe('—')
    })

    it('formats 5 seconds as 0:05', () => {
      expect(formatDuration(5)).toBe('0:05')
    })

    it('formats 3661 seconds as 61:01', () => {
      expect(formatDuration(3661)).toBe('61:01')
    })

    it('formats 59 seconds as 0:59', () => {
      expect(formatDuration(59)).toBe('0:59')
    })
  })

  describe('formatDate', () => {
    it('returns dash for null', () => {
      expect(formatDate(null)).toBe('—')
    })

    it('returns a formatted date string for valid input', () => {
      const result = formatDate('2026-02-20T10:00:00Z')
      expect(result).toBeTruthy()
      expect(result).not.toBe('—')
    })

    it('handles Date object', () => {
      const result = formatDate(new Date('2026-02-20T10:00:00Z'))
      expect(result).toBeTruthy()
      expect(result).not.toBe('—')
    })
  })

  describe('getStatusColor', () => {
    it('returns green for completed', () => {
      expect(getStatusColor('completed')).toContain('green')
    })

    it('returns red for failed', () => {
      expect(getStatusColor('failed')).toContain('red')
    })

    it('returns orange for busy', () => {
      expect(getStatusColor('busy')).toContain('orange')
    })

    it('returns yellow for no-answer', () => {
      expect(getStatusColor('no-answer')).toContain('yellow')
    })

    it('returns blue for answered', () => {
      expect(getStatusColor('answered')).toContain('blue')
    })

    it('returns blue for ringing', () => {
      expect(getStatusColor('ringing')).toContain('blue')
    })

    it('returns gray for initiated', () => {
      expect(getStatusColor('initiated')).toContain('gray')
    })

    it('returns muted-foreground for unknown status', () => {
      expect(getStatusColor('unknown')).toBe('text-muted-foreground')
    })
  })
})

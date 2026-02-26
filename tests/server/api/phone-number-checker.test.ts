import { describe, it, expect, vi } from 'vitest'

// Import the handler directly — defineEventHandler is mocked in setup.ts
// to pass through the handler function
import handler from '~~/server/api/tools/phone-number-checker.post'

// Helper to create a mock H3 event
const createMockEvent = (body: Record<string, any>) => ({
  __body: body,
  node: {
    req: {
      headers: {},
      connection: { remoteAddress: '127.0.0.1' },
    },
  },
})

// Mock readBody to return event.__body
;(globalThis as any).readBody = async (event: any) => event.__body

describe('Phone Number Checker API', () => {
  it('returns valid=true for valid US number', async () => {
    const event = createMockEvent({ phoneNumber: '+14155551234' })
    const result = await handler(event as any)

    expect(result.valid).toBe(true)
    expect(result.country).toBe('US')
    expect(result.e164).toBe('+14155551234')
    expect(result.nationalFormat).toBeTruthy()
    expect(result.internationalFormat).toBeTruthy()
  })

  it('returns valid=true for valid UK number', async () => {
    const event = createMockEvent({ phoneNumber: '+442071234567' })
    const result = await handler(event as any)

    expect(result.valid).toBe(true)
    expect(result.country).toBe('GB')
  })

  it('returns valid=true for valid Libyan number', async () => {
    const event = createMockEvent({ phoneNumber: '+218910098190' })
    const result = await handler(event as any)

    expect(result.valid).toBe(true)
    expect(result.country).toBe('LY')
  })

  it('returns valid=false for garbage input', async () => {
    const event = createMockEvent({ phoneNumber: 'not-a-number' })
    const result = await handler(event as any)

    expect(result.valid).toBe(false)
    expect(result.country).toBe('Unknown')
  })

  it('returns valid=false for too short number', async () => {
    const event = createMockEvent({ phoneNumber: '+1' })
    const result = await handler(event as any)

    expect(result.valid).toBe(false)
  })

  it('includes all format fields', async () => {
    const event = createMockEvent({ phoneNumber: '+14155551234' })
    const result = await handler(event as any)

    expect(result).toHaveProperty('valid')
    expect(result).toHaveProperty('country')
    expect(result).toHaveProperty('e164')
    expect(result).toHaveProperty('nationalFormat')
    expect(result).toHaveProperty('internationalFormat')
  })

  it('formats international format correctly', async () => {
    const event = createMockEvent({ phoneNumber: '+14155551234' })
    const result = await handler(event as any)

    // International format should include spaces/dashes
    expect(result.internationalFormat).toContain('+1')
  })

  it('handles country hint parameter', async () => {
    const event = createMockEvent({ phoneNumber: '(415) 555-1234', country: 'US' })
    const result = await handler(event as any)

    expect(result.valid).toBe(true)
    expect(result.country).toBe('US')
    expect(result.e164).toBe('+14155551234')
  })

  it('returns original number in formats when parsing fails', async () => {
    const event = createMockEvent({ phoneNumber: 'xyz' })
    const result = await handler(event as any)

    expect(result.e164).toBe('xyz')
    expect(result.nationalFormat).toBe('xyz')
    expect(result.internationalFormat).toBe('xyz')
  })

  it('validates German number', async () => {
    const event = createMockEvent({ phoneNumber: '+4915112345678' })
    const result = await handler(event as any)

    expect(result.valid).toBe(true)
    expect(result.country).toBe('DE')
  })

  it('throws zod error for empty phoneNumber', async () => {
    const event = createMockEvent({ phoneNumber: '' })

    await expect(handler(event as any)).rejects.toThrow()
  })

  it('throws zod error for missing phoneNumber', async () => {
    const event = createMockEvent({})

    await expect(handler(event as any)).rejects.toThrow()
  })
})

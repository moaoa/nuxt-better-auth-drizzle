import { describe, it, expect, vi, beforeEach } from 'vitest'
import querystring from 'querystring'

// Mock dependencies
const mockDbUpdate = vi.fn().mockReturnValue({
  set: vi.fn().mockReturnValue({
    where: vi.fn().mockResolvedValue(undefined),
  }),
})

vi.mock('~~/server/utils/drizzle', () => ({
  useDrizzle: () => ({
    update: mockDbUpdate,
  }),
}))

vi.mock('~~/server/utils/twilio', () => ({
  validateWebhookSignature: vi.fn().mockReturnValue(true),
}))

vi.mock('~~/db/schema', () => ({
  call: { id: 'id' },
}))

vi.mock('drizzle-orm', () => ({
  eq: vi.fn((a, b) => ({ field: a, value: b })),
}))

vi.mock('~~/lib/loggers/twilio', () => ({
  twilioLogger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}))

// Mock h3 functions
;(globalThis as any).readRawBody = vi.fn()
;(globalThis as any).setResponseHeader = vi.fn()
;(globalThis as any).getHeaders = vi.fn()

import handler from '~~/server/api/twilio/voice.post'

// Helper to create mock event
const createMockEvent = (
  body: Record<string, string>,
  headers: Record<string, string> = {}
) => {
  const urlEncodedBody = querystring.stringify(body)
  ;(globalThis as any).readRawBody.mockResolvedValue(urlEncodedBody)
  ;(globalThis as any).getHeaders.mockReturnValue({
    'x-twilio-signature': 'valid-signature',
    host: 'test.example.com',
    'x-forwarded-proto': 'https',
    ...headers,
  })

  return {
    path: '/api/twilio/voice',
    __body: body,
    headers: new Map(Object.entries(headers)),
  }
}

describe('Voice Webhook API', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Set development mode to skip signature validation
    process.env.NODE_ENV = 'development'
  })

  it('returns TwiML XML response for valid request', async () => {
    const event = createMockEvent({
      CallSid: 'CA123456',
      To: '+14155551234',
      From: '+15005550006',
    })

    const result = await handler(event as any)

    expect(result).toContain('<?xml version="1.0" encoding="UTF-8"?>')
    expect(result).toContain('<Response>')
    expect(result).toContain('<Dial')
    expect(result).toContain('+14155551234')
    expect(result).toContain('</Response>')
  })

  it('sets Content-Type header to application/xml', async () => {
    const event = createMockEvent({
      CallSid: 'CA123456',
      To: '+14155551234',
    })

    await handler(event as any)

    expect((globalThis as any).setResponseHeader).toHaveBeenCalledWith(
      expect.anything(),
      'Content-Type',
      'application/xml;'
    )
  })

  it('includes status callback URL in TwiML', async () => {
    const event = createMockEvent({
      CallSid: 'CA123456',
      To: '+14155551234',
    })

    const result = await handler(event as any)

    expect(result).toContain('statusCallback=')
    expect(result).toContain('/api/twilio/call-status')
  })

  it('includes status callback events in TwiML', async () => {
    const event = createMockEvent({
      CallSid: 'CA123456',
      To: '+14155551234',
    })

    const result = await handler(event as any)

    expect(result).toContain('statusCallbackEvent="initiated ringing answered completed"')
  })

  it('throws 401 when signature is missing in production', async () => {
    process.env.NODE_ENV = 'production'

    ;(globalThis as any).getHeaders.mockReturnValue({
      host: 'test.example.com',
      'x-forwarded-proto': 'https',
      // No x-twilio-signature
    })
    ;(globalThis as any).readRawBody.mockResolvedValue('')

    const event = {
      path: '/api/twilio/voice',
    }

    await expect(handler(event as any)).rejects.toThrow('Missing Twilio signature')

    // Restore
    process.env.NODE_ENV = 'development'
  })

  it('throws 400 when destination number is missing', async () => {
    const event = createMockEvent({
      CallSid: 'CA123456',
      // No To or Called parameter
    })

    await expect(handler(event as any)).rejects.toThrow('Missing destination number')
  })

  it('uses Called parameter as fallback when To is missing', async () => {
    const event = createMockEvent({
      CallSid: 'CA123456',
      Called: '+442071234567',
    })

    const result = await handler(event as any)
    expect(result).toContain('+442071234567')
  })

  it('updates call record when CallId is provided', async () => {
    const event = createMockEvent({
      CallSid: 'CA123456',
      To: '+14155551234',
      CallId: '42',
    })

    await handler(event as any)

    expect(mockDbUpdate).toHaveBeenCalled()
  })

  it('includes callerId in TwiML Dial verb', async () => {
    const event = createMockEvent({
      CallSid: 'CA123456',
      To: '+14155551234',
    })

    const result = await handler(event as any)
    expect(result).toContain('callerId=')
  })
})

import { describe, it, expect, vi, beforeAll } from 'vitest'
import crypto from 'crypto'

// Stub Nuxt's auto-imported useRuntimeConfig as a global
;(globalThis as any).useRuntimeConfig = () => ({
  TWILIO_WEBHOOK_SECRET: 'test-webhook-secret-key',
  TWILIO_ACCOUNT_SID: 'test-account-sid',
  TWILIO_AUTH_TOKEN: 'test-auth-token',
})

import {
  extractCountryCode,
  isValidE164,
  validateWebhookSignature,
} from '~~/server/utils/twilio'

describe('isValidE164', () => {
  it('returns true for valid US number', () => {
    expect(isValidE164('+14155551234')).toBe(true)
  })

  it('returns true for valid UK number', () => {
    expect(isValidE164('+442071234567')).toBe(true)
  })

  it('returns true for valid Libyan number', () => {
    expect(isValidE164('+218910098190')).toBe(true)
  })

  it('returns false for number without +', () => {
    expect(isValidE164('14155551234')).toBe(false)
  })

  it('returns false for empty string', () => {
    expect(isValidE164('')).toBe(false)
  })

  it('returns false for just a +', () => {
    expect(isValidE164('+')).toBe(false)
  })

  it('returns false for number starting with +0', () => {
    expect(isValidE164('+0123456789')).toBe(false)
  })

  it('returns false for letters mixed in', () => {
    expect(isValidE164('+1415abc1234')).toBe(false)
  })

  it('returns false for too short number', () => {
    expect(isValidE164('+1')).toBe(false)
  })
})

describe('extractCountryCode', () => {
  it('extracts US country code', () => {
    expect(extractCountryCode('+14155551234')).toBe('US')
  })

  it('extracts UK country code', () => {
    expect(extractCountryCode('+442071234567')).toBe('GB')
  })

  it('extracts Libyan country code', () => {
    expect(extractCountryCode('+218910098190')).toBe('LY')
  })

  it('extracts German country code', () => {
    expect(extractCountryCode('+4915112345678')).toBe('DE')
  })

  it('extracts French country code', () => {
    expect(extractCountryCode('+33612345678')).toBe('FR')
  })

  it('falls back to US for unparseable number', () => {
    expect(extractCountryCode('invalid')).toBe('US')
  })

  it('falls back to US for empty string', () => {
    expect(extractCountryCode('')).toBe('US')
  })
})

describe('validateWebhookSignature', () => {
  const authToken = 'test-webhook-secret-key'

  function computeSignature(url: string, params: Record<string, string>): string {
    const data = Object.keys(params)
      .sort()
      .reduce((acc, key) => acc + key + params[key], url)

    return crypto
      .createHmac('sha1', authToken)
      .update(data, 'utf-8')
      .digest('base64')
  }

  it('validates correct signature', () => {
    const url = 'https://example.com/api/twilio/voice'
    const params = { CallSid: 'CA123', To: '+14155551234' }
    const signature = computeSignature(url, params)

    expect(validateWebhookSignature(url, params, signature)).toBe(true)
  })

  it('throws for signature with different byte length (timingSafeEqual constraint)', () => {
    const url = 'https://example.com/api/twilio/voice'
    const params = { CallSid: 'CA123', To: '+14155551234' }

    // timingSafeEqual throws RangeError when buffer lengths differ
    expect(() => validateWebhookSignature(url, params, 'invalid-signature')).toThrow(RangeError)
  })

  it('rejects incorrect signature of same length', () => {
    const url = 'https://example.com/api/twilio/voice'
    const params = { CallSid: 'CA123', To: '+14155551234' }
    const correctSig = computeSignature(url, params)

    // Create a wrong signature of the same byte length (base64 encoded)
    const wrongSig = Buffer.from(
      Buffer.from(correctSig, 'base64').map(b => b ^ 0xff)
    ).toString('base64')

    expect(validateWebhookSignature(url, params, wrongSig)).toBe(false)
  })

  it('validates signature with empty params', () => {
    const url = 'https://example.com/api/twilio/voice'
    const params: Record<string, string> = {}
    const signature = computeSignature(url, params)

    expect(validateWebhookSignature(url, params, signature)).toBe(true)
  })

  it('validates signature with multiple sorted params', () => {
    const url = 'https://example.com/api/twilio/call-status'
    const params = {
      CallSid: 'CA456',
      CallStatus: 'completed',
      Duration: '120',
      From: '+15005550006',
      To: '+14155551234',
    }
    const signature = computeSignature(url, params)

    expect(validateWebhookSignature(url, params, signature)).toBe(true)
  })

  it('rejects when params are tampered with', () => {
    const url = 'https://example.com/api/twilio/voice'
    const params = { CallSid: 'CA123', To: '+14155551234' }
    const signature = computeSignature(url, params)

    // Tamper with the params
    const tamperedParams = { CallSid: 'CA999', To: '+14155551234' }
    expect(validateWebhookSignature(url, tamperedParams, signature)).toBe(false)
  })

  it('rejects when URL is different (same-length signatures)', () => {
    // Use same-length URLs to ensure same-length base64 output
    const url1 = 'https://example.com/api/twilio/voice'
    const url2 = 'https://examplx.com/api/twilio/voice'
    const params = { CallSid: 'CA123' }
    const signature = computeSignature(url1, params)

    // Both URLs produce same-length signatures since the HMAC output is always 20 bytes
    expect(validateWebhookSignature(url2, params, signature)).toBe(false)
  })
})

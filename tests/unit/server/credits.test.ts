import { describe, it, expect } from 'vitest'
import {
  calculateUserPrice,
  calculateCallCostUsd,
  calculateMaxAllowedSeconds,
} from '~~/server/utils/credits'

describe('calculateUserPrice', () => {
  it('applies profit margin correctly', () => {
    expect(calculateUserPrice(10, 0.5)).toBe(15)
  })

  it('returns zero when twilio cost is zero', () => {
    expect(calculateUserPrice(0, 0.5)).toBe(0)
  })

  it('handles zero profit margin', () => {
    expect(calculateUserPrice(10, 0)).toBe(10)
  })

  it('handles 100% profit margin', () => {
    expect(calculateUserPrice(10, 1.0)).toBe(20)
  })

  it('throws when twilio cost is negative', () => {
    expect(() => calculateUserPrice(-1, 0.5)).toThrow('Twilio cost cannot be negative')
  })

  it('throws when profit margin is negative', () => {
    expect(() => calculateUserPrice(10, -0.1)).toThrow('Profit margin cannot be negative')
  })

  it('handles small fractional values', () => {
    const result = calculateUserPrice(0.001, 0.5)
    expect(result).toBeCloseTo(0.0015, 6)
  })
})

describe('calculateCallCostUsd', () => {
  it('charges minimum 1 minute for short calls', () => {
    expect(calculateCallCostUsd(0.01, 30)).toBe(0.01)
  })

  it('rounds up to nearest minute', () => {
    // 61 seconds = 2 minutes (rounds up)
    expect(calculateCallCostUsd(0.01, 61)).toBe(0.02)
  })

  it('charges exactly 1 minute for 60 seconds', () => {
    expect(calculateCallCostUsd(0.01, 60)).toBe(0.01)
  })

  it('charges 1 minute for 1 second', () => {
    expect(calculateCallCostUsd(0.01, 1)).toBe(0.01)
  })

  it('charges 1 minute for 0 seconds (minimum 1 min)', () => {
    expect(calculateCallCostUsd(0.01, 0)).toBe(0.01)
  })

  it('handles 5 minutes exactly', () => {
    expect(calculateCallCostUsd(0.02, 300)).toBe(0.10)
  })

  it('rounds 5 min 1 sec up to 6 minutes', () => {
    expect(calculateCallCostUsd(0.02, 301)).toBeCloseTo(0.12, 6)
  })

  it('throws when rate is negative', () => {
    expect(() => calculateCallCostUsd(-0.01, 60)).toThrow('Rate per minute cannot be negative')
  })

  it('throws when duration is negative', () => {
    expect(() => calculateCallCostUsd(0.01, -1)).toThrow('Duration cannot be negative')
  })

  it('handles zero rate', () => {
    expect(calculateCallCostUsd(0, 120)).toBe(0)
  })
})

describe('calculateMaxAllowedSeconds', () => {
  it('calculates correct max seconds with profit margin', () => {
    // Balance: $10, rate: $0.01/min, margin: 50%
    // User rate: $0.015/min
    // Affordable minutes: floor(10 / 0.015) = floor(666.66) = 666
    // Seconds: 666 * 60 = 39960
    expect(calculateMaxAllowedSeconds(10, 0.01, 0.5)).toBe(39960)
  })

  it('returns 0 for negative balance', () => {
    expect(calculateMaxAllowedSeconds(-5, 0.01, 0.5)).toBe(0)
  })

  it('returns 0 for zero rate', () => {
    expect(calculateMaxAllowedSeconds(10, 0, 0.5)).toBe(0)
  })

  it('returns 0 for negative rate', () => {
    expect(calculateMaxAllowedSeconds(10, -0.01, 0.5)).toBe(0)
  })

  it('handles zero profit margin (default)', () => {
    // Balance: $1, rate: $0.01/min, margin: 0
    // Affordable minutes: floor(1 / 0.01) = 100
    // Seconds: 100 * 60 = 6000
    expect(calculateMaxAllowedSeconds(1, 0.01)).toBe(6000)
  })

  it('handles very small balance', () => {
    // Balance: $0.01, rate: $0.01/min, margin: 0.5
    // User rate: $0.015/min
    // Affordable minutes: floor(0.01 / 0.015) = floor(0.666) = 0
    // Seconds: 0 * 60 = 0
    expect(calculateMaxAllowedSeconds(0.01, 0.01, 0.5)).toBe(0)
  })

  it('handles zero balance', () => {
    expect(calculateMaxAllowedSeconds(0, 0.01, 0.5)).toBe(0)
  })

  it('handles large balance correctly', () => {
    // Balance: $100, rate: $0.05/min, margin: 0.5
    // User rate: $0.075/min
    // Affordable minutes: floor(100 / 0.075) = floor(1333.33) = 1333
    // Seconds: 1333 * 60 = 79980
    expect(calculateMaxAllowedSeconds(100, 0.05, 0.5)).toBe(79980)
  })
})

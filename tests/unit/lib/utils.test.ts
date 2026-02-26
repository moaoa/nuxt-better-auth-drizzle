import { describe, it, expect } from 'vitest'
import { ref } from 'vue'
import { cn, tw, valueUpdater } from '~~/lib/utils'

describe('cn', () => {
  it('merges class names', () => {
    expect(cn('px-2', 'py-4')).toBe('px-2 py-4')
  })

  it('handles conflicting tailwind classes (last wins)', () => {
    expect(cn('px-2', 'px-4')).toBe('px-4')
  })

  it('handles conditional classes', () => {
    expect(cn('base', false && 'hidden', 'text-sm')).toBe('base text-sm')
  })

  it('handles undefined and null inputs', () => {
    expect(cn('base', undefined, null, 'text-sm')).toBe('base text-sm')
  })

  it('handles empty string', () => {
    expect(cn('')).toBe('')
  })

  it('handles no arguments', () => {
    expect(cn()).toBe('')
  })

  it('merges complex tailwind classes', () => {
    expect(cn('bg-red-500 text-white', 'bg-blue-500')).toBe('text-white bg-blue-500')
  })
})

describe('tw', () => {
  it('behaves identically to cn', () => {
    expect(tw('px-2', 'py-4')).toBe('px-2 py-4')
  })

  it('merges conflicting classes', () => {
    expect(tw('px-2', 'px-4')).toBe('px-4')
  })

  it('handles conditional classes', () => {
    expect(tw('base', false && 'hidden')).toBe('base')
  })
})

describe('valueUpdater', () => {
  it('sets ref value directly when given a value', () => {
    const myRef = ref(10)
    valueUpdater(20, myRef)
    expect(myRef.value).toBe(20)
  })

  it('sets ref value using updater function', () => {
    const myRef = ref(10)
    valueUpdater((prev: number) => prev + 5, myRef)
    expect(myRef.value).toBe(15)
  })

  it('sets ref to string value', () => {
    const myRef = ref('hello')
    valueUpdater('world', myRef)
    expect(myRef.value).toBe('world')
  })

  it('sets ref using function that transforms string', () => {
    const myRef = ref('hello')
    valueUpdater((prev: string) => prev.toUpperCase(), myRef)
    expect(myRef.value).toBe('HELLO')
  })

  it('handles boolean ref', () => {
    const myRef = ref(false)
    valueUpdater(true, myRef)
    expect(myRef.value).toBe(true)
  })

  it('handles array ref with updater function', () => {
    const myRef = ref([1, 2, 3])
    valueUpdater((prev: number[]) => [...prev, 4], myRef)
    expect(myRef.value).toEqual([1, 2, 3, 4])
  })
})

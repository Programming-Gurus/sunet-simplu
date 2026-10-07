import { describe, expect, it } from 'vitest'
import { describeChanged, formatClock, formatFade, formatPoint, parseFade, parsePoint } from '@/lib/format'

describe('times as text', () => {
  it('shows a clock', () => {
    expect(formatClock(0)).toBe('0:00')
    expect(formatClock(102.9)).toBe('1:42')
    expect(formatClock(600)).toBe('10:00')
  })

  it('shows a point with tenths, with a comma in Romanian', () => {
    expect(formatPoint(12, 'ro')).toBe('0:12,0')
    expect(formatPoint(160.04, 'en')).toBe('2:40.0')
    expect(formatPoint(59.96, 'ro')).toBe('1:00,0')
  })

  it('reads a point', () => {
    expect(parsePoint('2:40')).toBe(160)
    expect(parsePoint('2:40,5')).toBe(160.5)
    expect(parsePoint(' 0:12.0 ')).toBe(12)
    expect(parsePoint('95')).toBe(95)
    expect(parsePoint('1:75')).toBeNull()
    expect(parsePoint('abc')).toBeNull()
    expect(parsePoint('')).toBeNull()
  })

  it('shows and reads a fade time', () => {
    expect(formatFade(1, 'ro')).toBe('1,0')
    expect(formatFade(2.5, 'en')).toBe('2.5')
    expect(parseFade('1,5')).toBe(1.5)
    expect(parseFade('')).toBeNull()
    expect(parseFade('x')).toBeNull()
  })
})

describe('date of last change', () => {
  const now = new Date(2026, 9, 7, 18, 45)

  it('names today and yesterday', () => {
    expect(describeChanged(new Date(2026, 9, 7, 18, 40).toISOString(), 'ro', now)).toEqual({ kind: 'today', time: '18:40' })
    expect(describeChanged(new Date(2026, 9, 6, 9, 5).toISOString(), 'ro', now)).toEqual({ kind: 'yesterday', time: '09:05' })
  })

  it('gives the date for older changes', () => {
    expect(describeChanged(new Date(2026, 8, 28, 12).toISOString(), 'ro', now)).toEqual({ kind: 'date', date: '28 septembrie' })
    expect(describeChanged(new Date(2025, 5, 12, 12).toISOString(), 'en', now)).toEqual({ kind: 'date', date: '12 June 2025' })
  })
})

import { describe, expect, it } from 'vitest'
import { fadeLevel, gainOf, meterPercent } from '@/lib/engine'

describe('fades (5.3)', () => {
  it('goes from silence to full level and back', () => {
    expect(fadeLevel('in', 0, 1, 0)).toBeCloseTo(0)
    expect(fadeLevel('in', 0, 1, 1)).toBeCloseTo(1)
    expect(fadeLevel('out', 1, 0, 0)).toBeCloseTo(1)
    expect(fadeLevel('out', 1, 0, 1)).toBeCloseTo(0)
  })

  it('keeps the loudness even during a crossfade (equal power)', () => {
    for (const progress of [0.1, 0.25, 0.5, 0.75, 0.9]) {
      const up = fadeLevel('in', 0, 1, progress)
      const down = fadeLevel('out', 1, 0, progress)
      expect(up * up + down * down).toBeCloseTo(1)
    }
  })

  it('starts a fade-out from the level at that moment', () => {
    expect(fadeLevel('out', 0.4, 0, 0)).toBeCloseTo(0.4)
    expect(fadeLevel('out', 0.4, 0, 0.5)).toBeLessThan(0.4)
    expect(fadeLevel('out', 0.4, 0, 1)).toBeCloseTo(0)
  })

  it('stays inside the fade for times outside it', () => {
    expect(fadeLevel('in', 0, 1, -1)).toBeCloseTo(0)
    expect(fadeLevel('in', 0, 1, 5)).toBeCloseTo(1)
  })
})

describe('volume', () => {
  it('maps percent to gain', () => {
    expect(gainOf(100)).toBe(1)
    expect(gainOf(0)).toBe(0)
    expect(gainOf(50)).toBeCloseTo(0.25)
    expect(gainOf(250)).toBe(1)
  })
})

describe('level meter (3.2)', () => {
  it('goes from 0 to the volume of the step', () => {
    expect(meterPercent(100, 0)).toBe(0)
    expect(meterPercent(100, 1)).toBe(100)
    expect(meterPercent(80, 1)).toBe(80)
    expect(meterPercent(0, 1)).toBe(0)
  })

  it('shows where the volume slider would be for the same loudness', () => {
    // The slider gives a gain of percent squared. A fade at a quarter of the gain is half the slider.
    expect(meterPercent(100, gainOf(50))).toBe(50)
    expect(meterPercent(60, gainOf(50))).toBe(30)
  })
})

import { describe, expect, it } from 'vitest'
import { outputStatus, selectableNames } from '@shared/outputRules'

const jack = 'External Headphones (Built-in)'
const speakers = 'MacBook Pro Speakers (Built-in)'
const airpods = 'AirPods Pro (Bluetooth)'

describe('when the preview output is valid (5.7)', () => {
  it('needs a named main output', () => {
    expect(outputStatus(null, airpods, [speakers, airpods]).previewValid).toBe(false)
  })

  it('needs a named preview output that is not the main output', () => {
    expect(outputStatus(jack, null, [jack, speakers]).previewValid).toBe(false)
    expect(outputStatus(jack, jack, [jack, speakers]).previewValid).toBe(false)
  })

  it('needs a connected preview device', () => {
    expect(outputStatus(jack, airpods, [jack, speakers]).previewValid).toBe(false)
    expect(outputStatus(jack, airpods, [jack, speakers, airpods]).previewValid).toBe(true)
  })

  it('does not depend on the main device being connected', () => {
    const status = outputStatus(jack, airpods, [speakers, airpods])
    expect(status.mainConnected).toBe(false)
    expect(status.previewValid).toBe(true)
  })
})

describe('main output (8.2)', () => {
  it('treats "System default" as connected', () => {
    expect(outputStatus(null, null, [])).toEqual({ mainIsDefault: true, mainConnected: true, previewConnected: false, previewValid: false })
  })

  it('knows that a named device is not connected', () => {
    expect(outputStatus(jack, null, [speakers]).mainConnected).toBe(false)
  })
})

describe('the device lists in Settings (8.2)', () => {
  it('does not offer the device of the other output', () => {
    expect(selectableNames(null, airpods, [jack, speakers, airpods])).toEqual([jack, speakers])
  })

  it('keeps a remembered device that is not connected', () => {
    expect(selectableNames(jack, null, [speakers])).toEqual([jack, speakers])
  })
})

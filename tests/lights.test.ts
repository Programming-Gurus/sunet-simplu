import { describe, expect, it } from 'vitest'
import {
  DEFAULT_LIGHT_COLOR,
  DEFAULT_LIGHT_ICON,
  LIGHT_COLORS,
  LIGHT_NAME_MAX,
  lightColor,
  lightStateOf,
  normalizeLightGroups,
  paletteColorId,
  setLightColor,
  setLightState,
  unknownLightGroups,
  usedLightGroups,
} from '@shared/lights'
import { newStep, normalizeProject } from '@shared/project'
import type { LightGroup } from '@shared/types'

function group(id: string, name: string): LightGroup {
  return { id, name, ...DEFAULT_LIGHT_ICON }
}

describe('light groups (8.3)', () => {
  it('reads the groups of a file and keeps the first group of each id', () => {
    const groups = normalizeLightGroups([
      { id: 'g1', name: '  Spot   stânga ', icon: 'mdiSpotlightBeam', iconPath: 'M2,2L4,4Z' },
      { id: 'g1', name: 'Same id twice' },
      { id: '../bad', name: 'Bad id' },
      'not a group',
      { id: 'g2', name: 'x'.repeat(LIGHT_NAME_MAX + 10) },
    ])
    expect(groups).toEqual([
      { id: 'g1', name: 'Spot stânga', icon: 'mdiSpotlightBeam', iconPath: 'M2,2L4,4Z' },
      { id: 'g2', name: 'x'.repeat(LIGHT_NAME_MAX), ...DEFAULT_LIGHT_ICON },
    ])
    expect(normalizeLightGroups('no')).toEqual([])
  })

  it('gives the default icon to a group whose drawing is not an SVG path', () => {
    const groups = normalizeLightGroups([
      { id: 'g1', name: 'Markup', icon: 'mdiSpotlight', iconPath: 'M0,0"/><script>alert(1)</script>' },
      { id: 'g2', name: 'No name of an icon', icon: 'spotlight', iconPath: 'M2,2L4,4Z' },
    ])
    expect(groups.map((item) => [item.icon, item.iconPath])).toEqual([
      [DEFAULT_LIGHT_ICON.icon, DEFAULT_LIGHT_ICON.iconPath],
      [DEFAULT_LIGHT_ICON.icon, DEFAULT_LIGHT_ICON.iconPath],
    ])
  })

  it('finds the groups that the steps use, and lets the first list win', () => {
    const a = newStep('a')
    const b = newStep('b')
    setLightState(a, 'g2', 'on')
    setLightState(b, 'g1', 'off')
    const settings = [group('g1', 'Spot'), group('g2', 'Contre'), group('g3', 'Sală')]
    const copy = [group('g2', 'Old name'), group('g9', 'Not used')]
    expect(usedLightGroups([a, b], [...settings, ...copy])).toEqual([group('g1', 'Spot'), group('g2', 'Contre')])
    expect(usedLightGroups([newStep('c')], settings)).toEqual([])
  })

  it('finds the groups of a project that this computer does not have', () => {
    const project = [group('g1', 'Spot'), group('g7', 'From the other Mac')]
    expect(unknownLightGroups(project, [group('g1', 'Spot'), group('g2', 'Contre')])).toEqual([group('g7', 'From the other Mac')])
  })
})

describe('light cues (4.5)', () => {
  it('gives a new step no light cue', () => {
    const step = newStep('a')
    expect(step.lights).toEqual([])
    expect(lightStateOf(step, 'g1')).toBe('none')
  })

  it('turns a group on, off, and back to no change', () => {
    const step = newStep('a')
    setLightState(step, 'g1', 'on')
    expect(step.lights).toEqual([{ groupId: 'g1', on: true, color: DEFAULT_LIGHT_COLOR }])
    setLightState(step, 'g1', 'off')
    expect(lightStateOf(step, 'g1')).toBe('off')
    expect(step.lights.length).toBe(1)
    setLightState(step, 'g1', 'none')
    expect(step.lights).toEqual([])
  })

  it('keeps the colour of a cue when the cue goes off and on again', () => {
    const step = newStep('a')
    setLightState(step, 'g1', 'on')
    setLightColor(step, 'g1', '#FF453A')
    setLightState(step, 'g1', 'off')
    setLightState(step, 'g1', 'on')
    expect(step.lights[0]).toEqual({ groupId: 'g1', on: true, color: '#ff453a' })
  })

  it('refuses text that is not a colour', () => {
    const step = newStep('a')
    setLightState(step, 'g1', 'on')
    setLightColor(step, 'g1', 'red')
    setLightColor(step, 'g1', '#12')
    setLightColor(step, 'g2', '#000000')
    expect(step.lights).toEqual([{ groupId: 'g1', on: true, color: DEFAULT_LIGHT_COLOR }])
    expect(lightColor(' #AABBCC ')).toBe('#aabbcc')
    expect(lightColor('url(x)')).toBeNull()
  })

  it('names the colours of the palette only', () => {
    expect(paletteColorId(LIGHT_COLORS[2].color)).toBe('red')
    expect(paletteColorId('#123456')).toBeNull()
    expect(new Set(LIGHT_COLORS.map((item) => item.color)).size).toBe(LIGHT_COLORS.length)
  })

  it('reads the cues of a file: one for each group that the file has', () => {
    const project = normalizeProject({
      id: 'p1',
      songs: [],
      lightGroups: [group('g1', 'Spot'), group('g2', 'Contre'), group('g3', 'No step uses it')],
      steps: [
        {
          id: 'a',
          kind: 'note',
          trigger: {},
          lights: [
            { groupId: 'g1', on: true, color: '#FF453A' },
            { groupId: 'g1', on: false, color: '#000000' },
            { groupId: 'gone', on: true, color: '#ffffff' },
            { groupId: 'g2', on: false, color: 'blue' },
            'not a cue',
          ],
        },
        { id: 'b', kind: 'note', trigger: {}, lights: 'no' },
      ],
    })!
    expect(project.steps[0].lights).toEqual([
      { groupId: 'g1', on: true, color: '#ff453a' },
      { groupId: 'g2', on: false, color: DEFAULT_LIGHT_COLOR },
    ])
    expect(project.steps[1].lights).toEqual([])
    // The file holds only the groups that a step uses.
    expect(project.lightGroups.map((item) => item.id)).toEqual(['g1', 'g2'])
  })
})

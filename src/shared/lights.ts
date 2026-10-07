// The rules of light groups and light cues (DESIGN.md, 4.5 and 8.3). They need no screen.

import { isValidId } from './ids'
import type { LightCue, LightGroup, Step } from './types'

/** The palette of a light cue: common stage colours. A cue can also have any other colour. */
export const LIGHT_COLORS = [
  { id: 'warm', color: '#ffd9a0' },
  { id: 'cold', color: '#dcebff' },
  { id: 'red', color: '#ff453a' },
  { id: 'orange', color: '#ff9f0a' },
  { id: 'yellow', color: '#ffd60a' },
  { id: 'green', color: '#32d74b' },
  { id: 'cyan', color: '#40c8e0' },
  { id: 'blue', color: '#4c8dff' },
  { id: 'purple', color: '#bf5af2' },
  { id: 'pink', color: '#ff6eb4' },
] as const

export type LightColorId = (typeof LIGHT_COLORS)[number]['id']

export const DEFAULT_LIGHT_COLOR: string = LIGHT_COLORS[0].color

/** A new group has this icon until the user picks one. The drawing is from Material Design Icons. */
export const DEFAULT_LIGHT_ICON = {
  icon: 'mdiLightbulbOutline',
  iconPath:
    'M12,2A7,7 0 0,1 19,9C19,11.38 17.81,13.47 16,14.74V17A1,1 0 0,1 15,18H9A1,1 0 0,1 8,17V14.74C6.19,13.47 5,11.38 5,9A7,7 0 0,1 12,2M9,21V20H15V21A1,1 0 0,1 14,22H10A1,1 0 0,1 9,21M12,4A5,5 0 0,0 7,9C7,11.05 8.23,12.81 10,13.58V16H14V13.58C15.77,12.81 17,11.05 17,9A5,5 0 0,0 12,4Z',
} as const

export const LIGHT_NAME_MAX = 60
const LIGHT_GROUPS_MAX = 200

const COLOR_PATTERN = /^#[0-9a-f]{6}$/
const ICON_PATTERN = /^mdi[A-Za-z0-9]{1,80}$/
// An SVG path holds only commands and numbers. The longest drawing of the icon library has 4,600 characters.
const ICON_PATH_PATTERN = /^[MmLlHhVvCcSsQqTtAaZz0-9\s,.eE-]{1,8000}$/

/** A colour as `#rrggbb`, in lower case. Returns `null` for other text. */
export function lightColor(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const color = value.trim().toLowerCase()
  return COLOR_PATTERN.test(color) ? color : null
}

/** The palette colour that a cue has, or `null` for a colour of its own. */
export function paletteColorId(color: string): LightColorId | null {
  return LIGHT_COLORS.find((item) => item.color === color)?.id ?? null
}

export function isLightIcon(icon: unknown, iconPath: unknown): boolean {
  return typeof icon === 'string' && ICON_PATTERN.test(icon) && typeof iconPath === 'string' && ICON_PATH_PATTERN.test(iconPath)
}

export function cleanLightName(value: unknown): string {
  return typeof value === 'string' ? value.replace(/\s+/g, ' ').trim().slice(0, LIGHT_NAME_MAX) : ''
}

/** Reads light groups from a file that the app did not control. Keeps the first group of each id. */
export function normalizeLightGroups(raw: unknown): LightGroup[] {
  if (!Array.isArray(raw)) return []
  const groups: LightGroup[] = []
  for (const item of raw) {
    if (typeof item !== 'object' || item === null || groups.length >= LIGHT_GROUPS_MAX) continue
    const source = item as Record<string, unknown>
    if (!isValidId(source.id) || groups.some((group) => group.id === source.id)) continue
    const icon = isLightIcon(source.icon, source.iconPath)
      ? { icon: source.icon as string, iconPath: source.iconPath as string }
      : DEFAULT_LIGHT_ICON
    groups.push({ id: source.id, name: cleanLightName(source.name), ...icon })
  }
  return groups
}

/** Reads the light cues of a step. A step has one cue at most for each group that the file knows. */
export function normalizeLightCues(raw: unknown, groupIds: ReadonlySet<string>): LightCue[] {
  if (!Array.isArray(raw)) return []
  const cues: LightCue[] = []
  for (const item of raw) {
    if (typeof item !== 'object' || item === null) continue
    const source = item as Record<string, unknown>
    if (typeof source.groupId !== 'string' || !groupIds.has(source.groupId)) continue
    if (cues.some((cue) => cue.groupId === source.groupId)) continue
    cues.push({ groupId: source.groupId, on: source.on !== false, color: lightColor(source.color) ?? DEFAULT_LIGHT_COLOR })
  }
  return cues
}

/**
 * The groups that the steps use, in the order of `known`.
 * If `known` has a group two times, the first one wins: put the groups of the app settings first.
 */
export function usedLightGroups(steps: Pick<Step, 'lights'>[], known: LightGroup[]): LightGroup[] {
  const used = new Set(steps.flatMap((step) => step.lights.map((cue) => cue.groupId)))
  const groups: LightGroup[] = []
  for (const group of known) {
    if (used.has(group.id) && !groups.some((item) => item.id === group.id)) groups.push(group)
  }
  return groups
}

/** The groups of a project that the app settings do not have. They come from a different computer. */
export function unknownLightGroups(projectGroups: LightGroup[], settingsGroups: LightGroup[]): LightGroup[] {
  return projectGroups.filter((group) => !settingsGroups.some((item) => item.id === group.id))
}

export type LightState = 'none' | 'on' | 'off'

export function lightStateOf(step: Pick<Step, 'lights'>, groupId: string): LightState {
  const cue = step.lights.find((item) => item.groupId === groupId)
  return cue ? (cue.on ? 'on' : 'off') : 'none'
}

/** Sets what a step does to one group. A cue that changes its state keeps its colour. */
export function setLightState(step: Pick<Step, 'lights'>, groupId: string, state: LightState): void {
  const cue = step.lights.find((item) => item.groupId === groupId)
  if (state === 'none') {
    step.lights = step.lights.filter((item) => item.groupId !== groupId)
  } else if (cue) {
    cue.on = state === 'on'
  } else {
    step.lights.push({ groupId, on: state === 'on', color: DEFAULT_LIGHT_COLOR })
  }
}

/** Sets the colour of a cue. The app refuses text that is not a colour. */
export function setLightColor(step: Pick<Step, 'lights'>, groupId: string, value: unknown): void {
  const cue = step.lights.find((item) => item.groupId === groupId)
  const color = lightColor(value)
  if (cue && color) cue.color = color
}

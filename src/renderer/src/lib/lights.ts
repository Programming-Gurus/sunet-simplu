// Light groups and light cues, as the interface sees them (DESIGN.md, 4.5 and 8.3).

import { cleanLightName, DEFAULT_LIGHT_ICON, paletteColorId } from '@shared/lights'
import type { LightCue, LightGroup, Step } from '@shared/types'
import { alertDialog, confirmDialog } from './dialogs'
import { t } from './i18n'
import { flushSave, store, touch } from './projectStore'
import { settings, updateSettings } from './settings'

/** The groups of the settings, then the groups that only the open project has. */
export function lightGroups(): LightGroup[] {
  const own = store.project?.lightGroups.filter((group) => !settings.lightGroups.some((item) => item.id === group.id)) ?? []
  return [...settings.lightGroups, ...own]
}

export function lightGroupName(group: LightGroup): string {
  return group.name || t('lights.unnamed')
}

/** The light cues of a step with their groups, in the order of the groups. */
export function stepLights(step: Step): { group: LightGroup; cue: LightCue }[] {
  if (step.lights.length === 0) return []
  const shown: { group: LightGroup; cue: LightCue }[] = []
  for (const group of lightGroups()) {
    const cue = step.lights.find((item) => item.groupId === group.id)
    if (cue) shown.push({ group, cue })
  }
  return shown
}

/** "roșu" for a colour of the palette, '' for a colour of its own. */
export function lightColorName(color: string): string {
  const id = paletteColorId(color)
  return id ? t(`color.${id}`) : ''
}

async function saveGroups(groups: LightGroup[]): Promise<void> {
  await updateSettings({ lightGroups: groups })
  // The open project keeps a copy of its groups. The copy follows the settings.
  if (store.project) touch()
}

export async function addLightGroup(): Promise<LightGroup> {
  const group: LightGroup = { id: crypto.randomUUID(), name: '', ...DEFAULT_LIGHT_ICON }
  await saveGroups([...settings.lightGroups, group])
  return group
}

export async function changeLightGroup(id: string, patch: Partial<Pick<LightGroup, 'name' | 'icon' | 'iconPath'>>): Promise<void> {
  const next = settings.lightGroups.map((group) =>
    group.id === id ? { ...group, ...patch, ...(patch.name === undefined ? {} : { name: cleanLightName(patch.name) }) } : group,
  )
  await saveGroups(next)
}

/** Deletes a group, unless a project on this computer uses it. Returns `true` if the group is gone. */
export async function deleteLightGroup(group: LightGroup): Promise<boolean> {
  const name = lightGroupName(group)
  // The open project must be on the disk, with its last change, before the app looks for the group.
  await flushSave()
  const users = await window.api.projects.usingLightGroup(group.id)
  if (users.length > 0) {
    await alertDialog({
      title: t('settings.lightUsedTitle'),
      body: t(users.length === 1 ? 'settings.lightUsedOne' : 'settings.lightUsedMany', {
        name,
        list: users.map((user) => t('settings.quoted', { text: user })).join(', '),
      }),
      confirm: t('common.ok'),
    })
    return false
  }
  const confirmed = await confirmDialog({
    title: t('settings.lightDeleteTitle', { name }),
    body: t('settings.lightDeleteBody'),
    confirm: t('settings.lightDeleteConfirm'),
    danger: true,
  })
  if (!confirmed) return false
  await saveGroups(settings.lightGroups.filter((item) => item.id !== group.id))
  return true
}

// --- The icon library ---

export interface IconEntry {
  /** The name in the library, for example `mdiSpotlightBeam`. */
  key: string
  /** The name that the user reads and searches: "spotlight beam". */
  name: string
  path: string
}

let library: Promise<IconEntry[]> | null = null

/** All icons of Material Design Icons. The app loads them only when the icon picker opens. */
export function loadIcons(): Promise<IconEntry[]> {
  library ??= import('@mdi/js').then((icons) =>
    Object.entries(icons as Record<string, unknown>)
      .filter((entry): entry is [string, string] => entry[0].startsWith('mdi') && typeof entry[1] === 'string')
      .map(([key, path]) => ({ key, name: iconName(key), path })),
  )
  return library
}

/** "mdiSpotlightBeam" → "spotlight beam". */
export function iconName(key: string): string {
  return key
    .slice(3)
    .replace(/([a-z])([A-Z0-9])/g, '$1 $2')
    .replace(/([0-9])([A-Z])/g, '$1 $2')
    .toLowerCase()
}

// Without a search, the picker shows the icons that look like stage lights.
const STAGE_WORDS = [
  'spotlight',
  'track light',
  'light flood',
  'light recessed',
  'ceiling light',
  'led strip',
  'lightbulb',
  'lamp',
  'floor lamp',
  'desk lamp',
  'wall sconce',
  'string lights',
  'vanity light',
  'chandelier',
  'projector',
  'disco ball',
  'curtains',
  'theater',
]

/** The icons whose name has all the words of the search, the nearest names first. */
export function searchIcons(icons: IconEntry[], query: string): IconEntry[] {
  const words = query.toLowerCase().split(/[\s-]+/).filter(Boolean)
  if (words.length === 0) {
    return STAGE_WORDS.flatMap((word) => icons.filter((icon) => icon.name.startsWith(word))).filter(
      (icon, index, list) => list.indexOf(icon) === index,
    )
  }
  const first = words[0]
  return icons
    .filter((icon) => words.every((word) => icon.name.includes(word)))
    .sort(
      (a, b) =>
        Number(b.name.startsWith(first)) - Number(a.name.startsWith(first)) || a.name.length - b.name.length || a.name.localeCompare(b.name),
    )
}

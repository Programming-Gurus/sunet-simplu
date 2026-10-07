// The self-test: the app drives itself, checks its own state and saves pictures of its screens.
// It runs only with `npm run selftest`, hidden, on a temporary data folder.

import { nextTick } from 'vue'
import { DEFAULT_LIGHT_COLOR, DEFAULT_LIGHT_ICON, setLightColor, setLightState } from '@shared/lights'
import { activeSettings, partOf } from '@shared/project'
import { closeDialog, dialogState } from './lib/dialogs'
import * as engine from './lib/engine'
import { engineState } from './lib/engine'
import { language, messageKeys, rawMessages, t } from './lib/i18n'
import { addLightGroup, changeLightGroup, deleteLightGroup, loadIcons } from './lib/lights'
import { closeSettings, nav, openSettings } from './lib/nav'
import { deviceByName, outputs, outputsView, refreshOutputs } from './lib/outputs'
import { debugPreview, previewState } from './lib/preview'
import {
  addSongFiles,
  addStep,
  deleteSong,
  deleteStep,
  duplicateStep,
  flushSave,
  moveStep,
  setCursor,
  setKind,
  store,
  touch,
} from './lib/projectStore'
import { enterProject, leaveProject, setMode } from './lib/session'
import { engineView, fadeOutMusic, pressPlay, pressStop, runCursor, somethingPlays, stepState, togglePreviewSong, togglePreviewStep } from './lib/show'
import { settings } from './lib/settings'
import { updateSettings } from './lib/settings'

interface Check {
  name: string
  pass: boolean
  detail?: string
}

const checks: Check[] = []

function check(name: string, pass: boolean, detail?: unknown): void {
  checks.push({ name, pass, ...(detail === undefined ? {} : { detail: String(detail) }) })
}

export function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function picture(name: string): Promise<void> {
  await nextTick()
  await wait(250)
  await window.api.app.selfTestCapture(name)
}

function pageText(): string {
  return document.body.innerText
}

async function testLanguages(): Promise<void> {
  const messages = rawMessages()
  const missing = messageKeys().filter((key) => !messages.en[key] || !messages.ro[key])
  check('both languages have all texts', missing.length === 0, missing.join(', '))
  // Romanian uses ș and ț with a comma below, never the cedilla forms.
  const cedilla = messageKeys().filter((key) => /[şţŞŢ]/.test(messages.ro[key]))
  check('Romanian texts use comma-below letters', cedilla.length === 0, cedilla.join(', '))
  const straightQuotes = messageKeys().filter((key) => /["“]/.test(messages.ro[key]))
  check('Romanian texts use „…” quotes', straightQuotes.length === 0, straightQuotes.join(', '))
  check('default language is Romanian', language.value === 'ro')
}

async function testProjects(): Promise<string> {
  check('the app opens on the Projects screen', nav.screen === 'projects')
  await picture('01-projects-empty')

  const first = await window.api.projects.create('Livada de vișini')
  const second = await window.api.projects.create('O scrisoare pierdută')
  const copy = await window.api.projects.duplicate(second.id, 'O scrisoare pierdută (copie)')
  let list = await window.api.projects.list()
  check('create and duplicate give three projects', list.length === 3, list.map((item) => item.name).join(' | '))
  if (copy) await window.api.projects.remove(copy.id)
  list = await window.api.projects.list()
  check('delete removes the project from the list', list.length === 2)

  check('a new project has a fade-in of 10 s and a fade-out of 5 s', first.fadeIn === 10 && first.fadeOut === 5, `${first.fadeIn} / ${first.fadeOut}`)
  await enterProject(first.id)
  check('a project opens in Edit mode', nav.screen === 'project' && store.mode === 'edit' && store.project?.id === first.id)
  await picture('02-project-empty')

  openSettings()
  await picture('03-settings-ro')
  check('Settings shows Romanian', pageText().includes('Setări'))
  await updateSettings({ language: 'en' })
  await picture('04-settings-en')
  check('the language changes to English', pageText().includes('Settings') && t('projects.new') === 'New project')
  await updateSettings({ language: 'ro' })
  closeSettings()
  check('Back from Settings returns to the project', nav.screen === 'project' && store.project?.id === first.id)

  await leaveProject()
  // The Projects screen reads the list when it opens.
  await wait(200)
  await picture('05-projects-list')
  check('the Projects screen lists the projects', pageText().includes('Livada de vișini') && pageText().includes('O scrisoare pierdută'))
  return first.id
}

function typeIn(field: HTMLInputElement | null | undefined, text: string, event = 'input'): void {
  if (!field) return
  field.value = text
  field.dispatchEvent(new Event(event, { bubbles: true }))
}

function groupId(name: string): string {
  return settings.lightGroups.find((group) => group.name === name)?.id ?? ''
}

/** Light groups (8.3), through the Settings screen. */
async function testLightGroups(): Promise<void> {
  openSettings()
  await nextTick()
  check('a new computer has no light groups', settings.lightGroups.length === 0 && pageText().includes(t('settings.lightsEmpty')))

  document.querySelector<HTMLButtonElement>('.light-add')?.click()
  await until(() => settings.lightGroups.length === 1, 1500)
  await nextTick()
  const first = settings.lightGroups[0]
  check('"Add group" adds a group with the default icon and puts the focus in its name', first?.icon === DEFAULT_LIGHT_ICON.icon && document.activeElement?.id === `light-name-${first?.id}`, document.activeElement?.id)
  const name = document.getElementById(`light-name-${first?.id}`) as HTMLInputElement | null
  typeIn(name, '  Scenă  ', 'change')
  await until(() => name?.value === 'Scenă', 1500)
  check('the app keeps the name of a group without the spaces around it', settings.lightGroups[0]?.name === 'Scenă' && name?.value === 'Scenă', settings.lightGroups[0]?.name)

  // The icon picker: all Material Design Icons, with a search.
  document.querySelector<HTMLButtonElement>('.light-group .light-icon')?.click()
  const opened = await until(() => !!document.querySelector('.picker[open] .icon'), 8000)
  const icons = (): NodeListOf<HTMLButtonElement> => document.querySelectorAll<HTMLButtonElement>('.picker .icon')
  check('the icon picker opens with stage lights', opened && icons().length > 20 && icons().length <= 240, icons().length)
  check('the icon library has thousands of icons', (await loadIcons()).length > 7000, (await loadIcons()).length)
  await picture('03b-settings-icon-picker')
  const search = document.querySelector<HTMLInputElement>('.picker input[type="search"]')
  typeIn(search, 'zzzz')
  await nextTick()
  check('a search without a result says so', icons().length === 0 && pageText().includes(t('icons.none')))
  typeIn(search, 'spotlight beam')
  await nextTick()
  check('the search finds an icon by its English name', icons().length === 1 && icons()[0]?.dataset.icon === 'mdiSpotlightBeam', icons().length)
  icons()[0]?.click()
  await until(() => settings.lightGroups[0]?.icon === 'mdiSpotlightBeam', 1500)
  check('a click sets the icon of the group and closes the picker', settings.lightGroups[0]?.icon === 'mdiSpotlightBeam' && settings.lightGroups[0].iconPath.length > 20 && !document.querySelector('.picker[open]'), settings.lightGroups[0]?.icon)

  const library = await loadIcons()
  for (const [groupName, icon] of [['Sală', 'mdiCeilingLight'], ['Fereastră', 'mdiLightFloodDown']] as const) {
    const group = await addLightGroup()
    const entry = library.find((item) => item.key === icon)
    await changeLightGroup(group.id, { name: groupName, ...(entry ? { icon: entry.key, iconPath: entry.path } : {}) })
  }
  const saved = await window.api.settings.get()
  check('the settings file holds the light groups', saved.lightGroups.map((group) => `${group.name}:${group.icon}`).join() === 'Scenă:mdiSpotlightBeam,Sală:mdiCeilingLight,Fereastră:mdiLightFloodDown', saved.lightGroups.map((group) => `${group.name}:${group.icon}`).join())
  await picture('03c-settings-light-groups')

  // A group that no project uses can be deleted, after a question.
  const spare = await addLightGroup()
  await nextTick()
  document.querySelector<HTMLButtonElement>(`.light-group[data-group="${spare.id}"] .icon-btn:last-child`)?.click()
  const asked = await until(() => !!dialogState.current, 1500)
  check('the app asks before it deletes a light group', asked && settings.lightGroups.length === 4, dialogState.current?.title)
  closeDialog(true)
  check('a light group that no project uses can be deleted', await until(() => settings.lightGroups.length === 3, 1500))
  closeSettings()
}

/** A test song: a tone whose loudness changes, as a WAV file in memory. */
export function makeSong(name: string, seconds: number, frequency: number): File {
  const rate = 8000
  const count = Math.round(seconds * rate)
  const buffer = new ArrayBuffer(44 + count * 2)
  const view = new DataView(buffer)
  const ascii = (offset: number, text: string): void => {
    for (let i = 0; i < text.length; i++) view.setUint8(offset + i, text.charCodeAt(i))
  }
  ascii(0, 'RIFF')
  view.setUint32(4, 36 + count * 2, true)
  ascii(8, 'WAVEfmt ')
  view.setUint32(16, 16, true)
  view.setUint16(20, 1, true)
  view.setUint16(22, 1, true)
  view.setUint32(24, rate, true)
  view.setUint32(28, rate * 2, true)
  view.setUint16(32, 2, true)
  view.setUint16(34, 16, true)
  ascii(36, 'data')
  view.setUint32(40, count * 2, true)
  for (let i = 0; i < count; i++) {
    const time = i / rate
    const swell = 0.35 + 0.3 * Math.sin((time / seconds) * Math.PI) + 0.25 * Math.abs(Math.sin(time * 0.9 + frequency))
    view.setInt16(44 + i * 2, Math.round(Math.sin(2 * Math.PI * frequency * time) * swell * 0.8 * 32767), true)
  }
  return new File([buffer], name, { type: 'audio/wav' })
}

function songId(name: string): string {
  return store.project?.songs.find((song) => song.name === name)?.id ?? ''
}

function describeSteps(): string {
  return (store.project?.steps ?? []).map((step) => step.title).join(' | ')
}

/** Builds the sample project of the UI design: seven steps and three songs. */
async function buildSampleProject(projectId: string): Promise<void> {
  await enterProject(projectId)
  await addSongFiles([
    makeSong('intrare-public.wav', 250, 220),
    makeSong('tema-livezii.wav', 185, 330),
    makeSong('vals.wav', 332, 262),
  ])
  check('three songs are in the project', store.project?.songs.length === 3, store.project?.songs.map((song) => song.name).join(' | '))
  const durations = store.project?.songs.map((song) => Math.round(song.duration)).join(',')
  check('the app measures the length of each song', durations === '250,185,332', durations)

  const refused = addSongFiles([new File(['this is not sound'], 'broken.mp3'), new File(['x'], 'notes.txt')])
  await wait(400)
  check('the app refuses a file that it cannot play', !!dialogState.current && dialogState.current.title.includes('broken.mp3'), dialogState.current?.title)
  closeDialog(true)
  await wait(100)
  check('the app refuses a file that is not audio', !!dialogState.current && dialogState.current.title.includes('notes.txt'), dialogState.current?.title)
  closeDialog(true)
  await refused
  check('a refused file adds no song', store.project?.songs.length === 3)

  const rows: [title: string, line: string, action: string, notes: string, kind: 'note' | 'stop' | 'song', song?: string][] = [
    ['Intrarea publicului', '', 'Se deschid ușile sălii', '', 'song', 'intrare-public.wav'],
    ['', '', 'Al treilea gong', '', 'note'],
    ['Uvertură', '', '', 'Începe pe întuneric, înainte să intre Lopahin.', 'song', 'tema-livezii.wav'],
    ['Sosirea Ranevskaiei', 'Au sosit!', '', 'Pornește imediat după replică.', 'song', 'tema-livezii.wav'],
    ['', '', 'Ranevskaia se așază pe canapea', '', 'stop'],
    ['Dimineață', 'Ce dimineață!', '', 'Trecere lentă, 10 secunde.', 'note'],
    ['Valsul de la bal', '', '', 'Actul III, la ridicarea cortinei.', 'song', 'vals.wav'],
  ]
  for (const [title, line, action, notes, kind, song] of rows) {
    const step = addStep()
    if (!step) continue
    step.title = title
    step.trigger = { line: true, lineText: line, action: action !== '', actionText: action }
    step.notes = notes
    setKind(store.cursor, kind, song ? songId(song) : null)
  }
  // The lights of the second step: the hall goes off and the stage comes on.
  const second = store.project?.steps[1]
  if (second) {
    setLightState(second, groupId('Sală'), 'off')
    setLightState(second, groupId('Scenă'), 'on')
  }
  // Short fades keep the test fast. The rules do not depend on the fade time.
  if (store.project) Object.assign(store.project, { fadeIn: 1, fadeOut: 1 })
  const fourth = store.project?.steps[3]
  const settings = fourth ? activeSettings(fourth) : null
  if (settings) Object.assign(settings, { start: 12, end: 160, volume: 85, continue: true })
  touch()
  check('a new step is a note step, then takes its kind', store.project?.steps.map((step) => step.kind).join(',') === 'song,note,song,song,stop,note,song')
}

async function testEditMode(projectId: string): Promise<void> {
  await buildSampleProject(projectId)
  const project = store.project
  if (!project) return

  setCursor(3)
  await picture('06-edit-song-step')
  const text = pageText()
  check('the row shows the points and the continue label', text.includes('0:12 – 2:40') && text.includes('continuă'))
  check('the editor shows the limit in the middle', (document.getElementById('continue-limit') as HTMLInputElement | null)?.value === '1:26,0')
  check('the waveform is drawn', !!document.querySelector('.waveform')?.firstElementChild)

  // 4.3: the step keeps its settings for each song.
  setKind(3, 'song', songId('vals.wav'))
  const other = activeSettings(project.steps[3])
  check('a song that the step has for the first time gets default settings', other?.start === null && other?.volume === 100)
  setKind(3, 'note')
  setKind(3, 'song', songId('tema-livezii.wav'))
  const kept = activeSettings(project.steps[3])
  check('the settings return with the song, also after Note', kept?.start === 12 && kept?.end === 160 && kept?.volume === 85 && kept?.continue === true)

  // 5.3: the fade times of a step, through the editor. The project has 1 s for both.
  setCursor(3)
  await nextTick()
  const fadeInField = (): HTMLInputElement | null => document.getElementById('step-fade-in-time') as HTMLInputElement | null
  check('a song step follows the fade times of the project', kept?.fadeInTime === null && kept.fadeOutTime === null && fadeInField()?.value === '' && fadeInField()?.placeholder === '1,0', `${fadeInField()?.value} / ${fadeInField()?.placeholder}`)
  const typeFade = async (text: string): Promise<void> => {
    const field = fadeInField()
    if (!field) return
    field.value = text
    field.dispatchEvent(new Event('input', { bubbles: true }))
    field.dispatchEvent(new Event('blur'))
    await nextTick()
  }
  await typeFade('2,5')
  check('the editor sets the fade-in time of the step', kept?.fadeInTime === 2.5 && fadeInField()?.value === '2,5' && pageText().includes(t('steps.fadeInTime', { time: '2,5' })), kept?.fadeInTime)
  await picture('06b-edit-fade-time')
  await typeFade('mult')
  check('the app refuses a fade time that is not a number', kept?.fadeInTime === 2.5 && fadeInField()?.value === '2,5', fadeInField()?.value)
  document.querySelector<HTMLButtonElement>('.fade-reset')?.click()
  await nextTick()
  check('the reset button returns the step to the time of the project', kept?.fadeInTime === null && fadeInField()?.value === '' && !document.querySelector('.fade-reset'))
  await typeFade('3')
  await typeFade('')
  check('an empty field returns the step to the time of the project', kept?.fadeInTime === null)
  // The step keeps a fade-out time of its own. The export must carry it.
  if (kept) kept.fadeOutTime = 1.5
  touch()

  // Continue is available only if a step above uses the same song.
  setCursor(2)
  await nextTick()
  const continueBox = document.querySelector<HTMLInputElement>('.check.off input')
  check('Continue is disabled on the first step of a song', !!continueBox?.disabled && !document.getElementById('continue-limit'))
  await picture('07-edit-first-song-step')

  setCursor(1)
  await picture('08-edit-note-step')
  check('a note step has no sound fields', !document.querySelector('.waveform') && !!document.getElementById('step-notes'))

  // 4.4: what triggers a step, through the editor.
  check('a note step without a title shows its trigger as its first line', document.querySelectorAll('.row .title')[1]?.textContent === 'Al treilea gong' && !pageText().includes(t('steps.noteUntitled')), document.querySelectorAll('.row .title')[1]?.textContent)
  setCursor(3)
  await nextTick()
  const box = (id: string): HTMLInputElement | null => document.getElementById(id) as HTMLInputElement | null
  check('a step has a line trigger, and the Action field waits for its switch', box('step-trigger-line')?.checked === true && box('step-trigger-action')?.checked === false && box('step-line-text')?.value === 'Au sosit!' && box('step-action-text')?.disabled === true)
  check('the row shows the line in quotation marks', pageText().includes('„Au sosit!”'))
  box('step-trigger-action')?.click()
  await nextTick()
  typeIn(box('step-action-text'), 'Ranevskaia intră pe ușă')
  await nextTick()
  check('with Action on, the step takes an action and the row shows it', project.steps[3].trigger.action && project.steps[3].trigger.actionText === 'Ranevskaia intră pe ușă' && pageText().includes('Ranevskaia intră pe ușă'))
  await picture('08b-edit-trigger')
  box('step-trigger-line')?.click()
  await nextTick()
  check('with Line off, the row hides the line and the step keeps its text', !pageText().includes('„Au sosit!”') && project.steps[3].trigger.lineText === 'Au sosit!' && box('step-line-text')?.disabled === true)
  box('step-trigger-line')?.click()
  await nextTick()

  // 4.5: the light cues of a step, through the editor.
  setCursor(5)
  await nextTick()
  const groupRow = (name: string): HTMLElement | null => document.querySelector<HTMLElement>(`.lights .group[data-group="${groupId(name)}"]`)
  const segment = (name: string, state: string): HTMLButtonElement | null => groupRow(name)?.querySelector<HTMLButtonElement>(`[data-state="${state}"]`) ?? null
  const swatch = (): HTMLButtonElement | null => groupRow('Fereastră')?.querySelector<HTMLButtonElement>('.swatch') ?? null
  const palette = (): HTMLElement | null => groupRow('Fereastră')?.querySelector<HTMLElement>('.palette') ?? null
  /** The light chips of a row: "Scenă aprinde alb cald | Sală stinge". */
  const chips = (index: number): string =>
    [...(document.querySelectorAll('.list .slot')[index]?.querySelectorAll('.chip') ?? [])]
      .map((chip) => [...chip.querySelectorAll('span')].map((part) => part.textContent?.trim()).join(' '))
      .join(' | ')
  check('the editor lists every light group', document.querySelectorAll('.lights .group').length === 3)
  check('without a cue, a group has no change and no colour', segment('Fereastră', 'none')?.getAttribute('aria-checked') === 'true' && swatch()?.disabled === true && project.steps[5].lights.length === 0)
  segment('Fereastră', 'on')?.click()
  await nextTick()
  check('"On" adds a light cue with the first colour of the palette', JSON.stringify(project.steps[5].lights) === JSON.stringify([{ groupId: groupId('Fereastră'), on: true, color: DEFAULT_LIGHT_COLOR }]) && swatch()?.disabled === false, JSON.stringify(project.steps[5].lights))
  swatch()?.click()
  await nextTick()
  check('the colour button opens the palette', palette()?.matches(':popover-open') === true)
  await picture('08c-edit-light-palette')
  palette()?.querySelector<HTMLButtonElement>('[data-color="#dcebff"]')?.click()
  await nextTick()
  check('a click on a colour sets it and closes the palette', project.steps[5].lights[0]?.color === '#dcebff' && palette()?.matches(':popover-open') === false, project.steps[5].lights[0]?.color)
  check('the row shows a chip with the group, the change and the colour', chips(5) === 'Fereastră aprinde alb rece', chips(5))
  typeIn(palette()?.querySelector<HTMLInputElement>('input[type="color"]'), '#123456')
  await nextTick()
  check('a cue takes a colour that is not in the palette', project.steps[5].lights[0]?.color === '#123456' && chips(5) === 'Fereastră aprinde', chips(5))
  segment('Fereastră', 'off')?.click()
  await nextTick()
  check('"Off" keeps the colour of the cue and does not show it', project.steps[5].lights[0]?.on === false && project.steps[5].lights[0].color === '#123456' && chips(5) === 'Fereastră stinge' && swatch()?.disabled === true, chips(5))
  segment('Fereastră', 'none')?.click()
  await nextTick()
  check('"No change" removes the light cue', project.steps[5].lights.length === 0 && chips(5) === '')
  segment('Fereastră', 'on')?.click()
  setLightColor(project.steps[5], groupId('Fereastră'), '#dcebff')
  touch()
  check('a step can change many groups', chips(1) === 'Scenă aprinde alb cald | Sală stinge', chips(1))
  await picture('08d-edit-lights')

  // 4.2: duplicate, move, delete.
  duplicateStep(6)
  check('duplicate adds a copy below', project.steps.length === 8 && project.steps[7].title === 'Valsul de la bal' && project.steps[7].id !== project.steps[6].id)
  moveStep(7, 0)
  check('move puts the step at the new place', project.steps[0].title === 'Valsul de la bal' && project.steps[1].title === 'Intrarea publicului', describeSteps())
  setCursor(4)
  moveStep(0, 7)
  check('the cursor stays on its step when a different step moves', store.cursor === 3 && project.steps[3].title === 'Sosirea Ranevskaiei', `cursor ${store.cursor}`)
  deleteStep(7)
  check('delete removes the step', project.steps.length === 7, describeSteps())

  // Section 6: a song that a step uses cannot be deleted.
  const used = project.songs.find((song) => song.name === 'tema-livezii.wav')
  if (used) {
    const attempt = deleteSong(used)
    await wait(100)
    check('the app names the steps that use a song', !!dialogState.current?.body?.includes('3, 4'), dialogState.current?.body)
    closeDialog(true)
    check('a used song stays', (await attempt) === false && project.songs.length === 3)
  }
  await addSongFiles([makeSong('de-sters.wav', 3, 440)])
  const spare = project.songs.find((song) => song.name === 'de-sters.wav')
  if (spare) {
    const attempt = deleteSong(spare)
    await wait(100)
    closeDialog(true)
    check('a song that no step uses can be deleted', (await attempt) === true && project.songs.length === 3)
  }

  // 4.2: the app saves each change immediately.
  await flushSave()
  const saved = await window.api.projects.read(project.id)
  check('the project file holds the steps and the kept settings', saved?.steps.length === 7 && !!saved.steps[3].songSettings[songId('vals.wav')] && partOf(saved.steps[3].songSettings[songId('tema-livezii.wav')], 185).start === 12)
  const savedFades = saved?.steps[3].songSettings[songId('tema-livezii.wav')]
  check('the project file holds the fade times of a step', savedFades?.fadeInTime === null && savedFades.fadeOutTime === 1.5, `${savedFades?.fadeInTime} / ${savedFades?.fadeOutTime}`)
  check('the project file holds the trigger of a step', JSON.stringify(saved?.steps[3].trigger) === JSON.stringify({ line: true, lineText: 'Au sosit!', action: true, actionText: 'Ranevskaia intră pe ușă' }), JSON.stringify(saved?.steps[3].trigger))
  check('the project file holds the light cues and a copy of their groups', saved?.steps[1].lights.length === 2 && saved.steps[5].lights[0]?.color === '#dcebff' && saved.lightGroups.map((group) => group.name).join() === 'Scenă,Sală,Fereastră' && saved.lightGroups[0].iconPath === settings.lightGroups[0].iconPath, saved?.lightGroups.map((group) => group.name).join())

  // 8.3: a group that a project uses cannot be deleted. The copy in the project follows the settings.
  const usedGroup = settings.lightGroups.find((group) => group.name === 'Fereastră')
  if (usedGroup) {
    const attempt = deleteLightGroup(usedGroup)
    await until(() => !!dialogState.current, 1500)
    check('the app names the projects that use a light group', !!dialogState.current?.body?.includes('„Livada de vișini”'), dialogState.current?.body)
    closeDialog(true)
    check('a used light group stays', (await attempt) === false && settings.lightGroups.length === 3)
    await changeLightGroup(usedGroup.id, { name: 'Fereastra din stânga' })
    await nextTick()
    check('a new name of a group shows on the steps at once', chips(5) === 'Fereastra din stânga aprinde alb rece', chips(5))
    await flushSave()
    const renamed = await window.api.projects.read(project.id)
    check('the copy of a group in the project file follows the settings', renamed?.lightGroups.map((group) => group.name).join() === 'Scenă,Sală,Fereastra din stânga', renamed?.lightGroups.map((group) => group.name).join())
  }

  setCursor(3)
  await window.api.app.selfTestResize(1440, 850)
  await picture('09-edit-large-window')
  await window.api.app.selfTestResize(1280, 720)
}

interface VoiceSnapshot {
  stepId: string
  background: boolean
  stopping: boolean
  started: boolean
  time: number
  paused: boolean
  level: number
  measured: number
  loopCount: number
}

interface Snapshot {
  context: string
  voices: VoiceSnapshot[]
  /** The normal step that plays. */
  playing: null | VoiceSnapshot
  fading: VoiceSnapshot[]
  remembered: Record<string, number>
}

/** The sound of a step, as the screens see it. */
function sound(stepId: string): (typeof engineState.sounds)[number] | undefined {
  return engineState.sounds.find((item) => item.stepId === stepId)
}

/** The voice of a step that plays and does not fade out. */
function voice(stepId: string): VoiceSnapshot | undefined {
  return snap().voices.find((item) => item.stepId === stepId && !item.stopping)
}

function plays(stepId: string): Promise<boolean> {
  return until(() => !!voice(stepId)?.started, 2000)
}

function snap(): Snapshot {
  return engine.debugSnapshot() as unknown as Snapshot
}

async function until(condition: () => boolean, timeoutMs: number): Promise<boolean> {
  const end = performance.now() + timeoutMs
  while (performance.now() < end) {
    if (condition()) return true
    await wait(10)
  }
  return condition()
}

function near(value: number | undefined, target: number, tolerance: number): boolean {
  return value !== undefined && Math.abs(value - target) <= tolerance
}

function f(value: number | undefined): string {
  return value === undefined ? 'none' : value.toFixed(2)
}

/** Waits until the engine has no sound at all. */
async function silence(): Promise<boolean> {
  return until(() => !engine.isAudible(), 2500)
}

/**
 * The sound rules of section 5, on the real audio engine. The main output is silent,
 * so the test makes no sound. Fades and positions are measured, not heard.
 */
async function testSound(): Promise<void> {
  engine.setSilent(true)
  const created = await window.api.projects.create('Test sunet')
  await enterProject(created.id)
  await addSongFiles([makeSong('a.wav', 6, 220), makeSong('b.wav', 6, 330), makeSong('scurt.wav', 2, 440)])
  const project = store.project
  if (!project) return
  project.fadeIn = 0.4
  project.fadeOut = 0.4
  const [a, b, short] = ['a.wav', 'b.wav', 'scurt.wav'].map(songId)
  const plan: [kind: 'note' | 'stop' | 'song', song?: string, settings?: Record<string, unknown>][] = [
    ['song', a],
    ['note'],
    ['song', b],
    ['stop'],
    ['song', a, { start: 1, end: 3 }],
    ['song', short, { loop: false }],
    ['song', a, { start: 0.5, end: 5.5, continue: true }],
    ['song', a, { start: 1, end: 3, loop: false }],
    ['song', b, { fadeInTime: 0.1, fadeOutTime: 1.2 }],
  ]
  for (const [kind, song, settings] of plan) {
    addStep()
    setKind(store.cursor, kind, song ?? null)
    const active = activeSettings(project.steps[store.cursor])
    if (active && settings) Object.assign(active, settings)
  }
  touch()
  const id = (index: number): string => project.steps[index].id
  // The cursor rules of a show. In Edit mode, the cursor stays on a song step that starts: see testKeys.
  setMode('show')

  // 5.1, 5.2: Space runs the cursor step. A song fades in.
  setCursor(0)
  const pressed = performance.now()
  runCursor()
  const started = await until(() => !!snap().playing?.started, 2000)
  const latency = Math.round(performance.now() - pressed)
  check('Space starts the song of the cursor step', started && stepState(id(0)) === 'playing', `context ${snap().context}`)
  check('a song starts in less than 0.25 s', latency < 250, `${latency} ms`)
  check('the cursor moves one step down', store.cursor === 1)
  await wait(150)
  const rising = snap().playing
  check('the song fades in', !!rising && rising.level > 0.15 && rising.level < 0.95, f(rising?.level))
  check('the audio graph follows the fade', near(rising?.measured, rising?.level ?? -1, 0.2), `${f(rising?.measured)} measured, ${f(rising?.level)} expected`)
  await wait(400)
  const full = snap().playing
  check('the fade-in ends at full level', near(full?.measured, 1, 0.02), f(full?.measured))
  check('the song plays from its beginning', !!full && full.time > 0.35 && full.time < 0.9 && !full.paused, f(full?.time))

  // A note step changes nothing in the sound.
  runCursor()
  await wait(50)
  check('a note step does not change the sound', stepState(id(0)) === 'playing' && store.cursor === 2)

  // A different song step: crossfade.
  runCursor()
  await wait(20)
  check('the old step fades out at the key press', stepState(id(0)) === 'fadingOut')
  await until(() => !!snap().playing?.started, 2000)
  await wait(150)
  const cross = snap()
  check('crossfade: the old song goes down while the new song comes up', stepState(id(2)) === 'playing' && cross.fading.length === 1 && cross.fading[0].measured < 0.95 && (cross.playing?.measured ?? 0) > 0.1, `old ${f(cross.fading[0]?.measured)}, new ${f(cross.playing?.measured)}`)
  await wait(450)
  check('after the crossfade the old step can play again', stepState(id(0)) === 'idle' && snap().fading.length === 0)

  // Space on a step that plays changes nothing in the sound.
  setCursor(2)
  const before = snap().playing?.time ?? 0
  runCursor()
  await wait(100)
  const after = snap().playing
  check('Space on the step that plays does not start it again', stepState(id(2)) === 'playing' && (after?.time ?? 0) > before && store.cursor === 3, `${f(before)} → ${f(after?.time)}`)

  // A stop step fades out the music. The button is disabled during the fade-out.
  runCursor()
  check('a stop step fades out the music at the key press', stepState(id(2)) === 'fadingOut' && !somethingPlays() && store.cursor === 4)
  await wait(150)
  check('the fade-out goes down', (snap().fading[0]?.measured ?? 1) < 0.95, f(snap().fading[0]?.measured))
  check('the song stops after the fade-out time', (await silence()) && stepState(id(2)) === 'idle')

  // 5.3: a stop during the fade-in starts from the level at that moment.
  pressPlay(0)
  await until(() => !!snap().playing?.started, 2000)
  await wait(120)
  const partial = snap().playing?.level ?? 1
  pressStop(id(0))
  const atStop = snap().fading[0]?.level ?? 1
  await wait(60)
  const later = snap().fading[0]?.measured ?? 1
  check('Stop during the fade-in fades out from the current level', partial < 0.75 && atStop <= partial + 0.08 && later < partial + 0.05, `level ${f(partial)} at the stop, ${f(atStop)} then ${f(later)}`)
  check('the Stop button does not move the cursor from a note step', store.cursor === 1)
  await silence()

  // After Stop or Esc, a stop step at the cursor would do nothing: the cursor skips it.
  pressPlay(2)
  await until(() => !!snap().playing?.started, 2000)
  const atStopStep = store.cursor
  pressStop(id(2))
  check('after the Stop button, the cursor skips a stop step', atStopStep === 3 && store.cursor === 4, `${atStopStep} → ${store.cursor}`)
  await silence()
  pressPlay(2)
  await until(() => !!snap().playing?.started, 2000)
  fadeOutMusic()
  check('after Esc, the cursor skips a stop step', store.cursor === 4)
  await silence()
  setCursor(3)
  fadeOutMusic()
  check('Esc without music does not move the cursor', store.cursor === 3)

  // 5.4, 5.5: cut points and loop.
  pressPlay(4)
  await until(() => !!snap().playing?.started, 2000)
  check('a step with a start point starts there', near(snap().playing?.time, 1, 0.12), f(snap().playing?.time))
  await until(() => (snap().playing?.time ?? 0) >= 2.8, 3000)
  const ending = snap().playing
  check('a looped step does not fade out before its loop point', near(ending?.measured, 1, 0.02), `${f(ending?.measured)} at ${f(ending?.time)} s`)
  const looped = await until(() => (snap().playing?.loopCount ?? 0) === 1, 1500)
  const restart = snap().playing
  check('Loop starts the part again from the start point', looped && !!restart && restart.time >= 0.95 && restart.time < 1.4, f(restart?.time))
  check('the loop restart has no fade', near(restart?.measured, 1, 0.02), f(restart?.measured))
  await wait(120)
  check('the bottom bar counts the loops', sound(id(4))?.loopCount === 1)
  // A looped sound fades only when it stops. The fade-out continues over the loop point.
  await until(() => (snap().playing?.time ?? 0) >= 2.8, 3000)
  pressStop(id(4))
  await wait(300)
  const over = snap().fading[0]
  check('a fade-out continues over the loop point', !!over && over.time < 2 && over.measured > 0.02 && over.measured < 0.9, `${f(over?.measured)} at ${f(over?.time)} s`)
  await silence()
  pressPlay(4)
  await until(() => !!snap().playing?.started, 2000)
  fadeOutMusic()
  check('Esc fades out the music', (await silence()) && engineState.sounds.length === 0)

  // 5.4: with Loop off, a cut end fades out and the song ends at the end point.
  pressPlay(7)
  await until(() => !!snap().playing?.started, 2000)
  await until(() => (snap().playing?.time ?? 0) >= 2.8, 3000)
  const cutEnd = snap().playing
  check('with Loop off, a cut end fades out before the end point', !!cutEnd && cutEnd.measured < 0.9, `${f(cutEnd?.measured)} at ${f(cutEnd?.time)} s`)
  const cutEnded = await until(() => engineState.sounds.length === 0, 1500)
  check('with Loop off, the song ends at its cut end point', cutEnded && stepState(id(7)) === 'idle' && near(snap().remembered[a], 3, 0.1), f(snap().remembered[a]))

  // 5.5: Loop off plays one time.
  pressPlay(5)
  await until(() => !!snap().playing?.started, 2000)
  const ended = await until(() => engineState.sounds.length === 0, 3500)
  check('a song with Loop off plays one time, then no music plays', ended && stepState(id(5)) === 'idle' && near(snap().remembered[short], 2, 0.1), f(snap().remembered[short]))

  // 5.6: Continue.
  pressPlay(0)
  await until(() => !!snap().playing?.started, 2000)
  await wait(1300)
  const stoppedAt = snap().playing?.time ?? 0
  pressStop(id(0))
  await silence()
  // The song plays during the fade-out, so it stops one fade-out time (0.4 s) after the press.
  const fadeEnd = stoppedAt + 0.4
  check('the app remembers the position at the end of the fade-out', near(snap().remembered[a], fadeEnd, 0.12), `${f(snap().remembered[a])} remembered, ${f(stoppedAt)} at the Stop press`)
  pressPlay(6)
  await until(() => !!snap().playing?.started, 2000)
  check('Continue starts the song where the fade-out ended', near(snap().playing?.time, fadeEnd, 0.18), `${f(snap().playing?.time)} for ${f(fadeEnd)}`)
  await until(() => (snap().playing?.time ?? 0) >= 3.3, 3500)
  pressStop(id(6))
  await silence()
  pressPlay(6)
  await until(() => !!snap().playing?.started, 2000)
  check('after the limit, Continue starts from the start point', near(snap().playing?.time, 0.5, 0.15), f(snap().playing?.time))
  pressStop(id(6))
  await silence()
  // A new step during the fade-out continues from the position of that moment.
  pressPlay(0)
  await until(() => !!snap().playing?.started, 2000)
  await wait(900)
  pressStop(id(0))
  await wait(150)
  const duringFade = snap().fading[0]?.time ?? 0
  pressPlay(6)
  await until(() => !!snap().playing?.started, 2000)
  check('Continue during the fade-out starts at the position of that moment', near(snap().playing?.time, duringFade, 0.2), `${f(snap().playing?.time)} for ${f(duringFade)}`)
  pressStop(id(6))
  await silence()

  // The same song plays on a different step: the new step continues without a jump.
  pressPlay(0)
  await until(() => !!snap().playing?.started, 2000)
  await wait(900)
  const running = snap().playing?.time ?? 0
  pressPlay(6)
  await until(() => snap().playing?.stepId === id(6) && !!snap().playing?.started, 2000)
  check('a step that continues a song that plays starts at the same position', near(snap().playing?.time, running, 0.25) && stepState(id(0)) === 'fadingOut', `${f(snap().playing?.time)} for ${f(running)}`)
  await wait(500)

  check('the bottom bar shows the position in the part', (sound(id(6))?.position ?? 0) > 0.5)
  fadeOutMusic()
  await silence()

  // 5.3: a step with its own fade times: 0.1 s in and 1.2 s out. The project has 0.4 s for both.
  pressPlay(8)
  await plays(id(8))
  await wait(200)
  check('a step fades in with its own fade-in time', near(voice(id(8))?.measured, 1, 0.02), f(voice(id(8))?.measured))
  pressStop(id(8))
  await wait(600)
  const slow = snap().fading[0]
  check('a step fades out with its own fade-out time', !!slow && slow.measured > 0.05 && slow.measured < 0.95, f(slow?.measured))
  check('the song stops after the fade-out time of the step', await silence())
  pressPlay(8)
  await plays(id(8))
  pressPlay(0)
  await plays(id(0))
  await wait(600)
  check('in a crossfade, each song uses its own fade time', stepState(id(8)) === 'fadingOut' && near(voice(id(0))?.measured, 1, 0.02), `old ${f(snap().fading[0]?.measured)}, new ${f(voice(id(0))?.measured)}`)
  fadeOutMusic()
  await silence()
  const ownFades = activeSettings(project.steps[8])
  if (ownFades) ownFades.fadeOutTime = null
  pressPlay(8)
  await plays(id(8))
  await wait(200)
  pressStop(id(8))
  check('without its own time, a step fades out with the time of the project', await until(() => !engine.isAudible(), 700))
  await silence()

  // 5.8: a song step whose file is missing.
  const url = store.media[b].url
  store.media[b].url = null
  const flashes = engineView.missingFlash.count
  pressPlay(2)
  await wait(100)
  check('a step with a missing file starts no sound and flashes', engineState.sounds.length === 0 && engineView.missingFlash.count === flashes + 1 && engineView.missingFlash.stepId === id(2))
  store.media[b].url = url

  // 5.8: the app asks before it leaves a project while music plays.
  pressPlay(0)
  await until(() => !!snap().playing?.started, 2000)
  const leaving = leaveProject()
  await wait(100)
  check('the app asks before it leaves while music plays', !!dialogState.current && nav.screen === 'project')
  closeDialog(false)
  await leaving
  check('"Stay" keeps the project and the music', nav.screen === 'project' && stepState(id(0)) === 'playing')
  const leavingNow = leaveProject()
  await wait(100)
  closeDialog(true)
  await leavingNow
  check('leaving stops the music', nav.screen === 'projects' && !engine.isAudible())
}

/**
 * Several sounds at the same time (5.2), the fade switches (5.3), the stop-step targets (4.1)
 * and the level meter (3.2), on the real audio engine. Silent.
 */
async function testLayers(): Promise<void> {
  const created = await window.api.projects.create('Test straturi')
  await enterProject(created.id)
  await addSongFiles([makeSong('ploaie.wav', 6, 180), makeSong('tema.wav', 6, 330), makeSong('tunet.wav', 2, 90), makeSong('vant.wav', 6, 140)])
  const project = store.project
  if (!project) return
  project.fadeIn = 0.4
  project.fadeOut = 0.4
  const [rain, theme, thunder, wind] = ['ploaie.wav', 'tema.wav', 'tunet.wav', 'vant.wav'].map(songId)
  const plan: [title: string, kind: 'stop' | 'song', song?: string, settings?: Record<string, unknown>][] = [
    ['Ploaie', 'song', rain],
    ['Tema', 'song', theme, { volume: 80 }],
    ['Tunet', 'song', thunder, { loop: false }],
    ['', 'stop'],
    ['Oprește ploaia și tema', 'stop'],
    ['Vânt', 'song', wind],
    ['', 'stop'],
  ]
  for (const [title, kind, song, settings] of plan) {
    const step = addStep()
    if (!step) continue
    step.title = title
    setKind(store.cursor, kind, song ?? null)
    const active = activeSettings(project.steps[store.cursor])
    if (active && settings) Object.assign(active, settings)
  }
  touch()
  const id = (index: number): string => project.steps[index].id
  const boxes = (): HTMLInputElement[] => [...document.querySelectorAll<HTMLInputElement>('.stops-list input')]
  const marks = (): string => boxes().map((box) => (box.checked ? 'x' : '-')).join('')

  // 4.1: the switches of a song step, through the editor.
  const defaults = activeSettings(project.steps[2])
  check('a new song step has both fades on and Background off', defaults?.fadesIn === true && defaults.fadesOut === true && defaults.background === false)
  setCursor(2)
  await nextTick()
  document.getElementById('step-fades-in')?.click()
  document.getElementById('step-fades-out')?.click()
  await nextTick()
  for (const index of [0, 5]) {
    setCursor(index)
    await nextTick()
    document.getElementById('step-background')?.click()
    // The screen must show the click before the next step is selected.
    await nextTick()
  }
  const effect = activeSettings(project.steps[2])
  check('the editor sets the fade switches and Background', effect?.fadesIn === false && effect.fadesOut === false && activeSettings(project.steps[0])?.background === true && activeSettings(project.steps[5])?.background === true)
  setCursor(2)
  await picture('09b-edit-effect-step')
  check('the rows name a background step and a step without fades', pageText().includes(t('steps.background')) && pageText().includes(t('steps.noFade')))

  // 4.1: a stop step lists the song steps above it.
  setCursor(3)
  await nextTick()
  check('without a choice, a stop step stops the nearest song step above it', boxes().length === 3 && marks() === 'x--' && !!document.querySelector('.stops-auto'), marks())
  boxes()[0].click()
  await nextTick()
  check('at least one step stays checked', marks() === 'x--' && project.steps[3].stops.length === 0, marks())
  boxes()[2].click()
  await nextTick()
  check('a click adds a step to the stop step', project.steps[3].stops.join() === [id(2), id(0)].join() && !document.querySelector('.stops-auto'), marks())
  document.querySelector<HTMLButtonElement>('.stops-head button')?.click()
  await nextTick()
  check('"Back to automatic" returns the default', project.steps[3].stops.length === 0 && marks() === 'x--', marks())
  setCursor(4)
  await nextTick()
  boxes()[1].click()
  boxes()[2].click()
  await nextTick()
  boxes()[0].click()
  await nextTick()
  check('a stop step can stop the steps that you choose', project.steps[4].stops.join() === [id(1), id(0)].join() && marks() === '-xx', marks())
  await picture('09c-edit-stop-step')
  check('the row of a stop step names what it stops', pageText().includes(t('steps.stopsMany', { list: '1, 2' })) && pageText().includes(t('steps.stopsOne', { list: '3' })))
  await flushSave()
  const saved = await window.api.projects.read(project.id)
  check('the project file holds the switches and the stop-step choice', saved?.steps[4].stops.length === 2 && saved.steps[0].songSettings[rain].background === true && saved.steps[2].songSettings[thunder].fadesOut === false)

  // 3.2: the level meter follows the fade and stops at the volume of the step.
  pressPlay(1)
  await plays(id(1))
  await wait(150)
  const rising = sound(id(1))?.level ?? -1
  check('the level meter moves during the fade-in', rising > 5 && rising < 80, rising)
  await wait(500)
  await nextTick()
  const meter = document.querySelector('.meter[role="meter"]')
  check('the level meter stops at the volume of the step', sound(id(1))?.level === 80 && meter?.getAttribute('aria-valuenow') === '80', `${sound(id(1))?.level}, ${meter?.getAttribute('aria-valuenow')}`)
  check('the bar has no master volume', !document.getElementById('master-volume'))

  // The bar shows silence only when the fade-out ends.
  pressStop(id(1))
  await wait(150)
  await nextTick()
  const falling = sound(id(1))
  check('during a fade-out, the bar keeps the song and its level goes down', !!falling?.fadingOut && falling.level > 0 && falling.level < 80 && !pageText().includes(t('now.silence')) && pageText().includes(t('now.fadingOut')), falling?.level)
  await silence()
  await nextTick()
  check('the bar shows silence when the fade-out ends', pageText().includes(t('now.silence')))

  // 5.3: with the fade switches off, a step starts and stops immediately.
  pressPlay(2)
  await plays(id(2))
  await wait(60)
  check('with Fade in off, the step starts at full level', near(voice(id(2))?.measured, 1, 0.02), f(voice(id(2))?.measured))
  pressStop(id(2))
  check('with Fade out off, the step stops immediately', await until(() => !engine.isAudible(), 150))

  // 5.2: a background step and a normal step play at the same time.
  pressPlay(0)
  await plays(id(0))
  pressPlay(1)
  await plays(id(1))
  await wait(550)
  check('a normal step starts and the background continues', stepState(id(0)) === 'playing' && stepState(id(1)) === 'playing' && near(voice(id(0))?.measured, 1, 0.02) && near(voice(id(1))?.measured, 1, 0.02), `${f(voice(id(0))?.measured)}, ${f(voice(id(1))?.measured)}`)
  setMode('show')
  await picture('09d-show-two-layers')
  check('the bar has one level meter for each sound', document.querySelectorAll('.levels .meter[role="meter"]').length === 2)
  setMode('edit')

  pressPlay(2)
  await plays(id(2))
  await wait(550)
  check('a normal step replaces the normal song, not the background', stepState(id(1)) === 'idle' && stepState(id(2)) === 'playing' && stepState(id(0)) === 'playing')
  setCursor(3)
  runCursor()
  await until(() => stepState(id(2)) === 'idle', 300)
  check('a stop step stops its step and no other sound', stepState(id(2)) === 'idle' && stepState(id(0)) === 'playing' && store.cursor === 4)

  // 5.1: the Stop button of a step stops that step only.
  pressPlay(1)
  await plays(id(1))
  setCursor(4)
  pressStop(id(1))
  check('the Stop button of a step stops that step only', stepState(id(1)) === 'fadingOut' && stepState(id(0)) === 'playing')
  check('the cursor stays on a stop step that has a sound to stop', store.cursor === 4, store.cursor)
  await until(() => stepState(id(1)) === 'idle', 1500)
  pressPlay(1)
  await plays(id(1))
  setCursor(4)
  runCursor()
  check('a stop step stops all the steps that you chose', stepState(id(0)) === 'fadingOut' && stepState(id(1)) === 'fadingOut' && (await silence()))

  pressPlay(1)
  await plays(id(1))
  setCursor(3)
  pressStop(id(1))
  check('after a stop by hand, the cursor skips each stop step that has nothing to stop', store.cursor === 5, store.cursor)
  await silence()
  // A stop step with a light cue stays: the lights must change there.
  setLightState(project.steps[3], settings.lightGroups[0].id, 'off')
  pressPlay(1)
  await plays(id(1))
  setCursor(3)
  pressStop(id(1))
  check('after a stop by hand, the cursor stays on a stop step that has a light cue', store.cursor === 3, store.cursor)
  await silence()
  setLightState(project.steps[3], settings.lightGroups[0].id, 'none')

  // Two background steps play together. Esc fades out all sound.
  pressPlay(0)
  await plays(id(0))
  pressPlay(5)
  await plays(id(5))
  await wait(550)
  check('a second background step does not stop the first one', stepState(id(0)) === 'playing' && stepState(id(5)) === 'playing' && near(voice(id(0))?.measured, 1, 0.02), f(voice(id(0))?.measured))
  setCursor(6)
  runCursor()
  check('a stop step below two backgrounds stops the nearest one', stepState(id(5)) === 'fadingOut' && stepState(id(0)) === 'playing')
  await until(() => stepState(id(5)) === 'idle', 1500)
  pressPlay(1)
  await plays(id(1))
  fadeOutMusic()
  check('Esc fades out all sound, the background included', stepState(id(0)) === 'fadingOut' && stepState(id(1)) === 'fadingOut' && (await silence()))

  await leaveProject()
}

function pressKey(key: string, options: KeyboardEventInit = {}): void {
  const target = document.activeElement ?? document.body
  const init = { key, code: key === ' ' ? 'Space' : key, bubbles: true, cancelable: true, ...options }
  target.dispatchEvent(new KeyboardEvent('keydown', init))
  target.dispatchEvent(new KeyboardEvent('keyup', init))
}

/** The keys of a show (5.1), through the keyboard handler of the Project screen. */
async function testKeys(): Promise<void> {
  const project = store.project
  if (!project) return
  const id = (index: number): string => project.steps[index].id
  setCursor(0)
  await nextTick()
  pressKey('ArrowDown')
  pressKey('ArrowDown')
  pressKey('ArrowUp')
  check('Up and Down move the cursor and run nothing', store.cursor === 1 && !engine.isAudible())

  setCursor(0)
  pressKey(' ')
  const started = await until(() => !!snap().playing?.started, 2000)
  check('the Space key runs the cursor step', started && stepState(id(0)) === 'playing')
  // 5.1: in Edit mode you start a song, then you write its trigger. The step stays selected.
  check('in Edit mode, the cursor stays on a song step that Space starts', store.cursor === 0, store.cursor)
  const heard = snap().playing?.time ?? 0
  pressKey(' ')
  await wait(100)
  check('a second Space on the step that plays moves the cursor down and does not start it again', store.cursor === 1 && stepState(id(0)) === 'playing' && (snap().playing?.time ?? 0) > heard, `cursor ${store.cursor}`)

  // Esc closes an open colour palette. It does not stop the music.
  const anyPalette = document.querySelector<HTMLElement>('.lights .palette')
  anyPalette?.showPopover()
  pressKey('Escape')
  await wait(50)
  check('Esc with an open colour palette does not stop the music', !!anyPalette && stepState(id(0)) === 'playing')
  anyPalette?.hidePopover()

  // In a text field, Space and Esc do not run.
  await nextTick()
  const title = document.getElementById('step-title') as HTMLInputElement | null
  title?.focus()
  pressKey(' ')
  await wait(50)
  check('Space in a text field does not run a step', store.cursor === 1 && document.activeElement === title)
  pressKey('Escape')
  await wait(50)
  check('Esc in a text field leaves the field and does not stop the music', document.activeElement !== title && stepState(id(0)) === 'playing')
  pressKey('Escape')
  check('the Esc key fades out the music', stepState(id(0)) === 'fadingOut' && (await silence()) && store.cursor === 1)

  // Space on a button that has the focus runs the cursor step, not the button.
  const stepsBefore = project.steps.length
  const add = document.querySelector<HTMLButtonElement>('.list .add')
  add?.focus()
  setCursor(1)
  pressKey(' ')
  await wait(50)
  check('Space on a button with the focus runs the cursor step, not the button', store.cursor === 2 && project.steps.length === stepsBefore)
  add?.blur()

  // Alt+Up and Alt+Down move the step, in Edit mode only.
  setCursor(1)
  const moved = id(1)
  pressKey('ArrowDown', { altKey: true })
  check('Alt+Down moves the selected step down', project.steps[2].id === moved && store.cursor === 2)
  pressKey('ArrowUp', { altKey: true })
  check('Alt+Up moves it back', project.steps[1].id === moved && store.cursor === 1)
  setMode('show')
  pressKey('ArrowDown', { altKey: true })
  check('Show mode locks the move of a step', project.steps[1].id === moved)
  setMode('edit')
  await flushSave()
}

/** Pictures of the show, on the sample project. */
async function testShowScreens(projectId: string): Promise<void> {
  await enterProject(projectId)
  await testKeys()
  const project4 = (): string => store.project?.steps[3].id ?? ''
  setCursor(0)
  document.querySelectorAll<HTMLButtonElement>('.list .play-btn:not(.stop-step-btn)')[2]?.click()
  await until(() => !!snap().playing?.started, 2000)
  check('in Edit mode, the Play button of a song step starts it and selects it', stepState(project4()) === 'playing' && store.cursor === 3, `cursor ${store.cursor}`)
  await wait(700)
  await picture('10-edit-playing')
  const bars = document.querySelectorAll<HTMLElement>('.step-progress div')
  check('the step that plays shows its progress', bars.length === 1 && !!bars[0].closest('.row.is-playing') && parseFloat(bars[0].style.width) > 0 && parseFloat(bars[0].style.width) < 5, bars[0]?.style.width)
  setMode('show')
  // In a show, the cursor is on the step below the one that plays.
  setCursor(4)
  await picture('11-show-playing')
  check('Show mode locks the edit panels', !document.querySelector('.editor') && !document.querySelector('.panel') && pageText().includes('Editarea este blocată'))
  check('Show mode names the step that Space runs next', pageText().includes('5 · Oprire muzică'))
  const large = document.querySelectorAll('.list .slot')
  check('Show mode shows the trigger and the light chips of a step', !!large[3]?.querySelector('.trigger.line')?.textContent?.includes('„Au sosit!”') && !!large[1]?.querySelector('.chips-large'))
  await window.api.app.selfTestResize(1440, 850)
  await picture('12-show-large-window')
  await window.api.app.selfTestResize(1280, 720)
  // The Stop button of a stop step runs that step with the mouse.
  const stopButton = document.querySelector<HTMLButtonElement>('.stop-step-btn')
  stopButton?.click()
  check('the Stop button of a stop step fades out the music and moves the cursor', !!stopButton && !somethingPlays() && store.cursor === 5 && (await silence()))
  await picture('13-show-silence')
  check('no step shows progress when no music plays', !document.querySelector('.step-progress'))
  setMode('edit')
  await leaveProject()
}

async function setOutputs(patch: { mainOutput?: string | null; previewOutput?: string | null }): Promise<void> {
  await updateSettings(patch)
  await refreshOutputs()
}

/** The output devices (8.2) and the preview (5.7). Silent: the main output is silent, and the step volume is 0. */
async function testOutputs(projectId: string): Promise<void> {
  const missing = 'Boxe care lipsesc'
  await refreshOutputs()
  const names = outputs.devices.map((device) => device.name)
  check('the app sees the output devices by name', names.length > 0, names.join(' | '))
  check('the default is "System default" and no preview', outputsView.mainIsDefault && settings.previewOutput === null && !outputsView.previewValid)
  if (names.length === 0) return
  const first = names[0]

  await enterProject(projectId)
  const project = store.project
  if (!project) return
  const id = (index: number): string => project.steps[index].id
  const firstSettings = activeSettings(project.steps[0])
  if (firstSettings) firstSettings.volume = 0

  // A named main output.
  await setOutputs({ mainOutput: first })
  check('a named main output that is connected can play', outputsView.mainConnected && !engineState.mainLost)
  setCursor(0)
  runCursor()
  await until(() => !!snap().playing?.started, 2000)
  check('the song plays on the named device', snap().context === 'running' && (engine.debugSnapshot().sink as string) === deviceByName(first)?.id, String(engine.debugSnapshot().sink).slice(0, 12))
  await wait(1200)
  const lostAt = snap().playing?.time ?? 0

  // 8.2: the main output is lost while a step plays.
  await setOutputs({ mainOutput: missing })
  check('a lost main output stops the music immediately', engineState.mainLost && engineState.sounds.length === 0 && !engine.isAudible())
  check('the step that played becomes interrupted, with its position', stepState(id(0)) === 'interrupted' && near(engineState.interrupted[0]?.position, lostAt, 0.2), `${f(engineState.interrupted[0]?.position)} for ${f(lostAt)}`)
  setMode('show')
  await picture('14-show-main-lost')
  setCursor(2)
  const flashes = engineState.flash
  runCursor()
  await wait(150)
  check('while the main output is lost, a run starts no song and the warning flashes', engineState.sounds.length === 0 && engineState.flash === flashes + 1 && store.cursor === 2)

  // 8.2: the main output returns. The app stays silent until Play.
  await setOutputs({ mainOutput: first })
  await wait(300)
  check('when the main output returns, the app stays silent', !engineState.mainLost && !engine.isAudible() && stepState(id(0)) === 'interrupted')
  await picture('15-show-interrupted')
  pressPlay(0)
  await until(() => !!snap().playing?.started, 2000)
  check('Play on the interrupted step continues from the position of the loss', stepState(id(0)) === 'playing' && near(snap().playing?.time, lostAt, 0.25) && engineState.interrupted.length === 0, `${f(snap().playing?.time)} for ${f(lostAt)}`)

  // Esc ends the interrupted state.
  await setOutputs({ mainOutput: missing })
  await setOutputs({ mainOutput: first })
  fadeOutMusic()
  check('Esc makes an interrupted step a normal step again', stepState(id(0)) === 'idle' && engineState.interrupted.length === 0)
  setMode('edit')

  // 5.7: when the preview output is valid.
  await setOutputs({ previewOutput: missing })
  check('a preview device that is not connected gives no preview', !outputsView.previewValid && !outputsView.previewConnected)
  togglePreviewStep(0)
  await wait(200)
  check('a Preview button does nothing without a valid preview output', previewState.key === null)
  openSettings()
  await picture('16-settings-devices')
  closeSettings()

  if (names.length < 2) {
    check('preview on a second device (this computer has one output device: not run)', true)
  } else {
    const second = names[1]
    await setOutputs({ mainOutput: null, previewOutput: second })
    check('with "System default" as main output, the preview stays off', !outputsView.previewValid)
    await setOutputs({ mainOutput: first, previewOutput: second })
    check('two different named devices make the preview valid', outputsView.previewValid)

    const cursor = store.cursor
    togglePreviewStep(0)
    const previewing = await until(() => previewState.key === `step:${id(0)}`, 2500)
    await wait(400)
    const state = debugPreview()
    check('a preview plays on the preview device only', previewing && state.sink === deviceByName(second)?.id && state.sink !== engine.debugSnapshot().sink && state.context === 'running', JSON.stringify(state).slice(0, 160))
    check('a preview moves in time', typeof state.time === 'number' && state.time > 0.2, String(state.time))
    check('a preview changes nothing in the show', store.cursor === cursor && engineState.sounds.length === 0 && stepState(id(0)) === 'idle')
    await picture('17-edit-previewing')
    togglePreviewStep(6)
    await until(() => previewState.key === `step:${id(6)}`, 2500)
    check('a new preview stops the old one', previewState.key === `step:${id(6)}`)
    togglePreviewStep(6)
    check('the Preview button stops its preview', previewState.key === null)

    // 5.7: with Loop on, a preview loops. With Loop off, it stops at the end point.
    const sixth = activeSettings(project.steps[6])
    if (sixth) Object.assign(sixth, { start: 1, end: 2.2, volume: 0 })
    togglePreviewStep(6)
    await until(() => previewState.key === `step:${id(6)}`, 2500)
    await wait(1700)
    const loopState = debugPreview()
    check('with Loop on, a preview starts again from the start point', previewState.key === `step:${id(6)}` && typeof loopState.time === 'number' && loopState.time >= 0.95 && loopState.time < 2.2 && loopState.paused === false, JSON.stringify(loopState).slice(0, 200))
    togglePreviewStep(6)
    if (sixth) sixth.loop = false
    togglePreviewStep(6)
    const onceStarted = await until(() => previewState.key === `step:${id(6)}`, 2500)
    check('with Loop off, a preview stops at the end point', onceStarted && (await until(() => previewState.key === null, 2500)))
    if (sixth) Object.assign(sixth, { start: null, end: null, volume: 100, loop: true })

    // 8.2: a change of the main output while music plays moves the music.
    await setOutputs({ previewOutput: null })
    pressPlay(2)
    await until(() => !!snap().playing?.started, 2000)
    await wait(300)
    const movedFrom = snap().playing?.time ?? 0
    await setOutputs({ mainOutput: second })
    await wait(400)
    const moved = snap().playing
    check('a change of the main output moves the music and does not stop it', stepState(id(2)) === 'playing' && !!moved && !moved.paused && moved.time > movedFrom + 0.2 && engine.debugSnapshot().sink === deviceByName(second)?.id, `${f(movedFrom)} → ${f(moved?.time)}`)
    fadeOutMusic()
    await silence()
    await setOutputs({ mainOutput: first, previewOutput: second })

    // A preview and the show at the same time, on two devices.
    pressPlay(2)
    await until(() => !!snap().playing?.started, 2000)
    togglePreviewStep(0)
    await until(() => previewState.key !== null, 2500)
    await wait(300)
    check('the show and a preview play at the same time, on two devices', stepState(id(2)) === 'playing' && !snap().playing?.paused && debugPreview().paused === false)

    // 8.2: the preview device is lost. The show continues.
    await setOutputs({ previewOutput: missing })
    check('a lost preview device stops the preview, not the show', previewState.key === null && stepState(id(2)) === 'playing' && !outputsView.previewValid)
    fadeOutMusic()
    await silence()
    await setOutputs({ previewOutput: second })
    check('when the preview device returns, the preview does not start by itself', outputsView.previewValid && previewState.key === null)

    // Listen on the waveform (5.4).
    setCursor(0)
    await wait(600)
    const listen = document.querySelector<HTMLButtonElement>('.btn-preview')
    listen?.click()
    const listening = await until(() => previewState.key === 'listen', 2500)
    await wait(300)
    check('Listen plays the waveform on the preview device', listening && debugPreview().sink === deviceByName(second)?.id && debugPreview().paused === false, JSON.stringify(debugPreview()).slice(0, 160))
    listen?.click()
    check('Listen stops on a second press', previewState.key === null)

    void togglePreviewSong
  }

  if (firstSettings) firstSettings.volume = 100
  touch()
  await setOutputs({ mainOutput: null, previewOutput: null })
  await leaveProject()
}

/** Export and import (section 7), without the file dialogs. */
async function testArchive(projectId: string): Promise<void> {
  // A new name of a group, with no project open: the project file still has the old name.
  const stage = settings.lightGroups.find((group) => group.name === 'Scenă')
  if (stage) await changeLightGroup(stage.id, { name: 'Scenă mare' })
  const file = await window.api.app.selfTestExport(projectId)
  check('export writes one .sunetsimplu file', file.endsWith('.sunetsimplu'))
  // A different computer does not have the group "Scenă mare".
  await updateSettings({ lightGroups: settings.lightGroups.filter((group) => group.id !== stage?.id) })
  check('(the test removed one light group from the settings)', settings.lightGroups.length === 2)
  const result = await window.api.app.selfTestImport(file)
  check('import makes a new project', result.status === 'done' && result.project.id !== projectId, JSON.stringify(result).slice(0, 200))
  if (result.status !== 'done') return
  check('an import never replaces a project: a used name gets a number', result.project.name === 'Livada de vișini (2)', result.project.name)
  check('the import has the steps and the songs', result.project.stepCount === 7 && result.project.songCount === 3)

  await enterProject(result.project.id)
  const project = store.project
  const kept = project ? activeSettings(project.steps[3]) : null
  check('the import keeps the settings of a step', kept?.start === 12 && kept?.end === 160 && kept?.continue === true)
  check('the import keeps the fade times of a step', kept?.fadeInTime === null && kept?.fadeOutTime === 1.5, `${kept?.fadeInTime} / ${kept?.fadeOutTime}`)
  check('the import keeps the trigger and the light cues of a step', project?.steps[3].trigger.lineText === 'Au sosit!' && project.steps[3].trigger.action === true && project.steps[1].lights.length === 2 && project.steps[5].lights[0]?.color === '#dcebff')
  const adopted = settings.lightGroups.find((group) => group.id === stage?.id)
  check('the export carries the light groups as the settings had them', adopted?.name === 'Scenă mare', adopted?.name)
  check('a project brings its unknown light groups to the settings of the computer', settings.lightGroups.length === 3 && adopted?.icon === 'mdiSpotlightBeam' && (await window.api.settings.get()).lightGroups.length === 3, settings.lightGroups.map((group) => group.name).join())
  setMode('show')
  await picture('17b-show-imported-lights')
  check('the steps of the import show their light chips', document.querySelectorAll('.list .slot')[1]?.querySelector('.chips')?.textContent?.includes('Scenă mare') === true)
  setMode('edit')
  const loaded = project?.songs.every((song) => !!store.media[song.id]?.url && (store.media[song.id]?.peaks?.length ?? 0) > 100)
  check('the import has the audio files and the waveforms', loaded === true)
  setCursor(3)
  runCursor()
  check('a song of the imported project plays', await until(() => !!snap().playing?.started, 2000))
  fadeOutMusic()
  await silence()
  await leaveProject()

  const invalid = await window.api.app.selfTestImport('invalid')
  check('the app refuses a file that is not a project', invalid.status === 'invalid', invalid.status)
  const list = await window.api.projects.list()
  check('a refused import adds no project', list.filter((item) => item.name.startsWith('Livada')).length === 2, list.map((item) => item.name).join(' | '))
  await wait(300)
  await picture('18-projects-final')
}

export async function runSelfTest(): Promise<Record<string, unknown>> {
  try {
    await window.api.app.selfTestResize(1280, 720)
    await testLanguages()
    const projectId = await testProjects()
    await testLightGroups()
    await testEditMode(projectId)
    await leaveProject()
    await testSound()
    await testLayers()
    await testShowScreens(projectId)
    await testOutputs(projectId)
    await testArchive(projectId)
  } catch (error) {
    check('the self-test ran to its end', false, error instanceof Error ? `${error.message}\n${error.stack}` : error)
  }
  const failed = checks.filter((item) => !item.pass)
  return { passed: checks.length - failed.length, failed: failed.length, failures: failed, checks: checks.map((item) => `${item.pass ? 'ok  ' : 'FAIL'} ${item.name}${item.detail ? ` [${item.detail}]` : ''}`) }
}

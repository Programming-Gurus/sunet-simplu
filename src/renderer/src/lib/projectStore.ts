// The open project: its data, its songs in memory, and the edit operations (DESIGN.md, section 4).
// The app saves each change immediately. There is no Save button.

import { reactive } from 'vue'
import { unknownLightGroups, usedLightGroups } from '@shared/lights'
import { newStep, removeSong, setStepKind, stepsUsingSong } from '@shared/project'
import type { Project, Song, Step, StepKind } from '@shared/types'
import { analyseAudio, audioBlob, canPlay, extensionOf } from './audioFiles'
import { alertDialog, confirmDialog } from './dialogs'
import { t } from './i18n'
import { settings, updateSettings } from './settings'
import { showError } from './toasts'

export type Mode = 'edit' | 'show'

/** A song in memory. The app loads all songs when the project opens (5.8). */
export interface SongMedia {
  /** `null` if the file is missing from the project. */
  url: string | null
  peaks: number[] | null
}

export const store = reactive({
  project: null as Project | null,
  mode: 'edit' as Mode,
  /** The index of the cursor step. It equals the number of steps after the last step ran. */
  cursor: 0,
  loading: null as { done: number; total: number } | null,
  media: {} as Record<string, SongMedia>,
  /** Names of the files that the app adds at this moment. */
  adding: [] as string[],
})

// --- Save ---

let saveTimer: ReturnType<typeof setTimeout> | undefined
let dirty = false
let saving: Promise<void> = Promise.resolve()

/** Call after each change to the project. */
export function touch(): void {
  if (!store.project) return
  // The project file holds a copy of the light groups that its steps use (section 7). The settings win.
  store.project.lightGroups = usedLightGroups(store.project.steps, [...settings.lightGroups, ...store.project.lightGroups])
  store.project.updatedAt = new Date().toISOString()
  dirty = true
  clearTimeout(saveTimer)
  saveTimer = setTimeout(() => void flushSave(), 300)
}

export function flushSave(): Promise<void> {
  clearTimeout(saveTimer)
  if (!dirty || !store.project) return saving
  dirty = false
  // A plain copy: the reactive project cannot cross to the main process.
  const snapshot = JSON.parse(JSON.stringify(store.project)) as Project
  saving = saving.then(() => window.api.projects.save(snapshot)).catch(showError)
  return saving
}

// --- Open and close ---

async function loadMedia(projectId: string, song: Song): Promise<SongMedia> {
  const [bytes, peaks] = await Promise.all([
    window.api.songs.read(projectId, song.file),
    window.api.songs.readPeaks(projectId, song.id),
  ])
  if (!bytes) return { url: null, peaks }
  const extension = extensionOf(song.file) ?? ''
  return { url: URL.createObjectURL(audioBlob(bytes as Uint8Array<ArrayBuffer>, extension)), peaks }
}

function releaseMedia(): void {
  for (const media of Object.values(store.media)) {
    if (media.url) URL.revokeObjectURL(media.url)
  }
  store.media = {}
}

/** Reads a project and loads all its songs. Returns `false` if the project is not on the disk. */
export async function loadProject(id: string): Promise<boolean> {
  const project = await window.api.projects.read(id)
  if (!project) return false
  // A project from a different computer brings its light groups. They go to the settings of this one (8.3).
  const unknown = unknownLightGroups(project.lightGroups, settings.lightGroups)
  if (unknown.length > 0) await updateSettings({ lightGroups: [...settings.lightGroups, ...unknown] })
  releaseMedia()
  store.project = project
  store.mode = 'edit'
  store.cursor = 0
  store.adding = []
  store.loading = { done: 0, total: project.songs.length }
  for (const song of project.songs) {
    const media = await loadMedia(id, song)
    // The user can leave while the songs load.
    if (store.project?.id !== id) {
      if (media.url) URL.revokeObjectURL(media.url)
      return true
    }
    store.media[song.id] = media
    store.loading.done++
  }
  store.loading = null
  return true
}

export async function unloadProject(): Promise<void> {
  await flushSave()
  store.project = null
  store.loading = null
  store.cursor = 0
  store.mode = 'edit'
  releaseMedia()
}

// --- Steps (4.2) ---

function steps(): Step[] {
  return store.project?.steps ?? []
}

export function songOf(step: Step | null | undefined): Song | null {
  if (!step || step.kind !== 'song' || !step.songId) return null
  return store.project?.songs.find((song) => song.id === step.songId) ?? null
}

/** In Edit mode, the cursor step is the selected step. */
export function selectedStep(): Step | null {
  return steps()[store.cursor] ?? null
}

export function setCursor(index: number): void {
  store.cursor = Math.min(steps().length, Math.max(0, index))
}

/** Adds a note step at `index`, or at the end. The new step becomes the selected step. */
export function addStep(index?: number): Step | null {
  if (!store.project) return null
  const at = index === undefined ? steps().length : Math.min(steps().length, Math.max(0, index))
  const step = newStep(crypto.randomUUID())
  store.project.steps.splice(at, 0, step)
  store.cursor = at
  touch()
  return store.project.steps[at]
}

export function duplicateStep(index: number): void {
  const source = steps()[index]
  if (!store.project || !source) return
  const copy = JSON.parse(JSON.stringify(source)) as Step
  copy.id = crypto.randomUUID()
  store.project.steps.splice(index + 1, 0, copy)
  store.cursor = index + 1
  touch()
}

export function deleteStep(index: number): void {
  if (!store.project || !steps()[index]) return
  store.project.steps.splice(index, 1)
  store.cursor = Math.max(0, Math.min(store.cursor > index ? store.cursor - 1 : store.cursor, steps().length - 1))
  touch()
}

/** Moves a step. The cursor stays on the step that it was on. */
export function moveStep(from: number, to: number): void {
  if (!store.project) return
  const list = store.project.steps
  const target = Math.min(list.length - 1, Math.max(0, to))
  if (!list[from] || from === target) return
  const cursorId = list[store.cursor]?.id
  const [step] = list.splice(from, 1)
  list.splice(target, 0, step)
  if (cursorId) store.cursor = list.findIndex((item) => item.id === cursorId)
  touch()
}

/** Sets what a step is (4.3). */
export function setKind(index: number, kind: StepKind, songId: string | null = null): void {
  const step = steps()[index]
  if (!step) return
  if (step.kind === kind && step.songId === (kind === 'song' ? songId : null)) return
  setStepKind(step, kind, songId)
  touch()
}

// --- Songs (section 6) ---

function uniqueSongName(name: string): string {
  const names = new Set(store.project?.songs.map((song) => song.name))
  if (!names.has(name)) return name
  const dot = name.lastIndexOf('.')
  const base = dot > 0 ? name.slice(0, dot) : name
  const extension = dot > 0 ? name.slice(dot) : ''
  for (let n = 2; ; n++) {
    const candidate = `${base} (${n})${extension}`
    if (!names.has(candidate)) return candidate
  }
}

async function addSongFile(file: File): Promise<void> {
  const project = store.project
  if (!project) return
  const refuse = (): Promise<void> =>
    alertDialog({ title: t('kind.cannotPlay', { name: file.name }), confirm: t('common.ok') })
  const extension = extensionOf(file.name)
  if (!extension) return refuse()

  store.adding.push(file.name)
  let url: string | null = null
  try {
    const bytes = await file.arrayBuffer()
    const analysis = await analyseAudio(bytes)
    url = URL.createObjectURL(audioBlob(bytes, extension))
    if (!(await canPlay(url))) throw new Error('The audio element refused the file')
    const id = crypto.randomUUID()
    const stored = await window.api.songs.add(project.id, id, extension, new Uint8Array(bytes), analysis.peaks)
    if (store.project !== project) throw new Error('The project closed')
    project.songs.push({ id, name: uniqueSongName(file.name), file: stored, duration: analysis.duration })
    store.media[id] = { url, peaks: analysis.peaks }
    url = null
    touch()
  } catch {
    if (store.project === project) await refuse()
  } finally {
    if (url) URL.revokeObjectURL(url)
    const index = store.adding.indexOf(file.name)
    if (index >= 0) store.adding.splice(index, 1)
  }
}

/** Copies audio files into the project. Refuses a file that the app cannot play. */
export async function addSongFiles(files: File[]): Promise<void> {
  if (store.mode !== 'edit') return
  for (const file of files) await addSongFile(file)
}

/** Deletes a song, unless a step uses it. Returns `true` if the song is gone. */
export async function deleteSong(song: Song): Promise<boolean> {
  const project = store.project
  if (!project) return false
  const users = stepsUsingSong(project.steps, song.id)
  if (users.length > 0) {
    await alertDialog({
      title: t('kind.songUsedTitle'),
      body: t(users.length === 1 ? 'kind.songUsedOne' : 'kind.songUsedMany', { name: song.name, list: users.join(', ') }),
      confirm: t('common.ok'),
    })
    return false
  }
  const confirmed = await confirmDialog({
    title: t('kind.deleteSongTitle', { name: song.name }),
    body: t('kind.deleteSongBody'),
    confirm: t('kind.deleteSongConfirm'),
    danger: true,
  })
  if (!confirmed || store.project !== project) return false
  try {
    await window.api.songs.remove(project.id, song.id, song.file)
  } catch (error) {
    showError(error)
    return false
  }
  removeSong(project, song.id)
  const media = store.media[song.id]
  if (media?.url) URL.revokeObjectURL(media.url)
  delete store.media[song.id]
  touch()
  return true
}

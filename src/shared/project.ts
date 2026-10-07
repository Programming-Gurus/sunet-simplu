// The rules of a project that do not need sound or a screen.
// The section numbers refer to DESIGN.md.

import { isValidId } from './ids'
import { normalizeLightCues, normalizeLightGroups, usedLightGroups } from './lights'
import type { Project, Song, SongSettings, Step, StepKind, Trigger } from './types'

export { isValidId }

export const FADE_MIN = 0
export const FADE_MAX = 300
/** A new project fades in slowly and fades out a little faster. */
export const DEFAULT_FADE_IN = 10
export const DEFAULT_FADE_OUT = 5
/** The end point is at least this many seconds after the start point (5.4). */
export const MIN_PART = 1
/** A point this near to an end of the file is that end of the file. */
const NATURAL_TOLERANCE = 0.05

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

/** A fade time: 0–300 s, in steps of 0.1 s (5.3). */
export function roundFade(value: number, fallback = DEFAULT_FADE_IN): number {
  if (!Number.isFinite(value)) return fallback
  return Math.round(clamp(value, FADE_MIN, FADE_MAX) * 10) / 10
}

export function defaultSongSettings(): SongSettings {
  return {
    start: null,
    end: null,
    limit: null,
    volume: 100,
    loop: true,
    continue: false,
    fadesIn: true,
    fadesOut: true,
    fadeInTime: null,
    fadeOutTime: null,
    background: false,
  }
}

/** The fade times of a song step (5.3): its own times, or the times of the project. */
export function stepFades(settings: SongSettings, project: Pick<Project, 'fadeIn' | 'fadeOut'>): { fadeIn: number; fadeOut: number } {
  return { fadeIn: settings.fadeInTime ?? project.fadeIn, fadeOut: settings.fadeOutTime ?? project.fadeOut }
}

/** The longest text of a line or of an action. */
export const TRIGGER_TEXT_MAX = 500

/** Most of the time a line triggers a step, so a new step has Line on (4.4). */
export function defaultTrigger(): Trigger {
  return { line: true, lineText: '', action: false, actionText: '' }
}

/** The line that triggers a step, or '' if Line is off or has no text. */
export function triggerLine(step: Pick<Step, 'trigger'>): string {
  return step.trigger.line ? step.trigger.lineText.trim() : ''
}

/** The action that triggers a step, or '' if Action is off or has no text. */
export function triggerAction(step: Pick<Step, 'trigger'>): string {
  return step.trigger.action ? step.trigger.actionText.trim() : ''
}

/** A new step is a note step (4.2). */
export function newStep(id: string): Step {
  return { id, kind: 'note', title: '', trigger: defaultTrigger(), notes: '', lights: [], songId: null, songSettings: {}, stops: [] }
}

export function newProject(id: string, name: string, now: string): Project {
  return {
    formatVersion: 1,
    id,
    name,
    fadeIn: DEFAULT_FADE_IN,
    fadeOut: DEFAULT_FADE_OUT,
    songs: [],
    steps: [],
    lightGroups: [],
    createdAt: now,
    updatedAt: now,
  }
}

/** The part of a song that a song step plays (5.4), with all values resolved. */
export interface Part {
  start: number
  end: number
  limit: number
  /** The start point is the beginning of the file. */
  naturalStart: boolean
  /** The end point is the end of the file. */
  naturalEnd: boolean
}

export function partOf(settings: SongSettings, duration: number): Part {
  const length = Math.max(0, duration)
  const minPart = Math.min(MIN_PART, length)
  const start = clamp(settings.start ?? 0, 0, length - minPart)
  const end = clamp(settings.end ?? length, start + minPart, length)
  const limit = clamp(settings.limit ?? (start + end) / 2, start, end)
  return {
    start,
    end,
    limit,
    naturalStart: start <= NATURAL_TOLERANCE,
    naturalEnd: end >= length - NATURAL_TOLERANCE,
  }
}

/** The value to store for a start point. The beginning of the file is `null`. */
export function startValue(seconds: number, end: number): number | null {
  const start = clamp(seconds, 0, Math.max(0, end - MIN_PART))
  return start <= NATURAL_TOLERANCE ? null : round3(start)
}

/** The value to store for an end point. The end of the file is `null`. */
export function endValue(seconds: number, start: number, duration: number): number | null {
  const end = clamp(seconds, Math.min(duration, start + MIN_PART), duration)
  return end >= duration - NATURAL_TOLERANCE ? null : round3(end)
}

export function limitValue(seconds: number, start: number, end: number): number {
  return round3(clamp(seconds, start, end))
}

function round3(value: number): number {
  return Math.round(value * 1000) / 1000
}

/** The song settings that a song step uses now, or `null` for the other kinds. */
export function activeSettings(step: Step): SongSettings | null {
  if (step.kind !== 'song' || !step.songId) return null
  return step.songSettings[step.songId] ?? null
}

/** Continue is available only if a step above uses the same song (5.6). */
export function continueAvailable(steps: Step[], index: number): boolean {
  const step = steps[index]
  if (!step || step.kind !== 'song' || !step.songId) return false
  for (let i = 0; i < index; i++) {
    const other = steps[i]
    if (other.kind === 'song' && other.songId === step.songId) return true
  }
  return false
}

/**
 * The position where a song step starts (5.6).
 * `remembered` is the position where the song last stopped on the main output.
 */
export function resolveStart(part: Part, useContinue: boolean, remembered: number | undefined): number {
  if (!useContinue || remembered === undefined) return part.start
  if (remembered > part.limit) return part.start
  if (remembered < part.start) return part.start
  return remembered
}

/** The song steps above a step, nearest first. A stop step can stop these steps (5.2). */
export function stopCandidates(steps: Step[], index: number): Step[] {
  const above: Step[] = []
  for (let i = Math.min(index, steps.length) - 1; i >= 0; i--) {
    if (steps[i].kind === 'song' && steps[i].songId) above.push(steps[i])
  }
  return above
}

/** True if the user chose what a stop step stops, and a chosen step is above it. */
export function stopsChosen(steps: Step[], index: number): boolean {
  const step = steps[index]
  if (!step || step.kind !== 'stop') return false
  return stopCandidates(steps, index).some((candidate) => step.stops.includes(candidate.id))
}

/**
 * The ids of the steps that a stop step stops (5.2), nearest first.
 * Without a choice, this is the nearest song step above it.
 */
export function stopTargets(steps: Step[], index: number): string[] {
  const step = steps[index]
  if (!step || step.kind !== 'stop') return []
  const candidates = stopCandidates(steps, index)
  const chosen = candidates.filter((candidate) => step.stops.includes(candidate.id))
  if (chosen.length > 0) return chosen.map((candidate) => candidate.id)
  return candidates.length > 0 ? [candidates[0].id] : []
}

/** Sets if a stop step stops one song step above it. With no step left, the default returns. */
export function setStopTarget(steps: Step[], index: number, targetId: string, on: boolean): void {
  const step = steps[index]
  if (!step || step.kind !== 'stop') return
  const targets = new Set(stopTargets(steps, index))
  if (on) targets.add(targetId)
  else targets.delete(targetId)
  step.stops = stopCandidates(steps, index)
    .filter((candidate) => targets.has(candidate.id))
    .map((candidate) => candidate.id)
}

/** If the part is shorter than the two fades together, both fades shorten to fit (5.4). */
export function effectiveFades(length: number, fadeIn: number, fadeOut: number): { fadeIn: number; fadeOut: number } {
  const total = fadeIn + fadeOut
  if (total <= 0 || length >= total) return { fadeIn, fadeOut }
  const scale = Math.max(0, length) / total
  return { fadeIn: fadeIn * scale, fadeOut: fadeOut * scale }
}

/**
 * Set what a step is (4.3). The step keeps its settings for each song that it had.
 * A song that the step has for the first time gets the default settings.
 */
export function setStepKind(step: Step, kind: StepKind, songId: string | null = null): void {
  if (kind === 'song' && songId) {
    step.kind = 'song'
    step.songId = songId
    if (!step.songSettings[songId]) step.songSettings[songId] = defaultSongSettings()
    return
  }
  step.kind = kind === 'stop' ? 'stop' : 'note'
  step.songId = null
}

/** The numbers (from 1) of the steps that use a song. Kept settings do not count (4.3). */
export function stepsUsingSong(steps: Step[], songId: string): number[] {
  const numbers: number[] = []
  steps.forEach((step, index) => {
    if (step.kind === 'song' && step.songId === songId) numbers.push(index + 1)
  })
  return numbers
}

/** Remove a song and the settings that steps kept for it. The caller checks that no step uses it. */
export function removeSong(project: Project, songId: string): void {
  project.songs = project.songs.filter((song) => song.id !== songId)
  for (const step of project.steps) delete step.songSettings[songId]
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function text(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value : fallback
}

function timeOrNull(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : null
}

/** A fade time of a step. A file without one follows the project. */
function fadeOrNull(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? roundFade(value) : null
}

const FILE_PATTERN = /^[A-Za-z0-9-]{1,64}\.[a-z0-9]{1,5}$/

export function isValidAudioFile(value: unknown): value is string {
  return typeof value === 'string' && FILE_PATTERN.test(value)
}

function normalizeSettings(raw: unknown): SongSettings {
  const source = isRecord(raw) ? raw : {}
  const volume = typeof source.volume === 'number' && Number.isFinite(source.volume) ? source.volume : 100
  return {
    start: timeOrNull(source.start),
    end: timeOrNull(source.end),
    limit: timeOrNull(source.limit),
    volume: Math.round(clamp(volume, 0, 100)),
    loop: source.loop !== false,
    continue: source.continue === true,
    // A project from before these switches fades as it did, on one layer.
    fadesIn: source.fadesIn !== false,
    fadesOut: source.fadesOut !== false,
    // A project from before the fade times of a step follows the times of the project.
    fadeInTime: fadeOrNull(source.fadeInTime),
    fadeOutTime: fadeOrNull(source.fadeOutTime),
    background: source.background === true,
  }
}

/**
 * The title and the trigger of a step from a file (4.4).
 * A step from before the triggers has no trigger. Its title was the line, so the title becomes the line.
 */
function readTitleAndTrigger(item: Record<string, unknown>): { title: string; trigger: Trigger } {
  const title = text(item.title)
  if (!isRecord(item.trigger)) return { title: '', trigger: { ...defaultTrigger(), lineText: title.slice(0, TRIGGER_TEXT_MAX) } }
  const source = item.trigger
  return {
    title,
    trigger: {
      line: source.line !== false,
      lineText: text(source.lineText).slice(0, TRIGGER_TEXT_MAX),
      action: source.action === true,
      actionText: text(source.actionText).slice(0, TRIGGER_TEXT_MAX),
    },
  }
}

/**
 * Read project data from a file that the app did not control (disk, import).
 * Returns `null` if the data is not a project. Repairs what it can.
 */
export function normalizeProject(raw: unknown): Project | null {
  if (!isRecord(raw) || !isValidId(raw.id) || !Array.isArray(raw.songs) || !Array.isArray(raw.steps)) return null

  const songs: Song[] = []
  for (const item of raw.songs) {
    if (!isRecord(item) || !isValidId(item.id) || !isValidAudioFile(item.file)) continue
    if (songs.some((song) => song.id === item.id)) continue
    const duration = typeof item.duration === 'number' && Number.isFinite(item.duration) ? Math.max(0, item.duration) : 0
    songs.push({ id: item.id, name: text(item.name, item.file), file: item.file, duration })
  }
  const songIds = new Set(songs.map((song) => song.id))
  const lightGroups = normalizeLightGroups(raw.lightGroups)
  const lightGroupIds = new Set(lightGroups.map((group) => group.id))

  const steps: Step[] = []
  for (const item of raw.steps) {
    if (!isRecord(item) || !isValidId(item.id)) continue
    if (steps.some((step) => step.id === item.id)) continue
    const songSettings: Record<string, SongSettings> = {}
    if (isRecord(item.songSettings)) {
      for (const [songId, settings] of Object.entries(item.songSettings)) {
        if (songIds.has(songId)) songSettings[songId] = normalizeSettings(settings)
      }
    }
    const stops = Array.isArray(item.stops) ? item.stops.filter(isValidId) : []
    const step: Step = {
      id: item.id,
      kind: 'note',
      ...readTitleAndTrigger(item),
      notes: text(item.notes),
      lights: normalizeLightCues(item.lights, lightGroupIds),
      songId: null,
      songSettings,
      stops,
    }
    if (item.kind === 'stop') step.kind = 'stop'
    if (item.kind === 'song' && typeof item.songId === 'string' && songIds.has(item.songId)) {
      setStepKind(step, 'song', item.songId)
    }
    steps.push(step)
  }
  // A stop step keeps only the steps that are in the project.
  const stepIds = new Set(steps.map((step) => step.id))
  for (const step of steps) step.stops = [...new Set(step.stops)].filter((id) => stepIds.has(id) && id !== step.id)

  const now = new Date().toISOString()
  return {
    formatVersion: 1,
    id: raw.id,
    name: text(raw.name).trim() || 'Sunet Simplu',
    fadeIn: roundFade(typeof raw.fadeIn === 'number' ? raw.fadeIn : DEFAULT_FADE_IN, DEFAULT_FADE_IN),
    fadeOut: roundFade(typeof raw.fadeOut === 'number' ? raw.fadeOut : DEFAULT_FADE_OUT, DEFAULT_FADE_OUT),
    songs,
    steps,
    // The file holds only the groups that a step uses.
    lightGroups: usedLightGroups(steps, lightGroups),
    createdAt: text(raw.createdAt, now),
    updatedAt: text(raw.updatedAt, now),
  }
}

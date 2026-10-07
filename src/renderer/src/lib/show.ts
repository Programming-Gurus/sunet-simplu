// Run a show (DESIGN.md, section 5): the cursor, Play, Stop, Space and Esc.

import { reactive } from 'vue'
import { activeSettings, clamp, continueAvailable, partOf, resolveStart, stepFades, stopTargets, type Part } from '@shared/project'
import type { Step } from '@shared/types'
import * as engine from './engine'
import { engineState, type PlayRequest } from './engine'
import { outputsView } from './outputs'
import * as preview from './preview'
import { previewState } from './preview'
import { setCursor, songOf, store } from './projectStore'

export type StepState = 'idle' | 'playing' | 'fadingOut' | 'interrupted'

/** What the screens need to know about the sound. */
export const engineView = reactive({
  /** The step whose missing file was run. Its warning flashes. */
  missingFlash: { stepId: '', count: 0 },
})

/** The position where an interrupted step lost the main output, in seconds. */
export function interruptedAt(stepId: string): number {
  return engineState.interrupted.find((item) => item.stepId === stepId)?.position ?? 0
}

/** The state of a song step. Its one button follows this state (5.2). */
export function stepState(stepId: string): StepState {
  // A step can fade out and play again at the same time. The newest sound gives the state.
  const sound = engineState.sounds.findLast((item) => item.stepId === stepId)
  if (sound) return sound.fadingOut ? 'fadingOut' : 'playing'
  if (engineState.interrupted.some((item) => item.stepId === stepId)) return 'interrupted'
  return 'idle'
}

/** True if a sound plays and does not fade out. */
export function somethingPlays(): boolean {
  return engineState.sounds.some((sound) => !sound.fadingOut)
}

/** Up and Down move the cursor. They run nothing. */
export function moveCursor(delta: number): void {
  const count = store.project?.steps.length ?? 0
  if (count === 0) return
  setCursor(clamp(store.cursor + delta, 0, count - 1))
}

/** The fade-out time of a step at this moment: its own time, or the time of the project (5.3). */
function fadeOutOf(stepId: string): number {
  const project = store.project
  if (!project) return 0
  const step = project.steps.find((item) => item.id === stepId)
  const settings = step ? activeSettings(step) : null
  return settings ? stepFades(settings, project).fadeOut : project.fadeOut
}

function requestFor(step: Step, index: number): PlayRequest | null {
  const project = store.project
  const song = songOf(step)
  const settings = activeSettings(step)
  const url = song ? store.media[song.id]?.url : null
  if (!project || !song || !settings || !url) return null
  const part = partOf(settings, song.duration)
  const fades = stepFades(settings, project)

  let startAt: number
  let loopCount = 0
  const interrupted = engineState.interrupted.find((item) => item.stepId === step.id)
  if (interrupted) {
    // Play on the interrupted step continues from the position of the loss (5.2).
    startAt = interrupted.position
    loopCount = interrupted.loopCount
  } else {
    const useContinue = settings.continue && continueAvailable(project.steps, index)
    startAt = resolveStart(part, useContinue, engine.rememberedPosition(song.id))
  }
  // Leave a moment of sound before the end point, also if the points moved after the stop.
  if (startAt < part.start || startAt > part.end - 0.05) startAt = part.start

  return {
    stepId: step.id,
    songId: song.id,
    url,
    start: part.start,
    end: part.end,
    naturalStart: part.naturalStart,
    naturalEnd: part.naturalEnd,
    startAt,
    volume: settings.volume,
    loop: settings.loop,
    fadeIn: fades.fadeIn,
    fadeOut: fades.fadeOut,
    fadesIn: settings.fadesIn,
    fadesOut: settings.fadesOut,
    background: settings.background,
    loopCount,
  }
}

/**
 * Does what a step says (5.2), then moves the cursor to the step below it.
 * The cursor stays if the main output is lost: the step did not run.
 * In Edit mode, the cursor goes to a song step that starts, and stays there (5.1).
 */
export function runStep(index: number): void {
  const project = store.project
  const step = project?.steps[index]
  if (!project || !step) return

  if (step.kind === 'stop') {
    // A stop step fades out the steps that it names, not all sound (5.2).
    engine.stopSteps(stopTargets(project.steps, index), fadeOutOf)
  } else if (step.kind === 'song') {
    const state = stepState(step.id)
    // A step that plays or fades out cannot start again. Nothing changes in the sound.
    if (state === 'idle' || state === 'interrupted') {
      if (engineState.mainLost) {
        engine.refuse()
        return
      }
      const request = requestFor(step, index)
      if (request) {
        void engine.play(request, fadeOutOf)
        // In Edit mode you start a song, then you write its trigger. That step is the selected step.
        if (store.mode === 'edit') {
          setCursor(index)
          return
        }
      } else {
        // The file is missing: the sound does not change and the warning flashes (5.8).
        engineView.missingFlash = { stepId: step.id, count: engineView.missingFlash.count + 1 }
      }
    }
  }
  setCursor(index + 1)
}

/** The Play button of a song step, and the Stop button of a stop step: run that step. */
export function pressPlay(index: number): void {
  runStep(index)
}

/**
 * After a stop by hand, a stop step at the cursor can have nothing left to stop.
 * The cursor then goes to the first step below it that is not such a stop step (5.1).
 * A stop step with a light cue stays: the lights must change there.
 */
function skipIdleStopSteps(): void {
  const project = store.project
  if (!project) return
  let index = store.cursor
  while (
    project.steps[index]?.kind === 'stop' &&
    project.steps[index].lights.length === 0 &&
    !stopTargets(project.steps, index).some((stepId) => stepState(stepId) === 'playing')
  ) {
    index++
  }
  setCursor(index)
}

/** The Stop button of a step that plays: fades out that step only. */
export function pressStop(stepId: string): void {
  if (store.project && engine.stopSteps([stepId], fadeOutOf)) skipIdleStopSteps()
}

/** Space: run the cursor step. After the last step, Space does nothing. */
export function runCursor(): void {
  if (store.project && store.cursor < store.project.steps.length) runStep(store.cursor)
}

/** Esc: fade out all sound, the background included. */
export function fadeOutMusic(): void {
  if (store.project && engine.stopAll(fadeOutOf)) skipIdleStopSteps()
}

/** A change to the volume of a step is heard immediately if the step plays. */
export function applyStepVolume(stepId: string, percent: number): void {
  engine.setStepVolume(stepId, percent)
}

// --- Preview (5.7) ---

/** All Preview and Listen buttons are disabled unless the preview output is valid. */
export function previewAvailable(): boolean {
  return outputsView.previewValid
}

export function isPreviewing(key: string): boolean {
  return previewState.key === key
}

/** The seconds that the preview of a step played. */
export function previewElapsed(): number {
  return Math.max(0, previewState.position - previewState.from)
}

/** A preview loops if Loop is on for the step (5.7). The jump is a cut unless both points are natural. */
function previewLoop(loop: boolean, part: Part): preview.PreviewLoop | null {
  return loop ? { start: part.start, cut: !(part.naturalStart && part.naturalEnd) } : null
}

/** The Preview button of a song step: from its start point to its end point, with its volume. */
export function togglePreviewStep(index: number): void {
  const step = store.project?.steps[index]
  const song = songOf(step)
  const settings = step ? activeSettings(step) : null
  const url = song ? store.media[song.id]?.url : null
  if (!step || !song || !settings || !url || !previewAvailable()) return
  const part = partOf(settings, song.duration)
  preview.togglePreview(`step:${step.id}`, url, part.start, part.end, settings.volume, previewLoop(settings.loop, part))
}

/** The Preview button of a song in the song list: the full song. */
export function togglePreviewSong(songId: string): void {
  const song = store.project?.songs.find((item) => item.id === songId)
  const url = song ? store.media[song.id]?.url : null
  if (!song || !url || !previewAvailable()) return
  preview.togglePreview(`song:${song.id}`, url, 0, song.duration, 100)
}

export function stopPreviewOf(key: string): void {
  if (previewState.key === key) preview.stopPreview()
}

export interface ListenRequest {
  element: HTMLAudioElement
  from: number
  volume: number
  /** Loop of the step. With Loop on, Listen starts again from the start point. */
  loop: boolean
  part: Part
}

/** Listen (5.4): from the position on the waveform to the end point. */
export function toggleListen(request: ListenRequest): void {
  if (!previewAvailable() && previewState.key !== 'listen') return
  // At the end point nothing is left to play, so Listen starts from the start point.
  const { part } = request
  const from = request.from >= part.end - 0.05 || request.from < 0 ? part.start : request.from
  preview.toggleListen(request.element, from, part.end, request.volume, previewLoop(request.loop, part))
}

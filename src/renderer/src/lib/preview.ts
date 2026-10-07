// Preview (DESIGN.md, 5.7): play a song on the preview output, which only the operator hears.
// A preview has its own audio context. It never reaches the main output.

import { reactive } from 'vue'
import { DECLICK, gainOf, sinkOf, type SinkContext } from './engine'

/** A preview that loops (5.7): where it starts again, and if that jump is in the middle of a sound. */
export interface PreviewLoop {
  start: number
  cut: boolean
}

export const previewState = reactive({
  /** What plays: "step:<id>", "song:<id>" or "listen". `null` if no preview plays. */
  key: null as string | null,
  /** Seconds. */
  position: 0,
  from: 0,
  /** Grows when the preview path is built again. An element of the old path cannot play. */
  generation: 0,
})

interface Route {
  context: SinkContext
  source: MediaElementAudioSourceNode
  gain: GainNode
}

interface Active {
  key: string
  element: HTMLAudioElement
  to: number
  /** The preview made this element and removes it at the end. */
  owned: boolean
  gain: GainNode
  /** The gain of the volume of the step. */
  level: number
  /** `null`: the preview stops at the end point. */
  loop: PreviewLoop | null
  /** The sound is closed for a moment before a loop restart at a cut point. */
  seamClosed: boolean
}

let context: SinkContext | null = null
/** The device of the preview output. `null`: the preview output is not valid. */
let sink: string | null = null
const routes = new WeakMap<HTMLAudioElement, Route>()
let active: Active | null = null
let ticker: ReturnType<typeof setInterval> | undefined
/** Each start and each stop takes a new number. A slow start then knows that it is too late. */
let turn = 0
/** How many times the preview path was built. */
let built = 0

function release(element: HTMLAudioElement): void {
  const route = routes.get(element)
  try {
    route?.source.disconnect()
    route?.gain.disconnect()
  } catch {
    // The context can be closed already.
  }
  routes.delete(element)
  element.removeAttribute('src')
  element.load()
}

/** Stops the preview. Nothing in the show changes. */
export function stopPreview(): void {
  turn++
  clearInterval(ticker)
  ticker = undefined
  const stopped = active
  active = null
  previewState.key = null
  if (!stopped) return
  stopped.element.pause()
  // The waveform keeps its element. The next Listen sets the loop again.
  stopped.element.loop = false
  if (stopped.owned) release(stopped.element)
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T | undefined> {
  return Promise.race([promise, new Promise<undefined>((resolve) => setTimeout(() => resolve(undefined), ms))])
}

/** Makes the preview path ready. Returns `null` unless the path plays on the preview device. */
async function prepare(): Promise<SinkContext | null> {
  const wanted = sink
  if (wanted === null) return null
  for (let attempt = 0; attempt < 2; attempt++) {
    if (!context || context.state === 'closed') {
      context = new AudioContext({ latencyHint: 'interactive' }) as SinkContext
      const created = context
      // The device went away: the preview stops (5.7).
      created.addEventListener('statechange', () => {
        // Only a preview that plays can be lost. A new path also changes its state while it starts.
        if (context === created && created.state !== 'running' && active) stopPreview()
      })
      // An audio element of the old path cannot move to the new one. The waveform makes a new element.
      if (built > 0) previewState.generation++
      built++
    }
    const current = context
    try {
      if (sinkOf(current) !== wanted) await withTimeout(current.setSinkId(wanted), 1500)
      if (current.state !== 'running') await withTimeout(current.resume(), 1500)
    } catch {
      // Try one time more with a new context.
    }
    // The one condition that lets a preview sound: the path is on the preview device.
    if (current.state === 'running' && sinkOf(current) === wanted && sink === wanted) return current
    void current.close().catch(() => undefined)
    context = null
  }
  return null
}

function routeFor(element: HTMLAudioElement, current: SinkContext): Route | null {
  const existing = routes.get(element)
  if (existing) return existing.context === current ? existing : null
  const source = current.createMediaElementSource(element)
  const gain = current.createGain()
  source.connect(gain).connect(current.destination)
  const route = { context: current, source, gain }
  routes.set(element, route)
  return route
}

function tick(): void {
  if (!active) return
  const { element, to, loop } = active
  previewState.position = element.currentTime
  // With both points natural, the element loops by itself.
  if (loop && !loop.cut) return
  const remaining = to - element.currentTime
  const atEnd = element.ended || remaining <= 0.01
  if (!loop) {
    // With Loop off, a preview stops at the end point.
    if (atEnd) stopPreview()
    return
  }
  // A loop point has no fade, as in the hall (5.5). The sound closes for a moment, against a click.
  const gain = active.gain.gain
  const now = active.gain.context.currentTime
  if (!active.seamClosed && remaining <= DECLICK) {
    active.seamClosed = true
    gain.cancelScheduledValues(now)
    gain.setValueAtTime(active.level, now)
    gain.linearRampToValueAtTime(0, now + Math.max(0.003, remaining))
  }
  if (atEnd) {
    element.currentTime = loop.start
    active.seamClosed = false
    gain.cancelScheduledValues(now)
    gain.setValueAtTime(0, now)
    gain.linearRampToValueAtTime(active.level, now + DECLICK)
    if (element.paused || element.ended) void element.play().catch(() => undefined)
  }
}

async function start(
  key: string,
  element: HTMLAudioElement,
  owned: boolean,
  from: number,
  to: number,
  volume: number,
  loop: PreviewLoop | null,
): Promise<void> {
  // Only one preview plays at a time. A new preview stops the old one.
  stopPreview()
  const mine = ++turn
  const cancel = (): void => {
    if (owned) release(element)
  }
  const current = await prepare()
  if (!current || mine !== turn) return cancel()
  const route = routeFor(element, current)
  if (!route) return cancel()
  // A preview uses the volume of the step. It does not fade.
  const level = gainOf(volume)
  route.gain.gain.cancelScheduledValues(current.currentTime)
  route.gain.gain.value = level
  try {
    if (element.readyState < HTMLMediaElement.HAVE_METADATA) {
      await new Promise<void>((resolve, reject) => {
        element.addEventListener('loadedmetadata', () => resolve(), { once: true })
        element.addEventListener('error', () => reject(new Error('The song cannot play')), { once: true })
      })
    }
    // With Loop on, the preview loops as the step does in the hall (5.7).
    element.loop = !!loop && !loop.cut
    element.currentTime = from
    await element.play()
  } catch {
    return cancel()
  }
  if (mine !== turn || sink === null || sinkOf(current) !== sink) {
    element.pause()
    element.loop = false
    return cancel()
  }
  active = { key, element, to, owned, gain: route.gain, level, loop, seamClosed: false }
  previewState.key = key
  previewState.from = from
  previewState.position = from
  ticker = setInterval(tick, 10)
}

/** Starts the preview of a song part, or stops it if it plays. */
export function togglePreview(key: string, url: string, from: number, to: number, volume: number, loop: PreviewLoop | null = null): void {
  if (previewState.key === key) {
    stopPreview()
    return
  }
  const element = new Audio()
  element.preload = 'auto'
  element.src = url
  void start(key, element, true, from, to, volume, loop)
}

/** Listen (5.4): plays the audio element of the waveform from a position to the end point. */
export function toggleListen(element: HTMLAudioElement, from: number, to: number, volume: number, loop: PreviewLoop | null = null): void {
  if (previewState.key === 'listen') {
    stopPreview()
    return
  }
  void start('listen', element, false, from, to, volume, loop)
}

/** Sets the device of the preview output. `null`: the preview output is not valid, so no preview plays. */
export function setPreviewSink(deviceId: string | null): void {
  if (sink === deviceId) return
  sink = deviceId
  stopPreview()
}

/** For the self-test. */
export function debugPreview(): Record<string, unknown> {
  return {
    context: context?.state ?? 'none',
    sink: context ? sinkOf(context) : '',
    wanted: sink,
    key: active?.key ?? null,
    time: active?.element.currentTime ?? null,
    loops: active ? active.loop !== null : null,
    paused: active?.element.paused ?? null,
  }
}

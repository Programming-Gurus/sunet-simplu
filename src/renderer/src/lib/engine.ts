// The sound of the main output (DESIGN.md, sections 5 and 9).
// One audio element and one gain node for each step that plays. The Web Audio clock runs the
// fades, so they do not depend on the interface.
// Sounds are on two layers (5.2): a normal step replaces the normal sound, a background step
// replaces nothing.

import { reactive } from 'vue'
import { clamp, effectiveFades } from '@shared/project'

/** What the engine needs to play one song step. Times are in seconds. */
export interface PlayRequest {
  stepId: string
  songId: string
  /** The song in memory. */
  url: string
  start: number
  end: number
  naturalStart: boolean
  naturalEnd: boolean
  /** The position where the song starts now. It is after `start` if the step continues a song. */
  startAt: number
  /** 0–100. */
  volume: number
  loop: boolean
  /** The fade times of the step: its own times, or the times of the project (5.3). */
  fadeIn: number
  fadeOut: number
  /** The fade switches of the step (5.3). With a switch off, that fade is immediate. */
  fadesIn: boolean
  fadesOut: boolean
  /** A background step stops nothing, and other song steps do not stop it (5.2). */
  background: boolean
  loopCount?: number
}

/** One sound of the main output, for the screens. */
export interface Sound {
  stepId: string
  songId: string
  background: boolean
  position: number
  start: number
  end: number
  loop: boolean
  loopCount: number
  /** The level at this moment, 0–100, on the scale of the volume slider (3.2). */
  level: number
  fadingOut: boolean
}

/** A step that played when the main output was lost (8.2). */
export interface Interrupted {
  stepId: string
  songId: string
  position: number
  loopCount: number
  background: boolean
}

export const engineState = reactive({
  /** The sounds of the main output, oldest first. A sound that fades out is still a sound. */
  sounds: [] as Sound[],
  /** The steps that played when the main output was lost (8.2). */
  interrupted: [] as Interrupted[],
  /** The named main output is not connected. No song starts. */
  mainLost: false,
  /** Counts the refused runs. The warning flashes when this number changes. */
  flash: 0,
})

/** A chromium audio context can send its sound to one named device. */
export interface SinkContext extends AudioContext {
  readonly sinkId: string | { type: string }
  setSinkId(id: string): Promise<void>
}

export function sinkOf(context: AudioContext): string {
  const id = (context as SinkContext).sinkId
  return typeof id === 'string' ? id : ''
}

/** A volume in percent as a gain. The square makes the slider feel even to the ear. */
export function gainOf(percent: number): number {
  const value = clamp(percent, 0, 100) / 100
  return value * value
}

/**
 * The level of a sound for the meter: where the volume slider would be for the same loudness.
 * A fade ends at the volume of the step.
 */
export function meterPercent(volume: number, fade: number): number {
  return Math.round(clamp(volume, 0, 100) * Math.sqrt(clamp(fade, 0, 1)))
}

/** Equal-power fade (5.3). A fade starts from the level that the song has at that moment. */
export function fadeLevel(kind: 'in' | 'out', from: number, to: number, progress: number): number {
  const p = clamp(progress, 0, 1)
  return kind === 'in' ? from + (to - from) * Math.sin((p * Math.PI) / 2) : to + (from - to) * Math.cos((p * Math.PI) / 2)
}

function fadeCurve(kind: 'in' | 'out', from: number, to: number, duration: number): Float32Array {
  const points = Math.max(16, Math.min(512, Math.ceil(duration * 100)))
  const curve = new Float32Array(points)
  for (let i = 0; i < points; i++) curve[i] = fadeLevel(kind, from, to, i / (points - 1))
  return curve
}

const TICK_MS = 10
/** A cut in the middle of a sound gives a click. A fade this short removes the click and is not heard as a fade. */
export const DECLICK = 0.02
/** The position where each song last stopped on the main output (5.6). Not saved. */
const remembered = new Map<string, number>()

let context: SinkContext | null = null
let master: GainNode | null = null
/** The device of the main output. An empty text is the system default. */
let wantedSink = ''
/** The sounds of the main output, oldest first. */
let voices: Voice[] = []
/** 0 only in the self-test, which must make no sound. */
let outputGain = 1
let ticker: ReturnType<typeof setInterval> | undefined
let tickCount = 0
/** Runs wait for each other, so two fast key presses cannot mix. */
let queue: Promise<unknown> = Promise.resolve()
/** True while the app itself moves the main output to a different device. */
let switching = false

class Voice {
  readonly request: PlayRequest
  readonly context: SinkContext
  readonly element = new Audio()
  private source: MediaElementAudioSourceNode
  private fadeGain: GainNode
  /** Closes for a moment at a loop restart in the middle of a sound. It is not a fade (5.5). */
  private seamGain: GainNode
  private volumeGain: GainNode
  loopCount: number
  /** The element plays and the fade-in started. */
  started = false
  /** The voice fades out because of Stop, Esc, a stop step or a crossfade. */
  stopping = false
  finished = false
  startedAt = 0
  private nativeLoop: boolean
  private volume: number
  /** The fade-out before a cut end point runs. */
  private endFading = false
  private cycleFadeOut = 0
  private seamClosed = false
  private lastTime = 0
  private stopTimer: ReturnType<typeof setTimeout> | undefined
  // The engine keeps its own model of the fade, so it always knows the level at this moment.
  private level = 0
  private fade: { kind: 'in' | 'out'; from: number; to: number; start: number; duration: number } | null = null

  constructor(request: PlayRequest, audioContext: SinkContext, output: AudioNode) {
    this.request = request
    this.context = audioContext
    this.loopCount = request.loopCount ?? 0
    this.volume = request.volume
    // Both points natural: the element loops by itself, with the smallest gap.
    this.nativeLoop = request.loop && request.naturalStart && request.naturalEnd
    this.element.preload = 'auto'
    this.element.src = request.url
    this.source = audioContext.createMediaElementSource(this.element)
    this.fadeGain = audioContext.createGain()
    this.fadeGain.gain.value = 0
    this.seamGain = audioContext.createGain()
    this.volumeGain = audioContext.createGain()
    this.volumeGain.gain.value = gainOf(request.volume)
    this.source.connect(this.fadeGain).connect(this.seamGain).connect(this.volumeGain).connect(output)
    this.element.addEventListener('ended', () => this.onPartEnd())
  }

  async start(): Promise<void> {
    const { request, element } = this
    if (element.readyState < HTMLMediaElement.HAVE_METADATA) {
      await new Promise<void>((resolve, reject) => {
        element.addEventListener('loadedmetadata', () => resolve(), { once: true })
        element.addEventListener('error', () => reject(new Error('The song cannot play')), { once: true })
      })
    }
    if (this.finished) return
    element.currentTime = request.startAt
    this.lastTime = request.startAt
    element.loop = this.nativeLoop
    await element.play()
    if (this.finished) {
      element.pause()
      return
    }
    this.started = true
    this.startedAt = performance.now()
    // A run fades in, unless its switch is off. With Loop off, a cut end fades out and both fades
    // must fit the part. A loop has no fade at its end, so its fade-in can continue over the loop point.
    const fades = request.loop
      ? { fadeIn: this.fadeInTime(), fadeOut: 0 }
      : effectiveFades(request.end - request.startAt, this.fadeInTime(), this.cutEndTime())
    this.cycleFadeOut = fades.fadeOut
    // A start in the middle of the file is a cut.
    this.rampTo('in', 1, request.startAt > 0.05 ? Math.max(DECLICK, fades.fadeIn) : fades.fadeIn)
  }

  private fadeInTime(): number {
    return this.request.fadesIn ? this.request.fadeIn : 0
  }

  /** The fade-out time before a cut end point, with Loop off. A natural end and a loop point have no fade (5.4, 5.5). */
  private cutEndTime(): number {
    if (this.request.naturalEnd || this.request.loop) return 0
    return Math.max(DECLICK, this.request.fadesOut ? this.request.fadeOut : 0)
  }

  /** Before a loop restart at a cut point: the sound closes in the last moment, against a click. */
  private closeSeam(remaining: number): void {
    const now = this.context.currentTime
    const gain = this.seamGain.gain
    this.seamClosed = true
    gain.cancelScheduledValues(now)
    gain.setValueAtTime(1, now)
    gain.linearRampToValueAtTime(0, now + Math.max(0.003, remaining))
  }

  private openSeam(): void {
    const now = this.context.currentTime
    const gain = this.seamGain.gain
    this.seamClosed = false
    gain.cancelScheduledValues(now)
    gain.setValueAtTime(0, now)
    gain.linearRampToValueAtTime(1, now + DECLICK)
  }

  /** The level for the meter, 0–100. */
  meter(): number {
    return meterPercent(this.volume, this.currentLevel())
  }

  position(): number {
    return clamp(this.element.currentTime, this.request.start, this.request.end)
  }

  currentLevel(): number {
    if (!this.fade) return this.level
    const progress = (this.context.currentTime - this.fade.start) / this.fade.duration
    if (progress >= 1) {
      this.level = this.fade.to
      this.fade = null
      return this.level
    }
    return fadeLevel(this.fade.kind, this.fade.from, this.fade.to, progress)
  }

  /** The level that the audio graph has at this moment, for the self-test. */
  measuredLevel(): number {
    return this.fadeGain.gain.value
  }

  private setLevel(value: number): void {
    const now = this.context.currentTime
    this.fadeGain.gain.cancelScheduledValues(now)
    this.fadeGain.gain.setValueAtTime(value, now)
    this.level = value
    this.fade = null
  }

  private rampTo(kind: 'in' | 'out', to: number, duration: number): void {
    const now = this.context.currentTime
    const from = this.currentLevel()
    if (duration <= 0.003) {
      this.setLevel(to)
      return
    }
    const gain = this.fadeGain.gain
    try {
      gain.cancelScheduledValues(now)
      gain.setValueCurveAtTime(fadeCurve(kind, from, to, duration), now, duration)
      this.fade = { kind, from, to, start: now, duration }
    } catch {
      this.setLevel(to)
    }
  }

  setVolume(percent: number): void {
    this.volume = percent
    this.volumeGain.gain.setTargetAtTime(gainOf(percent), this.context.currentTime, 0.02)
  }

  /** Fades the voice out with the fade-out time of its step, then ends it. */
  beginStop(fadeOut: number): void {
    if (this.finished || this.stopping) return
    this.stopping = true
    if (!this.started) {
      finishVoice(this)
      return
    }
    // With the fade-out switch off, the stop is immediate (5.3).
    const time = Math.max(DECLICK, this.request.fadesOut ? fadeOut : 0)
    this.rampTo('out', 0, time)
    this.stopTimer = setTimeout(() => finishVoice(this), time * 1000 + 40)
  }

  tick(): void {
    if (!this.started || this.finished) return
    const time = this.element.currentTime
    if (this.nativeLoop && !this.stopping && time + 0.5 < this.lastTime) this.loopCount++
    this.lastTime = time
    if (this.request.naturalEnd) return
    const remaining = this.request.end - time
    if (this.request.loop) {
      // A loop point has no fade (5.5). A fade-out by Stop continues over it.
      if (!this.seamClosed && remaining <= DECLICK) this.closeSeam(Math.max(0, remaining))
    } else if (!this.stopping && !this.endFading && remaining <= this.cycleFadeOut) {
      // With Loop off, a cut end fades out and reaches silence at the end point (5.4).
      this.endFading = true
      this.rampTo('out', 0, Math.max(0, remaining))
    }
    if (remaining <= 0.01) this.onPartEnd()
  }

  private onPartEnd(): void {
    if (this.finished || !this.started) return
    const { request } = this
    if (!request.loop) {
      if (this.stopping) finishVoice(this)
      else voiceEnded(this)
      return
    }
    // Loop (5.5): start again from the start point, without a fade. A looped sound fades only
    // at its start and at its stop, so a fade-out continues over the loop point.
    if (!this.stopping) this.loopCount++
    this.element.currentTime = request.start
    this.lastTime = request.start
    this.openSeam()
    if (this.element.paused || this.element.ended) void this.element.play().catch(() => undefined)
  }

  dispose(): void {
    this.finished = true
    clearTimeout(this.stopTimer)
    this.element.pause()
    try {
      this.source.disconnect()
      this.fadeGain.disconnect()
      this.volumeGain.disconnect()
    } catch {
      // The context can be closed already.
    }
    this.element.removeAttribute('src')
    this.element.load()
  }
}

// --- The audio context of the main output ---

function buildContext(): void {
  const created = new AudioContext({ latencyHint: 'interactive' }) as SinkContext
  context = created
  master = created.createGain()
  master.gain.value = outputGain
  master.connect(created.destination)
  const lost = (): void => {
    // The device went away under a song (section 9). The song stops; the step becomes interrupted.
    // A change of device by the app is not a loss.
    if (switching || context !== created || created.state === 'running') return
    if (voices.length > 0) interrupt()
  }
  created.addEventListener('statechange', lost)
  created.addEventListener('error', lost)
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T | undefined> {
  return Promise.race([promise, new Promise<undefined>((resolve) => setTimeout(() => resolve(undefined), ms))])
}

/**
 * Makes the main output ready to play. After a device was lost, its context is suspended and
 * does not start again by itself (section 9). Returns `false` if the output cannot play.
 */
async function ensureReady(): Promise<boolean> {
  for (let attempt = 0; attempt < 2; attempt++) {
    if (!context || context.state === 'closed') buildContext()
    const active = context as SinkContext
    try {
      if (sinkOf(active) !== wantedSink) await withTimeout(active.setSinkId(wantedSink), 1500)
      if (active.state !== 'running') await withTimeout(active.resume(), 1500)
    } catch {
      // Try one time more with a new context.
    }
    if (active.state === 'running' && sinkOf(active) === wantedSink) return true
    if (voices.length > 0) return false
    void active.close().catch(() => undefined)
    context = null
    master = null
  }
  return false
}

// --- Bookkeeping ---

function soundOf(voice: Voice): Sound {
  return {
    stepId: voice.request.stepId,
    songId: voice.request.songId,
    background: voice.request.background,
    position: voice.started ? voice.position() : voice.request.startAt,
    start: voice.request.start,
    end: voice.request.end,
    loop: voice.request.loop,
    loopCount: voice.loopCount,
    level: voice.meter(),
    fadingOut: voice.stopping,
  }
}

function publish(): void {
  engineState.sounds = voices.map(soundOf)
}

/** Updates the numbers that change while a sound plays: position, loop count and level. */
function refresh(): void {
  if (engineState.sounds.length !== voices.length) {
    publish()
    return
  }
  voices.forEach((voice, index) => {
    const sound = engineState.sounds[index]
    sound.position = voice.started ? voice.position() : voice.request.startAt
    sound.loopCount = voice.loopCount
    sound.level = voice.meter()
  })
}

function tick(): void {
  for (const voice of [...voices]) voice.tick()
  tickCount++
  if (tickCount % 5 === 0) refresh()
  if (voices.length === 0) {
    clearInterval(ticker)
    ticker = undefined
  }
}

function startTicker(): void {
  if (ticker === undefined) ticker = setInterval(tick, TICK_MS)
}

/**
 * Ends a voice. The app remembers the position where the song stopped (5.6):
 * after a fade-out, this is the position at the end of the fade-out.
 */
function finishVoice(voice: Voice, position?: number): void {
  if (voice.finished) return
  if (voice.started) remembered.set(voice.request.songId, position ?? voice.position())
  voice.dispose()
  voices = voices.filter((item) => item !== voice)
  publish()
}

/** A song reached its end with Loop off (5.5). */
function voiceEnded(voice: Voice): void {
  finishVoice(voice, voice.request.end)
}

function forget(stepIds: string[]): void {
  if (engineState.interrupted.some((item) => stepIds.includes(item.stepId))) {
    engineState.interrupted = engineState.interrupted.filter((item) => !stepIds.includes(item.stepId))
  }
}

/** The main output was lost while steps played: the sound stops without a fade (8.2). */
function interrupt(): void {
  const lost: Interrupted[] = []
  for (const voice of voices) {
    const position = voice.started ? voice.position() : voice.request.startAt
    remembered.set(voice.request.songId, position)
    // A step that already faded out was stopped. It does not become interrupted.
    if (!voice.stopping) {
      lost.push({
        stepId: voice.request.stepId,
        songId: voice.request.songId,
        position,
        loopCount: voice.loopCount,
        background: voice.request.background,
      })
    }
    voice.dispose()
  }
  voices = []
  forget(lost.map((item) => item.stepId))
  engineState.interrupted = [...engineState.interrupted, ...lost]
  publish()
}

// --- What the show calls ---

/** Gives the fade-out time of a step at this moment (5.3). Each sound fades out with the time of its step. */
export type FadeOutOf = (stepId: string) => number

/** Refuses a run and makes the warning flash. */
export function refuse(): void {
  engineState.flash++
}

/**
 * Starts a song step (5.2). A normal step replaces the normal sound: the old song fades out
 * while the new song fades in, each with its own fade time. A background step stops nothing.
 * Returns `false` if the main output cannot play.
 */
export function play(request: PlayRequest, fadeOutOf: FadeOutOf): Promise<boolean> {
  const run = async (): Promise<boolean> => {
    if (engineState.mainLost || !(await ensureReady()) || !context || !master) {
      refuse()
      return false
    }
    if (!request.background) {
      for (const voice of [...voices]) {
        if (!voice.request.background) voice.beginStop(fadeOutOf(voice.request.stepId))
      }
    }
    // The step is not interrupted any more. A normal step also replaces an interrupted normal step.
    engineState.interrupted = engineState.interrupted.filter(
      (item) => item.stepId !== request.stepId && (request.background || item.background),
    )
    const voice = new Voice(request, context, master)
    voices.push(voice)
    publish()
    startTicker()
    voice.start().catch(() => finishVoice(voice))
    return true
  }
  const result = queue.then(run, run)
  queue = result.catch(() => undefined)
  return result
}

/**
 * Fades out the given steps: a Stop button or a stop step. An interrupted step is idle again.
 * Returns `true` if a step played.
 */
export function stopSteps(stepIds: string[], fadeOutOf: FadeOutOf): boolean {
  forget(stepIds)
  const targets = voices.filter((voice) => !voice.stopping && stepIds.includes(voice.request.stepId))
  for (const voice of targets) voice.beginStop(fadeOutOf(voice.request.stepId))
  publish()
  return targets.length > 0
}

/** Fades out all sound: Esc. Returns `true` if a step played. */
export function stopAll(fadeOutOf: FadeOutOf): boolean {
  engineState.interrupted = []
  const targets = voices.filter((voice) => !voice.stopping)
  for (const voice of targets) voice.beginStop(fadeOutOf(voice.request.stepId))
  publish()
  return targets.length > 0
}

/** The position where a song last stopped on the main output, if it played since the project opened. */
export function rememberedPosition(songId: string): number | undefined {
  // A song that sounds at this moment continues without a jump on the new step (5.6).
  const live = voices.filter((voice) => voice.started && voice.request.songId === songId)
  const voice = [...live].reverse().find((item) => !item.stopping) ?? live[live.length - 1]
  if (voice) return voice.position()
  return remembered.get(songId)
}

export function isAudible(): boolean {
  return voices.length > 0
}

/** For the self-test: the main output plays, but makes no sound. */
export function setSilent(silent: boolean): void {
  outputGain = silent ? 0 : 1
  if (context && master) master.gain.setTargetAtTime(outputGain, context.currentTime, 0.02)
}

/** A change to the volume of a step that plays applies immediately. */
export function setStepVolume(stepId: string, percent: number): void {
  for (const voice of voices) {
    if (voice.request.stepId === stepId) voice.setVolume(percent)
  }
}

/** Sets the device of the main output. An empty text is the system default. */
export async function setMainSink(deviceId: string): Promise<void> {
  wantedSink = deviceId
  const active = context
  if (!active || active.state === 'closed' || sinkOf(active) === deviceId) return
  // The music moves to the new device and continues (8.2).
  switching = true
  try {
    await withTimeout(active.setSinkId(deviceId), 1500)
    if (active.state !== 'running') await withTimeout(active.resume(), 1500)
  } catch {
    // The next run makes the output ready again.
  }
  switching = false
  if (context === active && active.state !== 'running' && voices.length > 0) interrupt()
}

/** The named main output disconnected (8.2). */
export function mainOutputLost(): void {
  engineState.mainLost = true
  interrupt()
}

/** The named main output is connected again. The app stays silent until Play (8.2). */
export function mainOutputReturned(): void {
  engineState.mainLost = false
  void ensureReady()
}

/** Stops all sound immediately and forgets the positions. For project open and close. */
export function reset(): void {
  for (const voice of voices) voice.dispose()
  voices = []
  remembered.clear()
  engineState.interrupted = []
  publish()
}

/** For the self-test: what the engine does at this moment. */
export function debugSnapshot(): Record<string, unknown> {
  const describe = (voice: Voice): Record<string, unknown> => ({
    stepId: voice.request.stepId,
    background: voice.request.background,
    stopping: voice.stopping,
    started: voice.started,
    time: voice.element.currentTime,
    paused: voice.element.paused,
    level: voice.currentLevel(),
    measured: voice.measuredLevel(),
    loopCount: voice.loopCount,
  })
  const normal = [...voices].reverse().find((voice) => !voice.stopping && !voice.request.background)
  return {
    context: context?.state ?? 'none',
    sink: context ? sinkOf(context) : '',
    voices: voices.map(describe),
    /** The normal step that plays. */
    playing: normal ? describe(normal) : null,
    fading: voices.filter((voice) => voice.stopping).map(describe),
    remembered: Object.fromEntries(remembered),
  }
}

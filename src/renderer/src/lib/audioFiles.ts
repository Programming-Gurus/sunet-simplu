// What the app does with an audio file when you add it (DESIGN.md, 5.4 and section 6).

import { AUDIO_EXTENSIONS } from '@shared/types'

const MIME: Record<string, string> = {
  mp3: 'audio/mpeg',
  wav: 'audio/wav',
  m4a: 'audio/mp4',
  aac: 'audio/aac',
  flac: 'audio/flac',
  ogg: 'audio/ogg',
  opus: 'audio/ogg',
}

/** The number of loudness values in a waveform. Enough for a wide screen. */
const PEAK_COUNT = 2000

export function extensionOf(fileName: string): string | null {
  const match = /\.([A-Za-z0-9]{1,5})$/.exec(fileName)
  const extension = match ? match[1].toLowerCase() : ''
  return (AUDIO_EXTENSIONS as readonly string[]).includes(extension) ? extension : null
}

export function audioBlob(bytes: BlobPart, extension: string): Blob {
  return new Blob([bytes], { type: MIME[extension] ?? 'application/octet-stream' })
}

export interface AudioAnalysis {
  /** Seconds. */
  duration: number
  /** The loudness of the song over time, 0–1. The app makes it one time (5.4). */
  peaks: number[]
}

/** Decodes a file to measure it. Throws if Chromium cannot decode the file. */
export async function analyseAudio(bytes: ArrayBuffer): Promise<AudioAnalysis> {
  // A low sample rate keeps the decoded copy small. The waveform does not need more.
  const context = new OfflineAudioContext({ numberOfChannels: 1, length: 1, sampleRate: 8000 })
  // The decoder takes the buffer away, so it gets a copy.
  const buffer = await context.decodeAudioData(bytes.slice(0))
  if (!(buffer.duration > 0)) throw new Error('The file has no sound')

  const count = Math.min(PEAK_COUNT, buffer.length)
  const peaks = new Array<number>(count).fill(0)
  const bucket = buffer.length / count
  for (let channel = 0; channel < buffer.numberOfChannels; channel++) {
    const samples = buffer.getChannelData(channel)
    for (let i = 0; i < count; i++) {
      const from = Math.floor(i * bucket)
      const to = Math.min(samples.length, Math.max(from + 1, Math.floor((i + 1) * bucket)))
      let max = peaks[i]
      for (let j = from; j < to; j++) {
        const value = Math.abs(samples[j])
        if (value > max) max = value
      }
      peaks[i] = max
    }
  }
  return { duration: buffer.duration, peaks: peaks.map((value) => Math.round(Math.min(1, value) * 1000) / 1000) }
}

/** The show plays songs with audio elements. This checks that an element accepts the file. */
export function canPlay(url: string, timeoutMs = 8000): Promise<boolean> {
  return new Promise((resolve) => {
    const element = new Audio()
    const finish = (result: boolean): void => {
      clearTimeout(timer)
      element.removeAttribute('src')
      element.load()
      resolve(result)
    }
    const timer = setTimeout(() => finish(false), timeoutMs)
    element.preload = 'metadata'
    element.addEventListener('loadedmetadata', () => finish(Number.isFinite(element.duration) && element.duration > 0), { once: true })
    element.addEventListener('error', () => finish(false), { once: true })
    element.src = url
  })
}

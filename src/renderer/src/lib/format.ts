// Text forms of times and dates. Romanian uses a decimal comma: "0:12,0".

import type { Language } from '@shared/types'

function decimalMark(lang: Language): string {
  return lang === 'ro' ? ',' : '.'
}

/** "1:42". Rounds down, as a clock does. */
export function formatClock(seconds: number): string {
  const total = Math.max(0, Math.floor(seconds + 1e-6))
  const minutes = Math.floor(total / 60)
  return `${minutes}:${String(total % 60).padStart(2, '0')}`
}

/** "0:12,0": minutes, seconds and tenths (5.4). */
export function formatPoint(seconds: number, lang: Language): string {
  const tenths = Math.max(0, Math.round(seconds * 10))
  const minutes = Math.floor(tenths / 600)
  const rest = tenths - minutes * 600
  return `${minutes}:${String(Math.floor(rest / 10)).padStart(2, '0')}${decimalMark(lang)}${rest % 10}`
}

/** Reads "2:40", "2:40,5", "2:40.5" or plain seconds "160,5". Returns `null` for other text. */
export function parsePoint(text: string): number | null {
  const value = text.trim().replace(',', '.')
  const match = /^(?:(\d{1,3}):)?(\d{1,5})(?:\.(\d{1,3}))?$/.exec(value)
  if (!match) return null
  const minutes = match[1] ? Number(match[1]) : 0
  const seconds = Number(match[2])
  if (match[1] && seconds >= 60) return null
  const fraction = match[3] ? Number(`0.${match[3]}`) : 0
  return minutes * 60 + seconds + fraction
}

/** "1,0": a fade time. */
export function formatFade(seconds: number, lang: Language): string {
  return seconds.toFixed(1).replace('.', decimalMark(lang))
}

export function parseFade(text: string): number | null {
  const value = Number(text.trim().replace(',', '.'))
  return text.trim() !== '' && Number.isFinite(value) ? value : null
}

function sameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()
}

export type ChangedText =
  | { kind: 'today'; time: string }
  | { kind: 'yesterday'; time: string }
  | { kind: 'date'; date: string }

/** The date of last change of a project, in the words of the Projects screen. */
export function describeChanged(iso: string, lang: Language, now = new Date()): ChangedText {
  const date = new Date(iso)
  const locale = lang === 'ro' ? 'ro-RO' : 'en-GB'
  if (Number.isNaN(date.getTime())) return { kind: 'date', date: '?' }
  const time = `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`
  if (sameDay(date, now)) return { kind: 'today', time }
  const yesterday = new Date(now)
  yesterday.setDate(now.getDate() - 1)
  if (sameDay(date, yesterday)) return { kind: 'yesterday', time }
  const options: Intl.DateTimeFormatOptions =
    date.getFullYear() === now.getFullYear()
      ? { day: 'numeric', month: 'long' }
      : { day: 'numeric', month: 'long', year: 'numeric' }
  return { kind: 'date', date: new Intl.DateTimeFormat(locale, options).format(date) }
}

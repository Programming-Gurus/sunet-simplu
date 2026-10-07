// The texts of a step that the list and the bottom bar show (DESIGN.md, 3.2 and 4.4).

import { triggerAction, triggerLine } from '@shared/project'
import type { Step } from '@shared/types'
import { language, t } from './i18n'
import { songOf } from './projectStore'

/** A line in the quotation marks of the language: „…” or “…”. A line that has its own marks stays as it is. */
export function quoted(line: string): string {
  if (/^["'„“”«]/.test(line)) return line
  return language.value === 'ro' ? `„${line}”` : `“${line}”`
}

export interface TriggerText {
  kind: 'line' | 'action'
  text: string
}

/** The triggers of a step that are on and have text: the line first, then the action. */
export function triggerTexts(step: Step): TriggerText[] {
  const line = triggerLine(step)
  const action = triggerAction(step)
  return [...(line ? [{ kind: 'line' as const, text: quoted(line) }] : []), ...(action ? [{ kind: 'action' as const, text: action }] : [])]
}

/**
 * The first line of a step. Without a title, a stop step and a song step have a name of their own.
 * A note step without a title shows its trigger.
 */
export function stepTitle(step: Step | undefined): string {
  if (!step) return ''
  if (step.title.trim()) return step.title
  if (step.kind === 'stop') return t('steps.stopTitle')
  if (step.kind === 'song') return songOf(step)?.name ?? ''
  return triggerTexts(step)[0]?.text ?? t('steps.noteUntitled')
}

/** True if the first line of the step is its trigger, so the list does not show that trigger again. */
export function titleIsTrigger(step: Step): boolean {
  return step.kind === 'note' && !step.title.trim() && triggerTexts(step).length > 0
}

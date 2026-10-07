// The app settings, as the interface sees them (DESIGN.md, section 8).

import { reactive } from 'vue'
import type { AppSettings } from '@shared/types'
import { language } from './i18n'

export const settings = reactive<AppSettings>({ language: 'ro', mainOutput: null, previewOutput: null, lightGroups: [] })

function apply(next: AppSettings): void {
  Object.assign(settings, next)
  language.value = next.language
  document.documentElement.lang = next.language
}

export async function loadSettings(): Promise<void> {
  apply(await window.api.settings.get())
}

export async function updateSettings(patch: Partial<AppSettings>): Promise<void> {
  // A plain copy: a reactive list of light groups cannot cross to the main process.
  apply(await window.api.settings.set(JSON.parse(JSON.stringify(patch)) as Partial<AppSettings>))
}

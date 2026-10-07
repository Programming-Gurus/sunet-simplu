// Which screen is in view. The app has three screens and no web addresses.

import { reactive } from 'vue'

export type Screen = 'projects' | 'project' | 'settings'

export const nav = reactive<{ screen: Screen; settingsReturn: 'projects' | 'project' }>({
  screen: 'projects',
  settingsReturn: 'projects',
})

export function openSettings(): void {
  if (nav.screen === 'settings') return
  nav.settingsReturn = nav.screen
  nav.screen = 'settings'
}

export function closeSettings(): void {
  nav.screen = nav.settingsReturn
}

// Enter and leave a project, and change between Edit mode and Show mode (DESIGN.md, 5.8).

import { watch } from 'vue'
import { confirmDialog } from './dialogs'
import * as engine from './engine'
import { engineState } from './engine'
import { language, t } from './i18n'
import { nav } from './nav'
import { stopPreview } from './preview'
import { loadProject, store, unloadProject, type Mode } from './projectStore'
import { showError, showToast } from './toasts'

export async function enterProject(id: string): Promise<void> {
  try {
    engine.reset()
    nav.screen = 'project'
    if (!(await loadProject(id))) {
      nav.screen = 'projects'
      showToast(t('projects.missing'), 'error')
    }
  } catch (error) {
    nav.screen = 'projects'
    showError(error)
  }
}

/** Goes back to Projects. The app asks first if music plays (5.8). */
export async function leaveProject(): Promise<void> {
  if (engine.isAudible()) {
    const confirmed = await confirmDialog({
      title: t('project.leaveTitle'),
      body: t('project.leaveBody'),
      confirm: t('project.leaveConfirm'),
      cancel: t('project.stay'),
    })
    if (!confirmed) return
  }
  engine.reset()
  stopPreview()
  window.api.app.setShowMode(false)
  await unloadProject()
  nav.screen = 'projects'
}

/** A project opens in Edit mode. Show mode locks all edit operations. */
export function setMode(mode: Mode): void {
  if (store.mode === mode) return
  // A text field that keeps the focus would take the Space key during the show.
  if (document.activeElement instanceof HTMLElement) document.activeElement.blur()
  store.mode = mode
  window.api.app.setShowMode(mode === 'show')
}

/** While music plays, the main process asks before it closes the window (5.8). */
export function watchCloseGuard(): void {
  watch(
    () => [engineState.sounds.length > 0, language.value] as const,
    ([audible]) => {
      window.api.app.setCloseGuard(
        audible
          ? {
              message: t('project.leaveTitle'),
              detail: t('project.closeBody'),
              confirm: t('project.closeConfirm'),
              cancel: t('project.stay'),
            }
          : null,
      )
    },
    { immediate: true },
  )
}

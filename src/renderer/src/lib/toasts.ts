// Short messages at the bottom of the window. They go away by themselves.

import { reactive } from 'vue'
import { t } from './i18n'

export interface Toast {
  id: number
  text: string
  kind: 'info' | 'error'
}

export const toasts = reactive<Toast[]>([])
let nextId = 1

export function dismissToast(id: number): void {
  const index = toasts.findIndex((toast) => toast.id === id)
  if (index >= 0) toasts.splice(index, 1)
}

export function showToast(text: string, kind: Toast['kind'] = 'info'): void {
  const id = nextId++
  toasts.push({ id, text, kind })
  setTimeout(() => dismissToast(id), kind === 'error' ? 10000 : 5000)
}

export function showError(error: unknown): void {
  const message = error instanceof Error ? error.message : String(error)
  showToast(t('common.error', { message }), 'error')
}

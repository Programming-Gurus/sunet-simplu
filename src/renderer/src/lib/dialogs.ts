// Questions that the app asks in a small window: confirm, type a name, read a message.

import { reactive } from 'vue'

export interface DialogRequest {
  kind: 'confirm' | 'prompt' | 'alert'
  title: string
  body?: string
  label?: string
  value?: string
  confirm: string
  cancel?: string
  danger?: boolean
  resolve: (result: string | boolean | null) => void
}

export const dialogState = reactive<{ current: DialogRequest | null }>({ current: null })

type Options = Omit<DialogRequest, 'kind' | 'resolve'>

function open(kind: DialogRequest['kind'], options: Options): Promise<string | boolean | null> {
  // A new question replaces an open one. The open one counts as "no".
  dialogState.current?.resolve(kind === 'prompt' ? null : false)
  return new Promise((resolve) => {
    dialogState.current = { ...options, kind, resolve }
  })
}

export function closeDialog(result: string | boolean | null): void {
  const request = dialogState.current
  dialogState.current = null
  request?.resolve(result)
}

export async function confirmDialog(options: Options): Promise<boolean> {
  return (await open('confirm', options)) === true
}

export async function promptDialog(options: Options): Promise<string | null> {
  const result = await open('prompt', options)
  return typeof result === 'string' && result.trim() ? result.trim() : null
}

export async function alertDialog(options: Options): Promise<void> {
  await open('alert', options)
}

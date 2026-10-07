<script setup lang="ts">
// Shows the one open question of `lib/dialogs.ts` as a modal window.
import { nextTick, ref, watch } from 'vue'
import { closeDialog, dialogState } from '@/lib/dialogs'
import { t } from '@/lib/i18n'

const element = ref<HTMLDialogElement | null>(null)
const input = ref<HTMLInputElement | null>(null)
const value = ref('')

watch(
  () => dialogState.current,
  async (request) => {
    const dialog = element.value
    if (!dialog) return
    if (!request) {
      if (dialog.open) dialog.close()
      return
    }
    value.value = request.value ?? ''
    if (!dialog.open) dialog.showModal()
    await nextTick()
    if (request.kind === 'prompt') {
      input.value?.focus()
      input.value?.select()
    }
  },
)

function cancel(): void {
  const request = dialogState.current
  if (!request) return
  closeDialog(request.kind === 'prompt' ? null : false)
}

function submit(): void {
  const request = dialogState.current
  if (!request) return
  if (request.kind === 'prompt') {
    if (!value.value.trim()) return
    closeDialog(value.value)
    return
  }
  closeDialog(true)
}
</script>

<template>
  <dialog ref="element" class="dialog" @cancel.prevent="cancel" @keydown.stop @keyup.stop>
    <form v-if="dialogState.current" class="dialog-body" @submit.prevent="submit">
      <h2 class="dialog-title">{{ dialogState.current.title }}</h2>
      <p v-if="dialogState.current.body" class="dialog-text">{{ dialogState.current.body }}</p>
      <label v-if="dialogState.current.kind === 'prompt'" class="dialog-field">
        <span class="field-label">{{ dialogState.current.label }}</span>
        <input ref="input" v-model="value" class="field" type="text" maxlength="120" />
      </label>
      <div class="dialog-actions">
        <button v-if="dialogState.current.kind !== 'alert'" type="button" class="btn" @click="cancel">
          {{ dialogState.current.cancel ?? t('common.cancel') }}
        </button>
        <button
          type="submit"
          class="btn"
          :class="dialogState.current.danger ? 'btn-danger-solid' : 'btn-primary'"
          :autofocus="dialogState.current.kind === 'alert'"
        >
          {{ dialogState.current.confirm }}
        </button>
      </div>
    </form>
  </dialog>
</template>

<style scoped>
.dialog {
  width: min(460px, calc(100vw - 48px));
  padding: 0;
  border: 1px solid var(--line-strong);
  border-radius: 16px;
  background: var(--surface);
  color: var(--text);
}

.dialog::backdrop {
  background: rgba(0, 0, 0, 0.6);
}

.dialog-body {
  display: flex;
  flex-direction: column;
  gap: 14px;
  padding: 24px;
}

.dialog-title {
  font-size: 20px;
  font-weight: 600;
}

.dialog-text {
  color: var(--text-muted);
  user-select: text;
}

.dialog-field {
  display: flex;
  flex-direction: column;
  gap: 5px;
}

.dialog-actions {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  margin-top: 6px;
}
</style>

<script setup lang="ts">
import { dismissToast, toasts } from '@/lib/toasts'
import { t } from '@/lib/i18n'
import AppIcon from './AppIcon.vue'
</script>

<template>
  <div class="toasts" role="status" aria-live="polite">
    <div v-for="toast in toasts" :key="toast.id" class="toast" :class="{ error: toast.kind === 'error' }">
      <span class="toast-text">{{ toast.text }}</span>
      <button type="button" class="toast-close" :aria-label="t('common.close')" @click="dismissToast(toast.id)">
        <AppIcon name="close" :size="16" />
      </button>
    </div>
  </div>
</template>

<style scoped>
.toasts {
  position: fixed;
  left: 50%;
  bottom: 20px;
  z-index: 50;
  display: flex;
  flex-direction: column;
  gap: 8px;
  width: min(560px, calc(100vw - 48px));
  transform: translateX(-50%);
  pointer-events: none;
}

.toast {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  padding: 12px 12px 12px 16px;
  border: 1px solid var(--line-strong);
  border-radius: 12px;
  background: var(--surface-2);
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.5);
  pointer-events: auto;
}

.toast.error {
  border-color: var(--danger-line);
  color: var(--danger);
}

.toast-text {
  flex: 1 1 auto;
  user-select: text;
}

.toast-close {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  padding: 0;
  border: 0;
  border-radius: 7px;
  background: transparent;
  color: inherit;
  cursor: pointer;
}
</style>

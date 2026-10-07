<script setup lang="ts">
// The icon picker of a light group (DESIGN.md, 8.3): all Material Design Icons, with a search field.
import { computed, nextTick, ref } from 'vue'
import LightIcon from './LightIcon.vue'
import { t } from '@/lib/i18n'
import { loadIcons, searchIcons, type IconEntry } from '@/lib/lights'

const emit = defineEmits<{ pick: [icon: { icon: string; iconPath: string }] }>()

/** The picker draws this many icons at most. A search finds the others. */
const SHOWN_MAX = 240

const element = ref<HTMLDialogElement | null>(null)
const field = ref<HTMLInputElement | null>(null)
const icons = ref<IconEntry[] | null>(null)
const query = ref('')
const current = ref('')

const found = computed(() => (icons.value ? searchIcons(icons.value, query.value) : []))
const shown = computed(() => found.value.slice(0, SHOWN_MAX))

async function open(currentIcon: string): Promise<void> {
  current.value = currentIcon
  query.value = ''
  element.value?.showModal()
  await nextTick()
  field.value?.focus()
  icons.value ??= await loadIcons()
}

function close(): void {
  element.value?.close()
}

function pick(icon: IconEntry): void {
  emit('pick', { icon: icon.key, iconPath: icon.path })
  close()
}

defineExpose({ open, close })
</script>

<template>
  <dialog ref="element" class="picker" closedby="any" aria-labelledby="icon-picker-title">
    <div class="picker-body">
      <div class="picker-head">
        <h2 id="icon-picker-title">{{ t('icons.title') }}</h2>
        <span v-if="icons" class="picker-count mono">{{ t('icons.count', { shown: shown.length, total: found.length }) }}</span>
        <div class="spacer"></div>
        <button type="button" class="btn btn-small" @click="close">{{ t('common.close') }}</button>
      </div>
      <input
        ref="field"
        v-model="query"
        class="field"
        type="search"
        :aria-label="t('icons.search')"
        :placeholder="t('icons.searchPlaceholder')"
        maxlength="60"
      />
      <p v-if="!icons" class="picker-note">{{ t('icons.loading') }}</p>
      <p v-else-if="found.length === 0" class="picker-note">{{ t('icons.none') }}</p>
      <template v-else>
        <p v-if="!query.trim()" class="picker-note">{{ t('icons.stage') }}</p>
        <div class="grid">
          <button
            v-for="icon in shown"
            :key="icon.key"
            type="button"
            class="icon"
            :class="{ on: icon.key === current }"
            :aria-label="icon.name"
            :aria-pressed="icon.key === current"
            :title="icon.name"
            :data-icon="icon.key"
            @click="pick(icon)"
          >
            <LightIcon :path="icon.path" :size="26" />
          </button>
        </div>
      </template>
    </div>
  </dialog>
</template>

<style scoped>
.picker {
  width: min(720px, calc(100vw - 48px));
  height: min(600px, calc(100vh - 48px));
  padding: 0;
  border: 1px solid var(--line-strong);
  border-radius: 16px;
  background: var(--surface);
  color: var(--text);
}

.picker::backdrop {
  background: rgba(0, 0, 0, 0.6);
}

.picker-body {
  display: flex;
  flex-direction: column;
  gap: 12px;
  height: 100%;
  padding: 20px 20px 16px;
}

.picker-head {
  display: flex;
  align-items: center;
  gap: 14px;
}

.picker-head h2 {
  font-size: 20px;
  font-weight: 600;
}

.picker-count {
  font-size: 12.5px;
  color: var(--text-dim);
}

.picker-note {
  font-size: 13px;
  color: var(--text-muted);
}

.grid {
  flex: 1 1 auto;
  min-height: 0;
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(48px, 1fr));
  align-content: start;
  gap: 6px;
  padding: 2px;
  overflow-y: auto;
}

.icon {
  display: flex;
  align-items: center;
  justify-content: center;
  aspect-ratio: 1;
  padding: 0;
  border: 1px solid transparent;
  border-radius: 10px;
  background: transparent;
  color: var(--text-warm);
  cursor: pointer;
}

.icon:hover {
  border-color: var(--line-strong);
  color: var(--text);
}

.icon.on {
  border-color: var(--hall);
  background: var(--hall-bg);
  color: var(--hall);
}
</style>

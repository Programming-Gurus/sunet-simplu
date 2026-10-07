<script setup lang="ts">
// The top bar of the Project screen: back, name, mode switch, fade times, settings.
import { ref, watch } from 'vue'
import { roundFade } from '@shared/project'
import AppIcon from './AppIcon.vue'
import { formatFade, parseFade } from '@/lib/format'
import { language, t } from '@/lib/i18n'
import { openSettings } from '@/lib/nav'
import { store, touch } from '@/lib/projectStore'
import { setMode } from '@/lib/session'

const emit = defineEmits<{ back: [] }>()

const name = ref('')
const fadeIn = ref('')
const fadeOut = ref('')

watch(
  () => [store.project?.id, store.project?.name, store.project?.fadeIn, store.project?.fadeOut, language.value],
  () => {
    const project = store.project
    if (!project) return
    name.value = project.name
    fadeIn.value = formatFade(project.fadeIn, language.value)
    fadeOut.value = formatFade(project.fadeOut, language.value)
  },
  { immediate: true },
)

function commitName(): void {
  const project = store.project
  if (!project) return
  const value = name.value.trim().slice(0, 120)
  if (!value) {
    name.value = project.name
    return
  }
  if (value !== project.name) {
    project.name = value
    touch()
  }
  name.value = value
}

function commitFade(which: 'fadeIn' | 'fadeOut'): void {
  const project = store.project
  if (!project) return
  const field = which === 'fadeIn' ? fadeIn : fadeOut
  const parsed = parseFade(field.value)
  if (parsed !== null) {
    const value = roundFade(parsed, project[which])
    if (value !== project[which]) {
      project[which] = value
      touch()
    }
  }
  field.value = formatFade(project[which], language.value)
}

function blurOnEnter(event: KeyboardEvent): void {
  ;(event.target as HTMLElement).blur()
}
</script>

<template>
  <header v-if="store.project" class="bar">
    <button type="button" class="back" @click="emit('back')">
      <AppIcon name="back" :size="18" />
      <span>{{ t('project.backToProjects') }}</span>
    </button>

    <input
      v-if="store.mode === 'edit'"
      v-model="name"
      class="name name-input"
      type="text"
      maxlength="120"
      :aria-label="t('project.nameLabel')"
      @blur="commitName"
      @keydown.enter="blurOnEnter"
    />
    <h1 v-else class="name">{{ store.project.name }}</h1>

    <div class="spacer"></div>

    <div v-if="store.mode === 'show'" class="locked">
      <AppIcon name="lock" :size="16" />
      <span>{{ t('project.locked') }}</span>
    </div>

    <div class="modes">
      <button type="button" :aria-pressed="store.mode === 'edit'" @click="setMode('edit')">{{ t('project.modeEdit') }}</button>
      <button type="button" :aria-pressed="store.mode === 'show'" @click="setMode('show')">{{ t('project.modeShow') }}</button>
    </div>

    <div v-if="store.mode === 'edit'" class="fades">
      <label for="fade-in">{{ t('project.fadeIn') }}</label>
      <input
        id="fade-in"
        v-model="fadeIn"
        class="field mono fade"
        type="text"
        inputmode="decimal"
        @blur="commitFade('fadeIn')"
        @keydown.enter="blurOnEnter"
      />
      <span>s</span>
      <label for="fade-out">{{ t('project.fadeOut') }}</label>
      <input
        id="fade-out"
        v-model="fadeOut"
        class="field mono fade"
        type="text"
        inputmode="decimal"
        @blur="commitFade('fadeOut')"
        @keydown.enter="blurOnEnter"
      />
      <span>s</span>
    </div>
    <div v-else class="fade-chips mono">
      <span>{{ t('project.fadeIn') }} {{ formatFade(store.project.fadeIn, language) }} s</span>
      <span>{{ t('project.fadeOut') }} {{ formatFade(store.project.fadeOut, language) }} s</span>
    </div>

    <button type="button" class="icon-btn" :aria-label="t('common.settings')" @click="openSettings">
      <AppIcon name="settings" />
    </button>
  </header>
</template>

<style scoped>
.bar {
  display: flex;
  flex: 0 0 auto;
  align-items: center;
  gap: 16px;
  padding: 12px 20px;
  border-bottom: 1px solid var(--line);
  background: var(--surface);
}

.back {
  display: flex;
  flex: 0 0 auto;
  align-items: center;
  gap: 6px;
  min-height: 44px;
  padding: 0 10px 0 4px;
  border: 0;
  border-radius: 10px;
  background: transparent;
  color: var(--text-muted);
  cursor: pointer;
}

.back:hover {
  color: var(--text);
}

.name {
  min-width: 0;
  font-size: 20px;
  font-weight: 600;
  letter-spacing: 0.01em;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.name-input {
  flex: 0 1 360px;
  height: 40px;
  padding: 0 10px;
  margin-left: -10px;
  border: 1px solid transparent;
  border-radius: 9px;
  background: transparent;
}

.name-input:hover {
  border-color: var(--line);
}

.name-input:focus {
  border-color: var(--line-strong);
  background: var(--bg);
}

.locked {
  display: flex;
  flex: 0 0 auto;
  align-items: center;
  gap: 8px;
  color: var(--text-muted);
  font-size: 13px;
}

.modes {
  display: flex;
  flex: 0 0 auto;
  gap: 3px;
  padding: 3px;
  border: 1px solid var(--line);
  border-radius: 10px;
  background: var(--bg);
}

.modes button {
  min-height: 38px;
  padding: 0 16px;
  border: 0;
  border-radius: 7px;
  background: transparent;
  color: var(--text-muted);
  cursor: pointer;
}

.modes button[aria-pressed='true'] {
  background: var(--text);
  color: var(--bg);
  font-weight: 600;
}

.fades {
  display: flex;
  flex: 0 0 auto;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  color: var(--text-muted);
}

.fades label:not(:first-child) {
  margin-left: 6px;
}

.fade {
  width: 68px;
  height: 38px;
  padding: 0 8px;
  border-radius: 8px;
  font-size: 14px;
  text-align: right;
}

.fade-chips {
  display: flex;
  flex: 0 0 auto;
  gap: 8px;
  font-size: 13px;
  color: var(--text-muted);
}

.fade-chips span {
  padding: 6px 10px;
  border: 1px solid var(--line);
  border-radius: 8px;
}
</style>

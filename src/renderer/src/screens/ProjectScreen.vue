<script setup lang="ts">
// The Project screen (DESIGN.md, 3.2): the list of steps, with two more panels in Edit mode.
import { nextTick, onBeforeUnmount, onMounted, ref } from 'vue'
import KindPanel from '@/components/KindPanel.vue'
import NowBar from '@/components/NowBar.vue'
import ProjectHeader from '@/components/ProjectHeader.vue'
import StepEditor from '@/components/StepEditor.vue'
import StepList from '@/components/StepList.vue'
import { dialogState } from '@/lib/dialogs'
import { t } from '@/lib/i18n'
import { addSongFiles, moveStep, store } from '@/lib/projectStore'
import { leaveProject } from '@/lib/session'
import { fadeOutMusic, moveCursor, runCursor } from '@/lib/show'

const dropping = ref(false)
let dropDepth = 0

function isTextEntry(target: EventTarget | null): boolean {
  if (target instanceof HTMLTextAreaElement || target instanceof HTMLSelectElement) return true
  if (target instanceof HTMLInputElement) return !['checkbox', 'radio', 'range', 'button', 'file'].includes(target.type)
  return target instanceof HTMLElement && target.isContentEditable
}

function active(): boolean {
  return !!store.project && !store.loading && !dialogState.current
}

// The keys of a show (5.1). They work in both modes, but not while you type in a text field.
function onKeyDown(event: KeyboardEvent): void {
  if (!active() || event.metaKey || event.ctrlKey) return
  const typing = isTextEntry(event.target)
  if (event.key === ' ' || event.code === 'Space') {
    if (typing) return
    event.preventDefault()
    if (!event.repeat) runCursor()
  } else if (event.key === 'Escape') {
    // An open colour palette takes Esc: the browser closes it and the music continues.
    if (document.querySelector(':popover-open')) return
    if (typing) {
      ;(event.target as HTMLElement).blur()
      return
    }
    event.preventDefault()
    fadeOutMusic()
  } else if (event.key === 'ArrowUp' || event.key === 'ArrowDown') {
    if (typing || (event.target instanceof HTMLInputElement && event.target.type === 'range')) return
    event.preventDefault()
    const delta = event.key === 'ArrowUp' ? -1 : 1
    if (event.altKey) {
      if (store.mode === 'edit') moveStep(store.cursor, store.cursor + delta)
    } else {
      moveCursor(delta)
    }
  } else if (event.key === 'Enter' && event.target instanceof HTMLInputElement && event.target.type === 'checkbox') {
    // Space runs the show, so Enter sets a switch from the keyboard.
    event.target.click()
  }
}

// Space on a button that has the focus must not press that button.
function onKeyUp(event: KeyboardEvent): void {
  if (!active()) return
  if ((event.key === ' ' || event.code === 'Space') && !isTextEntry(event.target)) event.preventDefault()
}

// Audio files dropped on the window go to the songs of the project (section 6).
function hasFiles(event: DragEvent): boolean {
  return store.mode === 'edit' && !!event.dataTransfer && Array.from(event.dataTransfer.types).includes('Files')
}

function onDragEnter(event: DragEvent): void {
  if (!hasFiles(event)) return
  dropDepth++
  dropping.value = true
}

function onDragOver(event: DragEvent): void {
  if (!hasFiles(event)) return
  event.preventDefault()
  if (event.dataTransfer) event.dataTransfer.dropEffect = 'copy'
}

function onDragLeave(event: DragEvent): void {
  if (!hasFiles(event)) return
  dropDepth = Math.max(0, dropDepth - 1)
  if (dropDepth === 0) dropping.value = false
}

function onDrop(event: DragEvent): void {
  if (!hasFiles(event)) return
  event.preventDefault()
  dropDepth = 0
  dropping.value = false
  void addSongFiles(Array.from(event.dataTransfer?.files ?? []))
}

async function focusTitle(): Promise<void> {
  await nextTick()
  const field = document.getElementById('step-title') as HTMLInputElement | null
  field?.focus()
}

onMounted(() => {
  window.addEventListener('keydown', onKeyDown, true)
  window.addEventListener('keyup', onKeyUp, true)
})

onBeforeUnmount(() => {
  window.removeEventListener('keydown', onKeyDown, true)
  window.removeEventListener('keyup', onKeyUp, true)
})
</script>

<template>
  <div
    v-if="store.project"
    class="project"
    @dragenter="onDragEnter"
    @dragover="onDragOver"
    @dragleave="onDragLeave"
    @drop="onDrop"
  >
    <ProjectHeader @back="leaveProject" />
    <p v-if="store.loading" class="loading">
      {{ t('project.loading', { done: store.loading.done, total: store.loading.total }) }}
    </p>
    <template v-else>
      <div class="middle">
        <StepList @added="focusTitle" />
        <KindPanel v-if="store.mode === 'edit'" :dropping="dropping" />
      </div>
      <NowBar :compact="store.mode === 'edit'" />
      <StepEditor v-if="store.mode === 'edit'" @added="focusTitle" />
    </template>
  </div>
</template>

<style scoped>
.project {
  display: flex;
  flex-direction: column;
  height: 100%;
}

.loading {
  padding: 24px 20px;
  color: var(--text-muted);
}

.middle {
  flex: 1 1 auto;
  min-height: 0;
  display: flex;
}
</style>

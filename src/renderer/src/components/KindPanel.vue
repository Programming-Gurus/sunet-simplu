<script setup lang="ts">
// The panel on the right in Edit mode (DESIGN.md, 4.3 and section 6).
// It sets what the selected step is, and it holds the songs of the project.
import { computed, ref } from 'vue'
import type { Song } from '@shared/types'
import AppIcon from './AppIcon.vue'
import { formatClock } from '@/lib/format'
import { countFiles, t } from '@/lib/i18n'
import { addSongFiles, deleteSong, selectedStep, setKind, store } from '@/lib/projectStore'
import { isPreviewing, previewAvailable, stepState, stopPreviewOf, togglePreviewSong } from '@/lib/show'
import { AUDIO_EXTENSIONS } from '@shared/types'

defineProps<{ dropping: boolean }>()

const fileInput = ref<HTMLInputElement | null>(null)
const accept = AUDIO_EXTENSIONS.map((extension) => `.${extension}`).join(',')

const step = computed(() => selectedStep())
/** The kind of a step that plays cannot change. Stop it first. */
const locked = computed(() => !!step.value && stepState(step.value.id) !== 'idle' && stepState(step.value.id) !== 'interrupted')

function choose(kind: 'note' | 'stop'): void {
  if (!step.value || locked.value) return
  setKind(store.cursor, kind)
}

function chooseSong(song: Song): void {
  if (!step.value || locked.value) return
  setKind(store.cursor, 'song', song.id)
}

function isSong(song: Song): boolean {
  return step.value?.kind === 'song' && step.value.songId === song.id
}

function pickFiles(): void {
  fileInput.value?.click()
}

function onFiles(event: Event): void {
  const input = event.target as HTMLInputElement
  const files = Array.from(input.files ?? [])
  input.value = ''
  void addSongFiles(files)
}

async function remove(song: Song): Promise<void> {
  stopPreviewOf(`song:${song.id}`)
  await deleteSong(song)
}
</script>

<template>
  <aside v-if="store.project" class="panel" :class="{ dropping }" :aria-label="t('kind.titleNone') + ', ' + t('kind.songs')">
    <h2 id="kind-title" class="caps">
      {{ step ? t('kind.title', { n: store.cursor + 1 }) : t('kind.titleNone') }}
    </h2>
    <p v-if="!step" class="hint">{{ t('kind.selectStep') }}</p>
    <p v-else-if="locked" class="hint">{{ t('kind.lockedPlaying') }}</p>

    <div class="options" role="radiogroup" aria-labelledby="kind-title">
      <button
        type="button"
        role="radio"
        class="option"
        :class="{ on: step?.kind === 'note' }"
        :aria-checked="step?.kind === 'note'"
        :disabled="!step || locked"
        @click="choose('note')"
      >
        <span class="dot" aria-hidden="true"></span>
        <AppIcon name="note" :size="17" class="option-icon" />
        <span>{{ t('kind.note') }}</span>
      </button>
      <button
        type="button"
        role="radio"
        class="option"
        :class="{ on: step?.kind === 'stop' }"
        :aria-checked="step?.kind === 'stop'"
        :disabled="!step || locked"
        @click="choose('stop')"
      >
        <span class="dot" aria-hidden="true"></span>
        <AppIcon name="stop" :size="17" class="option-icon" />
        <span>{{ t('kind.stop') }}</span>
      </button>

      <div class="songs-head">
        <h3 class="caps">{{ t('kind.songs') }}</h3>
        <span class="count">{{ countFiles(store.project.songs.length) }}</span>
      </div>

      <ul class="songs">
        <li v-for="song in store.project.songs" :key="song.id" class="song">
          <button
            type="button"
            role="radio"
            class="option song-option"
            :class="{ on: isSong(song) }"
            :aria-checked="isSong(song)"
            :disabled="!step || locked"
            @click="chooseSong(song)"
          >
            <span class="dot" aria-hidden="true"></span>
            <span class="song-name mono">{{ song.name }}</span>
            <AppIcon v-if="store.media[song.id]?.url === null" name="warning" :size="15" class="song-missing" />
            <span class="song-time mono">{{ formatClock(song.duration) }}</span>
          </button>
          <button
            type="button"
            class="small-btn preview"
            :class="{ on: isPreviewing(`song:${song.id}`) }"
            :aria-label="t(isPreviewing(`song:${song.id}`) ? 'kind.previewSongStop' : 'kind.previewSong', { name: song.name })"
            :disabled="!previewAvailable() || store.media[song.id]?.url == null"
            @click="togglePreviewSong(song.id)"
          >
            <AppIcon :name="isPreviewing(`song:${song.id}`) ? 'stopSolid' : 'headphones'" :size="isPreviewing(`song:${song.id}`) ? 13 : 18" />
          </button>
          <button type="button" class="small-btn" :aria-label="t('kind.deleteSong', { name: song.name })" @click="remove(song)">
            <AppIcon name="trash" :size="17" />
          </button>
        </li>
        <li v-for="name in store.adding" :key="`adding-${name}`" class="adding">{{ t('kind.adding', { name }) }}</li>
      </ul>
    </div>

    <button type="button" class="add" @click="pickFiles">
      <span class="add-title">{{ dropping ? t('kind.dropNow') : t('kind.addSongs') }}</span>
      <span v-if="!dropping" class="add-hint">{{ t('kind.dropHint') }}</span>
    </button>
    <input ref="fileInput" class="file-input" type="file" multiple :accept="accept" tabindex="-1" aria-hidden="true" @change="onFiles" />
  </aside>
</template>

<style scoped>
.panel {
  flex: 0 0 340px;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 16px 12px 12px 16px;
  border-left: 1px solid var(--line);
}

.panel.dropping {
  background: var(--surface);
}

.hint {
  font-size: 13px;
  color: var(--text-muted);
}

.options {
  flex: 1 1 auto;
  min-height: 0;
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding-right: 4px;
  overflow-y: auto;
}

.option {
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
  min-height: 40px;
  padding: 0 10px;
  border: 1px solid transparent;
  border-radius: 10px;
  background: transparent;
  text-align: left;
  cursor: pointer;
}

.option:hover:not(:disabled) {
  border-color: var(--line);
}

.option.on {
  border-color: var(--line-light);
  background: var(--surface-2);
}

.option:disabled {
  cursor: default;
}

.option:disabled:not(.on) {
  opacity: 0.5;
}

.dot {
  flex: 0 0 auto;
  width: 18px;
  height: 18px;
  border: 2px solid var(--text-dim);
  border-radius: 50%;
}

.option.on .dot {
  border-color: var(--hall);
  background: radial-gradient(circle, var(--hall) 0 4.5px, transparent 5.5px);
}

.option-icon {
  flex: 0 0 auto;
  color: var(--text-muted);
}

.songs-head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 12px;
  margin-top: 4px;
  padding: 10px 6px 2px 0;
  border-top: 1px solid var(--line);
}

.count {
  font-size: 13px;
  color: var(--text-dim);
}

.songs {
  display: flex;
  flex-direction: column;
  gap: 4px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.song {
  display: flex;
  align-items: center;
}

.song-option {
  flex: 1 1 auto;
  min-width: 0;
}

.song-name {
  flex: 1 1 auto;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 13px;
}

.option.on .song-name {
  font-weight: 500;
}

.song-missing {
  flex: 0 0 auto;
  color: var(--danger);
}

.song-time {
  flex: 0 0 auto;
  font-size: 12.5px;
  color: var(--text-dim);
}

.option.on .song-time {
  color: var(--text-muted);
}

.small-btn {
  display: flex;
  flex: 0 0 auto;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 40px;
  padding: 0;
  border: 0;
  border-radius: 8px;
  background: transparent;
  color: var(--text-dim);
  cursor: pointer;
}

.small-btn:hover:not(:disabled) {
  color: var(--text);
}

.small-btn.preview {
  color: var(--preview);
}

.small-btn.preview.on {
  background: var(--preview);
  color: var(--preview-ink);
}

.small-btn:disabled {
  opacity: 0.3;
  cursor: default;
}

.adding {
  padding: 10px;
  font-size: 13px;
  color: var(--text-muted);
}

.add {
  display: flex;
  flex: 0 0 auto;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 2px;
  min-height: 56px;
  margin-right: 8px;
  border: 1px dashed var(--line-strong);
  border-radius: 10px;
  background: transparent;
  cursor: pointer;
}

.add:hover,
.dropping .add {
  border-color: var(--text);
}

.add-title {
  font-size: 15px;
}

.add-hint {
  font-size: 12.5px;
  color: var(--text-dim);
}

.file-input {
  display: none;
}
</style>

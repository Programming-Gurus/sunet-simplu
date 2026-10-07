<script setup lang="ts">
// One line of the step list (DESIGN.md, 3.2). Compact in Edit mode, large in Show mode.
import { computed, ref, watch } from 'vue'
import { activeSettings, clamp, continueAvailable, partOf, stopTargets } from '@shared/project'
import type { Step } from '@shared/types'
import AppIcon from './AppIcon.vue'
import LightChips from './LightChips.vue'
import { engineState } from '@/lib/engine'
import { formatClock, formatFade } from '@/lib/format'
import { language, t } from '@/lib/i18n'
import { songOf, store } from '@/lib/projectStore'
import { engineView, isPreviewing, pressPlay, pressStop, previewAvailable, previewElapsed, stepState, togglePreviewStep } from '@/lib/show'
import { stepTitle, titleIsTrigger, triggerTexts } from '@/lib/stepText'

const props = defineProps<{ step: Step; index: number }>()

const number = computed(() => props.index + 1)
const show = computed(() => store.mode === 'show')
const isCursor = computed(() => store.cursor === props.index)
const song = computed(() => songOf(props.step))
const state = computed(() => stepState(props.step.id))
const previewing = computed(() => isPreviewing(`step:${props.step.id}`))
const missing = computed(() => !!song.value && !store.loading && store.media[song.value.id]?.url == null)

const title = computed(() => stepTitle(props.step))
const untitled = computed(() => props.step.kind === 'note' && !props.step.title.trim() && !titleIsTrigger(props.step))
/** The triggers below the title (4.4). A trigger that is the first line of the step does not show again. */
const triggers = computed(() => triggerTexts(props.step).slice(titleIsTrigger(props.step) ? 1 : 0))

/** "0:12 – 2:40", only if the points are not the default. */
const points = computed(() => {
  const settings = activeSettings(props.step)
  if (!settings || !song.value) return ''
  const part = partOf(settings, song.value.duration)
  if (part.naturalStart && part.naturalEnd) return ''
  return `${formatClock(part.start)} – ${formatClock(part.end)}`
})

const continues = computed(() => {
  const settings = activeSettings(props.step)
  return !!settings?.continue && continueAvailable(store.project?.steps ?? [], props.index)
})

/**
 * What is not the default in the fades of the step (5.3): "no fade" for a switch that is off,
 * and a fade time of its own.
 */
const fades = computed(() => {
  const settings = activeSettings(props.step)
  if (!settings) return ''
  if (!settings.fadesIn && !settings.fadesOut) return t('steps.noFade')
  const time = (seconds: number): string => formatFade(seconds, language.value)
  const fadeIn = !settings.fadesIn ? t('steps.noFadeIn') : settings.fadeInTime !== null ? t('steps.fadeInTime', { time: time(settings.fadeInTime) }) : ''
  const fadeOut = !settings.fadesOut ? t('steps.noFadeOut') : settings.fadeOutTime !== null ? t('steps.fadeOutTime', { time: time(settings.fadeOutTime) }) : ''
  return [fadeIn, fadeOut].filter(Boolean).join(' · ')
})

/** The position of the sound of this step in its part, 0–100 (3.2). `null` if the step makes no sound. */
const progress = computed(() => {
  const sound = engineState.sounds.findLast((item) => item.stepId === props.step.id)
  if (!sound) return null
  const length = sound.end - sound.start
  return length > 0 ? clamp(((sound.position - sound.start) / length) * 100, 0, 100) : 0
})

const details = computed(() =>
  [
    points.value,
    continues.value ? t('steps.continues') : '',
    activeSettings(props.step)?.background ? t('steps.background') : '',
    fades.value,
  ]
    .filter(Boolean)
    .join(' · '),
)

/** What a stop step stops (5.2): "Stops step 3". */
const stops = computed(() => {
  const steps = store.project?.steps ?? []
  if (props.step.kind !== 'stop') return ''
  const numbers = stopTargets(steps, props.index)
    .map((id) => steps.findIndex((step) => step.id === id) + 1)
    .sort((a, b) => a - b)
  if (numbers.length === 0) return t('steps.stopsNothing')
  return t(numbers.length === 1 ? 'steps.stopsOne' : 'steps.stopsMany', { list: numbers.join(', ') })
})

// If you run a step whose file is missing, its warning flashes (5.8).
const flashing = ref(false)
watch(
  () => engineView.missingFlash.count,
  () => {
    if (engineView.missingFlash.stepId !== props.step.id) return
    flashing.value = false
    requestAnimationFrame(() => (flashing.value = true))
  },
)

const icon = computed(() => (props.step.kind === 'song' ? 'song' : props.step.kind === 'stop' ? 'stop' : 'note'))

function mainButton(): void {
  if (state.value === 'playing') pressStop(props.step.id)
  else pressPlay(props.index)
}
</script>

<template>
  <div
    class="row"
    :class="[show ? 'large' : 'compact', `is-${state}`, { cursor: isCursor, note: step.kind === 'note' }]"
    :aria-current="isCursor ? 'true' : undefined"
  >
    <span v-if="!show && isCursor" class="grip" aria-hidden="true"
      ><span></span><span></span><span></span><span></span><span></span><span></span
    ></span>
    <span class="number mono">{{ number }}</span>
    <span class="kind" :class="step.kind"><AppIcon :name="icon" :size="show ? 20 : 17" /></span>

    <div class="texts">
      <div class="title-line">
        <span class="title" :class="{ untitled }">{{ title }}</span>
        <span v-if="state === 'playing' || state === 'fadingOut'" class="tag tag-hall">
          <span class="tag-bars" aria-hidden="true"><span></span><span></span><span></span><span></span></span>
          <span>{{ t(state === 'fadingOut' ? 'steps.fadingOut' : 'steps.playing') }}</span>
        </span>
        <span v-else-if="state === 'interrupted'" class="tag tag-danger">
          <slot name="interrupted"></slot>
        </span>
      </div>
      <div v-if="triggers.length > 0 || step.notes" class="below">
        <span v-for="item in triggers" :key="item.kind" class="trigger" :class="item.kind">
          <AppIcon :name="item.kind" :size="show ? 15 : 13" class="trigger-icon" />
          <span>{{ item.text }}</span>
        </span>
        <span v-if="step.notes" class="notes">{{ step.notes }}</span>
      </div>
      <LightChips :step="step" :large="show" />
    </div>

    <span v-if="show && isCursor" class="next">
      <span>{{ t('steps.next') }}</span>
      <kbd>Space</kbd>
    </span>

    <span v-if="step.kind === 'stop'" class="stops mono">{{ stops }}</span>
    <!-- A stop step has a Stop button, so the mouse can run it too (5.1). -->
    <button
      v-if="step.kind === 'stop'"
      type="button"
      class="play-btn stop-step-btn"
      :aria-label="show ? undefined : t('steps.stop', { n: number })"
      @click.stop="pressPlay(index)"
    >
      <AppIcon name="stopSolid" :size="14" />
      <span v-if="show">Stop</span>
    </button>

    <template v-if="step.kind === 'song' && song">
      <span v-if="previewing" class="previewing">
        <span>{{ t('steps.previewing') }}</span>
        <span class="mono">{{ formatClock(previewElapsed()) }}</span>
      </span>
      <span v-if="missing" class="missing" :class="{ flash: flashing }" role="alert">
        <AppIcon name="warning" :size="16" />
        <span>{{ t('steps.missingFile') }}</span>
      </span>
      <span class="file mono">
        <span class="file-name">{{ song.name }}</span>
        <span v-if="details" class="file-details">{{ details }}</span>
      </span>
      <button
        type="button"
        class="preview-btn"
        :class="{ on: previewing }"
        :aria-label="t(previewing ? 'steps.previewStop' : 'steps.preview', { n: number })"
        :aria-pressed="previewing"
        :disabled="(!previewAvailable() && !previewing) || missing"
        @click.stop="togglePreviewStep(index)"
      >
        <AppIcon :name="previewing ? 'stopSolid' : 'headphones'" :size="previewing ? 14 : show ? 20 : 18" />
      </button>
      <button
        type="button"
        class="play-btn"
        :class="{ stop: state === 'playing' }"
        :aria-label="show ? undefined : t(state === 'playing' ? 'steps.stop' : 'steps.play', { n: number })"
        :disabled="state === 'fadingOut'"
        @click.stop="mainButton"
      >
        <AppIcon :name="state === 'playing' ? 'stopSolid' : 'play'" :size="state === 'playing' ? 14 : show ? 16 : 15" />
        <span v-if="show">{{ state === 'playing' ? 'Stop' : 'Play' }}</span>
      </button>
    </template>

    <!-- The progress of a step that plays or fades out (3.2). -->
    <div v-if="progress !== null" class="step-progress" role="img" :aria-label="t('steps.progress', { n: number, percent: Math.round(progress) })">
      <div :style="{ width: `${progress}%` }"></div>
    </div>
  </div>
</template>

<style scoped>
.row {
  position: relative;
  display: flex;
  align-items: center;
  border: 1px solid transparent;
  cursor: pointer;
  scroll-margin: 72px 0;
}

.step-progress {
  position: absolute;
  right: 12px;
  bottom: 2px;
  left: 12px;
  height: 3px;
  border-radius: 2px;
  background: var(--hall-line-soft);
  overflow: hidden;
  pointer-events: none;
}

.large .step-progress {
  right: 16px;
  bottom: 3px;
  left: 16px;
  height: 4px;
}

.step-progress div {
  height: 100%;
  background: var(--hall);
}

.compact {
  gap: 12px;
  min-height: 58px;
  padding: 6px 12px;
  border-radius: 10px;
}

.large {
  gap: 16px;
  min-height: 66px;
  padding: 10px 16px;
  border-radius: 12px;
}

.compact.cursor {
  border-color: var(--line-light);
  background: var(--surface-2);
}

.large.cursor {
  border: 2px solid var(--text);
  padding: 9px 15px;
}

.row.is-playing,
.row.is-fadingOut {
  border-color: var(--hall-line);
  background: var(--hall-bg);
}

.row.is-fadingOut {
  opacity: 0.75;
}

.row.is-interrupted {
  border: 1px dashed var(--danger);
  background: var(--danger-bg);
}

.large.cursor.is-playing,
.large.cursor.is-fadingOut {
  border-color: var(--text);
}

.grip {
  display: grid;
  grid-template-columns: repeat(2, 3px);
  gap: 3px;
  margin: 0 -2px 0 -4px;
  cursor: grab;
}

.grip span {
  width: 3px;
  height: 3px;
  border-radius: 2px;
  background: var(--text-dim);
}

.number {
  flex: 0 0 auto;
  text-align: right;
  color: var(--text-dim);
}

.compact .number {
  width: 22px;
  font-size: 14px;
}

.compact.cursor .number {
  width: 12px;
  color: var(--text);
}

.large .number {
  width: 26px;
  font-size: 15px;
}

.large.cursor .number {
  color: var(--text);
}

.is-playing .number,
.is-fadingOut .number {
  color: var(--hall);
}

.kind {
  display: flex;
  flex: 0 0 auto;
  align-items: center;
  justify-content: center;
  background: var(--surface-2);
  color: var(--text);
}

.compact .kind {
  width: 32px;
  height: 32px;
  border-radius: 8px;
}

.large .kind {
  width: 38px;
  height: 38px;
  border-radius: 9px;
}

.compact.cursor .kind {
  background: var(--line);
}

.kind.note {
  border: 1px dashed var(--line-strong);
  background: transparent;
  color: var(--text-muted);
}

.is-playing .kind,
.is-fadingOut .kind {
  background: var(--hall);
  color: var(--hall-ink);
}

.texts {
  flex: 1 1 auto;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.title-line {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 4px 12px;
}

.title {
  min-width: 0;
  font-weight: 500;
  overflow-wrap: anywhere;
}

.compact .title {
  font-size: 16px;
}

.compact.cursor .title {
  font-weight: 600;
}

.large .title {
  font-size: 18px;
}

.large.is-playing .title {
  font-size: 20px;
  font-weight: 600;
}

.title.untitled {
  color: var(--text-dim);
  font-weight: 400;
}

.below {
  color: var(--text-muted);
}

/* Edit mode: the triggers and the notes share one line. */
.compact .below {
  font-size: 13.5px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.compact .below > * + *::before {
  content: '·';
  margin: 0 8px;
  color: var(--text-dim);
}

/* Show mode: each trigger has its own line, so you read it at a glance. */
.large .below {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.trigger {
  color: var(--text-warm);
}

.trigger-icon {
  margin-right: 5px;
  vertical-align: -2px;
  color: var(--text-dim);
}

.large .trigger {
  font-size: 15.5px;
  overflow-wrap: anywhere;
}

.large .trigger-icon {
  margin-right: 7px;
}

.large .notes {
  font-size: 14.5px;
  white-space: pre-line;
  overflow-wrap: anywhere;
}

.is-playing .below {
  color: var(--text-warm);
}

.is-playing .trigger {
  color: var(--text);
}

.tag {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 3px 10px;
  border-radius: 999px;
  font-size: 12px;
  font-weight: 600;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  white-space: nowrap;
}

.tag-hall {
  background: var(--hall);
  color: var(--hall-ink);
}

.tag-danger {
  background: var(--danger);
  color: #2a0f0a;
}

.tag-bars {
  display: flex;
  align-items: flex-end;
  gap: 2px;
  height: 12px;
}

.tag-bars span {
  width: 3px;
  border-radius: 1px;
  background: var(--hall-ink);
}

.tag-bars span:nth-child(1) {
  height: 6px;
}

.tag-bars span:nth-child(2) {
  height: 12px;
}

.tag-bars span:nth-child(3) {
  height: 8px;
}

.tag-bars span:nth-child(4) {
  height: 10px;
}

.next {
  display: flex;
  flex: 0 0 auto;
  align-items: center;
  gap: 10px;
  font-size: 14px;
}

.next kbd {
  padding: 4px 12px;
  border-color: var(--text);
  border-radius: 7px;
  font-size: 13px;
}

.previewing {
  display: flex;
  flex: 0 0 auto;
  gap: 8px;
  font-size: 13px;
  color: var(--preview);
}

.missing {
  display: flex;
  flex: 0 0 auto;
  align-items: center;
  gap: 6px;
  padding: 4px 8px;
  border-radius: 7px;
  font-size: 13px;
  color: var(--danger);
}

.file {
  flex: 0 1 auto;
  min-width: 0;
  max-width: 44%;
  color: var(--text-muted);
}

.stops {
  flex: 0 1 auto;
  min-width: 0;
  color: var(--text-muted);
  font-size: 13px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.compact .stops {
  font-size: 12.5px;
}

.compact .file {
  font-size: 12.5px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.compact .file-details::before {
  content: ' · ';
}

.large .file {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 2px;
  font-size: 13px;
  text-align: right;
}

.large .file-name {
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.is-playing .file {
  color: var(--text-warm);
}

.is-playing .file-details {
  color: var(--hall);
}

.preview-btn {
  display: flex;
  flex: 0 0 auto;
  align-items: center;
  justify-content: center;
  width: 44px;
  height: 44px;
  padding: 0;
  border: 1px solid var(--line);
  border-radius: 10px;
  background: transparent;
  color: var(--preview);
  cursor: pointer;
}

.cursor .preview-btn {
  border-color: var(--line-strong);
}

.is-playing .preview-btn {
  border-color: var(--hall-line-soft);
}

.preview-btn.on {
  border: 0;
  background: var(--preview);
  color: var(--preview-ink);
}

.preview-btn:disabled {
  opacity: 0.3;
  cursor: default;
}

.play-btn {
  display: flex;
  flex: 0 0 auto;
  align-items: center;
  justify-content: center;
  gap: 8px;
  height: 44px;
  padding: 0;
  border: 0;
  border-radius: 10px;
  background: var(--text);
  color: var(--bg);
  font-size: 16px;
  font-weight: 600;
  cursor: pointer;
}

.compact .play-btn {
  width: 44px;
}

.large .play-btn {
  width: 132px;
}

.play-btn.stop {
  background: var(--hall);
  color: var(--hall-ink);
}

.play-btn:disabled {
  opacity: 0.4;
  cursor: default;
}
</style>

<script setup lang="ts">
// The panel at the bottom in Edit mode: the fields of the selected step (DESIGN.md, 4.1, 5.4).
// What the step is, you set in the panel on the right.
import { computed, ref, watch } from 'vue'
import {
  activeSettings,
  continueAvailable,
  endValue,
  limitValue,
  partOf,
  roundFade,
  setStopTarget,
  startValue,
  stepFades,
  stopCandidates,
  stopsChosen,
  stopTargets,
  TRIGGER_TEXT_MAX,
} from '@shared/project'
import AppIcon from './AppIcon.vue'
import LightsEditor from './LightsEditor.vue'
import WaveformEditor from './WaveformEditor.vue'
import { confirmDialog } from '@/lib/dialogs'
import { formatClock, formatFade, formatPoint, parseFade, parsePoint } from '@/lib/format'
import { language, t } from '@/lib/i18n'
import { addStep, deleteStep, duplicateStep, selectedStep, songOf, store, touch } from '@/lib/projectStore'
import { previewState } from '@/lib/preview'
import { applyStepVolume, isPreviewing, previewAvailable, stepState, stopPreviewOf, toggleListen } from '@/lib/show'

const emit = defineEmits<{ added: [] }>()

const step = computed(() => selectedStep())
const number = computed(() => store.cursor + 1)
const song = computed(() => songOf(step.value))
const settings = computed(() => (step.value ? activeSettings(step.value) : null))
const media = computed(() => (song.value ? store.media[song.value.id] : undefined))
const part = computed(() => (settings.value && song.value ? partOf(settings.value, song.value.duration) : null))
const canContinue = computed(() => continueAvailable(store.project?.steps ?? [], store.cursor))
const showLimit = computed(() => !!settings.value?.continue && canContinue.value)
const playing = computed(() => !!step.value && ['playing', 'fadingOut'].includes(stepState(step.value.id)))
const listening = computed(() => isPreviewing('listen'))

const waveform = ref<InstanceType<typeof WaveformEditor> | null>(null)
const waveMedia = ref<HTMLAudioElement | null>(null)
const position = ref(0)
const startText = ref('')
const endText = ref('')
const limitText = ref('')

watch(
  () => [part.value?.start, part.value?.end, part.value?.limit, language.value],
  () => {
    if (!part.value) return
    startText.value = formatPoint(part.value.start, language.value)
    endText.value = formatPoint(part.value.end, language.value)
    limitText.value = formatPoint(part.value.limit, language.value)
  },
  { immediate: true },
)

function setStart(seconds: number): void {
  if (!settings.value || !part.value) return
  settings.value.start = startValue(seconds, part.value.end)
  touch()
}

function setEnd(seconds: number): void {
  if (!settings.value || !part.value || !song.value) return
  settings.value.end = endValue(seconds, part.value.start, song.value.duration)
  touch()
}

function setLimit(seconds: number): void {
  if (!settings.value || !part.value) return
  settings.value.limit = limitValue(seconds, part.value.start, part.value.end)
  touch()
}

function commitPoint(which: 'start' | 'end' | 'limit'): void {
  if (!part.value) return
  const field = which === 'start' ? startText : which === 'end' ? endText : limitText
  const parsed = parsePoint(field.value)
  if (parsed !== null) {
    if (which === 'start') setStart(parsed)
    else if (which === 'end') setEnd(parsed)
    else setLimit(parsed)
  }
  // Show the value that the app kept, also if it refused the text.
  field.value = formatPoint(part.value[which], language.value)
}

function reset(): void {
  if (!settings.value) return
  settings.value.start = null
  settings.value.end = null
  settings.value.limit = null
  touch()
  waveform.value?.setPosition(0)
}

function setVolume(event: Event): void {
  if (!settings.value) return
  settings.value.volume = Number((event.target as HTMLInputElement).value)
  if (step.value) applyStepVolume(step.value.id, settings.value.volume)
  touch()
}

function setFlag(flag: 'loop' | 'continue' | 'fadesIn' | 'fadesOut' | 'background', event: Event): void {
  if (!settings.value) return
  settings.value[flag] = (event.target as HTMLInputElement).checked
  touch()
}

// What triggers the step (4.4): a line, an action, or both.
function setTrigger(which: 'line' | 'action', event: Event): void {
  if (!step.value) return
  step.value.trigger[which] = (event.target as HTMLInputElement).checked
  touch()
}

// The fade times of the step (5.3). An empty field follows the project and shows its time dimmed.
type FadeField = 'fadeInTime' | 'fadeOutTime'
const fadeTexts = ref<Record<FadeField, string>>({ fadeInTime: '', fadeOutTime: '' })
const projectFades = computed(() => ({
  fadeInTime: formatFade(store.project?.fadeIn ?? 0, language.value),
  fadeOutTime: formatFade(store.project?.fadeOut ?? 0, language.value),
}))

function showFadeTimes(): void {
  const own = settings.value
  fadeTexts.value = {
    fadeInTime: own?.fadeInTime == null ? '' : formatFade(own.fadeInTime, language.value),
    fadeOutTime: own?.fadeOutTime == null ? '' : formatFade(own.fadeOutTime, language.value),
  }
}
watch(() => [settings.value, settings.value?.fadeInTime, settings.value?.fadeOutTime, language.value], showFadeTimes, { immediate: true })

function setFadeTime(which: FadeField, seconds: number | null): void {
  if (!settings.value) return
  if (settings.value[which] !== seconds) {
    settings.value[which] = seconds
    touch()
  }
  showFadeTimes()
}

function commitFadeTime(which: FadeField): void {
  if (!settings.value || !store.project) return
  const text = fadeTexts.value[which]
  const parsed = parseFade(text)
  // An empty field returns the step to the time of the project. The app refuses other text.
  if (text.trim() === '') setFadeTime(which, null)
  else if (parsed !== null) setFadeTime(which, roundFade(parsed, stepFades(settings.value, store.project)[which === 'fadeInTime' ? 'fadeIn' : 'fadeOut']))
  else showFadeTimes()
}

const fadeRows = [
  { flag: 'fadesIn', time: 'fadeInTime', switchId: 'step-fades-in', timeId: 'step-fade-in-time', label: 'editor.fadeIn', timeLabel: 'editor.fadeInTime', resetLabel: 'editor.fadeInReset' },
  { flag: 'fadesOut', time: 'fadeOutTime', switchId: 'step-fades-out', timeId: 'step-fade-out-time', label: 'editor.fadeOut', timeLabel: 'editor.fadeOutTime', resetLabel: 'editor.fadeOutReset' },
] as const

// A stop step: the song steps above it, nearest first, and which of them it stops (5.2).
const stopOptions = computed(() => {
  const steps = store.project?.steps ?? []
  if (step.value?.kind !== 'stop') return []
  const targets = stopTargets(steps, store.cursor)
  return stopCandidates(steps, store.cursor).map((candidate) => {
    const candidateSong = songOf(candidate)
    return {
      id: candidate.id,
      number: steps.indexOf(candidate) + 1,
      title: candidate.title.trim() || candidateSong?.name || '',
      song: candidate.title.trim() ? (candidateSong?.name ?? '') : '',
      checked: targets.includes(candidate.id),
    }
  })
})
const stopsByChoice = computed(() => stopsChosen(store.project?.steps ?? [], store.cursor))

function setStop(targetId: string, event: Event): void {
  if (!store.project) return
  const box = event.target as HTMLInputElement
  setStopTarget(store.project.steps, store.cursor, targetId, box.checked)
  // At least one step stays checked: without a choice, the default returns.
  box.checked = stopTargets(store.project.steps, store.cursor).includes(targetId)
  touch()
}

function resetStops(): void {
  if (!step.value) return
  step.value.stops = []
  touch()
}

function listen(): void {
  if (!waveMedia.value || !part.value || !settings.value) return
  toggleListen({ element: waveMedia.value, from: position.value, volume: settings.value.volume, loop: settings.value.loop, part: part.value })
}

function onMedia(element: HTMLAudioElement | null): void {
  // The waveform went away, for example because a different step is selected: Listen stops.
  if (element !== waveMedia.value) stopPreviewOf('listen')
  waveMedia.value = element
}

function blurOnEnter(event: KeyboardEvent): void {
  ;(event.target as HTMLElement).blur()
}

function addBelow(): void {
  addStep(store.cursor + 1)
  emit('added')
}

async function remove(): Promise<void> {
  const target = step.value
  if (!target) return
  const index = store.cursor
  const confirmed = await confirmDialog({
    title: t('steps.deleteTitle', { n: index + 1 }),
    body: target.title || undefined,
    confirm: t('steps.deleteConfirm'),
    danger: true,
  })
  if (confirmed && store.project?.steps[index] === target) deleteStep(index)
}
</script>

<template>
  <section v-if="step" class="editor" :aria-label="t('editor.step', { n: number })">
    <div class="head">
      <h2>{{ t('editor.step', { n: number }) }}</h2>
      <span v-if="song" class="head-song mono">{{ song.name }}</span>
      <span v-if="playing" class="head-hint">{{ t('editor.lockedPlaying') }}</span>
      <div class="spacer"></div>
      <button type="button" class="btn btn-small" @click="addBelow">{{ t('steps.addBelow') }}</button>
      <button type="button" class="btn btn-small" @click="duplicateStep(store.cursor)">{{ t('common.duplicate') }}</button>
      <button type="button" class="btn btn-small btn-danger" :disabled="playing" @click="remove">{{ t('common.delete') }}</button>
    </div>

    <div class="body" :class="{ 'with-sound': !!song }">
      <div class="texts" :class="{ wide: !song && step.kind !== 'stop' }">
        <div class="labelled">
          <label for="step-title" class="field-label">{{ t('editor.title') }}</label>
          <input id="step-title" v-model="step.title" class="field" type="text" maxlength="200" @input="touch" @keydown.enter="blurOnEnter" />
        </div>
        <div class="labelled" role="group" :aria-label="t('editor.trigger')">
          <span class="field-label">{{ t('editor.trigger') }}</span>
          <div class="trigger">
            <label class="check trigger-check">
              <input id="step-trigger-line" type="checkbox" :checked="step.trigger.line" @change="setTrigger('line', $event)" />
              <span>{{ t('editor.triggerLine') }}</span>
            </label>
            <input
              id="step-line-text"
              v-model="step.trigger.lineText"
              class="field trigger-text"
              type="text"
              :maxlength="TRIGGER_TEXT_MAX"
              :disabled="!step.trigger.line"
              :aria-label="t('editor.lineText')"
              :placeholder="t('editor.linePlaceholder')"
              @input="touch"
              @keydown.enter="blurOnEnter"
            />
          </div>
          <div class="trigger">
            <label class="check trigger-check">
              <input id="step-trigger-action" type="checkbox" :checked="step.trigger.action" @change="setTrigger('action', $event)" />
              <span>{{ t('editor.triggerAction') }}</span>
            </label>
            <input
              id="step-action-text"
              v-model="step.trigger.actionText"
              class="field trigger-text"
              type="text"
              :maxlength="TRIGGER_TEXT_MAX"
              :disabled="!step.trigger.action"
              :aria-label="t('editor.actionText')"
              :placeholder="t('editor.actionPlaceholder')"
              @input="touch"
              @keydown.enter="blurOnEnter"
            />
          </div>
        </div>
        <div class="labelled grow">
          <label for="step-notes" class="field-label">{{ t('editor.notes') }}</label>
          <textarea id="step-notes" v-model="step.notes" class="field notes" maxlength="4000" @input="touch"></textarea>
        </div>
      </div>

      <div v-if="song && settings && part" class="sound">
        <template v-if="media?.url">
          <div class="scale mono">
            <span>0:00</span>
            <span>{{ formatClock(song.duration) }}</span>
          </div>
          <WaveformEditor
            ref="waveform"
            :key="`${step.id}:${song.id}:${previewState.generation}`"
            :url="media.url"
            :peaks="media.peaks"
            :duration="song.duration"
            :part="part"
            :show-limit="showLimit"
            :label="t('editor.waveform', { name: song.name })"
            @start="setStart"
            @end="setEnd"
            @limit="setLimit"
            @position="position = $event"
            @media="onMedia"
          />
        </template>
        <p v-else class="missing">
          <AppIcon name="warning" :size="18" />
          <span>{{ t('editor.missingFile') }}</span>
        </p>

        <div class="controls">
          <button type="button" class="btn btn-small btn-preview" :disabled="!previewAvailable() || !media?.url" @click="listen">
            <AppIcon :name="listening ? 'stopSolid' : 'headphones'" :size="listening ? 13 : 16" />
            <span>{{ listening ? 'Stop' : t('editor.listen') }}</span>
          </button>
          <span class="position mono">{{ formatPoint(position, language) }}</span>
          <div class="spacer"></div>
          <label for="start-point" class="field-label">{{ t('editor.start') }}</label>
          <input id="start-point" v-model="startText" class="field mono point" type="text" @blur="commitPoint('start')" @keydown.enter="blurOnEnter" />
          <label for="end-point" class="field-label">{{ t('editor.end') }}</label>
          <input id="end-point" v-model="endText" class="field mono point" type="text" @blur="commitPoint('end')" @keydown.enter="blurOnEnter" />
          <button type="button" class="btn btn-small" @click="reset">{{ t('editor.reset') }}</button>
        </div>

        <div class="controls">
          <div class="volume">
            <label for="step-volume" class="field-label">{{ t('editor.volume') }}</label>
            <input id="step-volume" type="range" min="0" max="100" :value="settings.volume" @input="setVolume" />
            <span class="percent mono">{{ settings.volume }}%</span>
          </div>
          <label class="check">
            <input type="checkbox" :checked="settings.loop" @change="setFlag('loop', $event)" />
            <span>{{ t('editor.loop') }}</span>
          </label>
          <label class="check" :class="{ off: !canContinue }" :title="canContinue ? undefined : t('editor.hintContinueOff')">
            <input type="checkbox" :checked="settings.continue && canContinue" :disabled="!canContinue" @change="setFlag('continue', $event)" />
            <span>{{ t('editor.continue') }}</span>
          </label>
          <div v-if="showLimit" class="limit">
            <label for="continue-limit" class="field-label">{{ t('editor.limit') }}</label>
            <input id="continue-limit" v-model="limitText" class="field mono point dashed" type="text" @blur="commitPoint('limit')" @keydown.enter="blurOnEnter" />
          </div>
        </div>

        <div class="controls switches">
          <div v-for="fade in fadeRows" :key="fade.time" class="fade-set">
            <label class="check">
              <input :id="fade.switchId" type="checkbox" :checked="settings[fade.flag]" @change="setFlag(fade.flag, $event)" />
              <span>{{ t(fade.label) }}</span>
            </label>
            <input
              :id="fade.timeId"
              v-model="fadeTexts[fade.time]"
              class="field mono fade-time"
              type="text"
              inputmode="decimal"
              :placeholder="projectFades[fade.time]"
              :disabled="!settings[fade.flag]"
              :aria-label="t(fade.timeLabel)"
              :title="t('editor.fadeTimeHint')"
              @blur="commitFadeTime(fade.time)"
              @keydown.enter="blurOnEnter"
            />
            <span class="unit">s</span>
            <button
              v-if="settings[fade.time] !== null"
              type="button"
              class="fade-reset"
              :aria-label="t(fade.resetLabel, { time: projectFades[fade.time] })"
              :title="t(fade.resetLabel, { time: projectFades[fade.time] })"
              @click="setFadeTime(fade.time, null)"
            >
              <AppIcon name="reset" :size="15" />
            </button>
          </div>
          <label class="check" :title="t('editor.hintBackground')">
            <input id="step-background" type="checkbox" :checked="settings.background" :disabled="playing" @change="setFlag('background', $event)" />
            <span>{{ t('editor.background') }}</span>
          </label>
          <div class="hints">
            <span v-if="settings.background">{{ t('editor.hintBackground') }}</span>
            <span v-else-if="showLimit">{{ t('editor.hintLimit') }}</span>
            <span v-else-if="!canContinue">{{ t('editor.hintContinueOff') }}</span>
            <span v-else>{{ t(settings.loop ? 'editor.hintLoop' : 'editor.hintFades') }}</span>
          </div>
        </div>
      </div>

      <div v-else-if="step.kind === 'stop'" class="stops">
        <div class="stops-head">
          <span class="field-label">{{ t('editor.stops') }}</span>
          <span v-if="stopOptions.length > 0 && !stopsByChoice" class="stops-auto">{{ t('editor.stopsAuto') }}</span>
          <button v-if="stopsByChoice" type="button" class="btn btn-small btn-quiet" @click="resetStops">{{ t('editor.stopsReset') }}</button>
        </div>
        <p v-if="stopOptions.length === 0" class="stops-none">{{ t('editor.stopsNone') }}</p>
        <div v-else class="stops-list">
          <label v-for="option in stopOptions" :key="option.id" class="check stop-option">
            <input type="checkbox" :checked="option.checked" @change="setStop(option.id, $event)" />
            <span class="stop-number mono">{{ option.number }}</span>
            <span class="stop-title">{{ option.title }}</span>
            <span v-if="option.song" class="stop-song mono">{{ option.song }}</span>
          </label>
        </div>
      </div>

      <LightsEditor :step="step" />
    </div>
  </section>
  <section v-else class="editor empty">{{ t('kind.selectStep') }}</section>
</template>

<style scoped>
.editor {
  flex: 0 0 auto;
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 14px 20px 16px;
  border-top: 1px solid var(--line);
  background: var(--surface);
}

.editor.empty {
  color: var(--text-muted);
}

.head {
  display: flex;
  align-items: center;
  gap: 12px;
}

.head h2 {
  flex: 0 0 auto;
  font-size: 16px;
  font-weight: 600;
}

.head-song {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 13px;
  color: var(--text-muted);
}

.head-hint {
  font-size: 12.5px;
  color: var(--hall);
}

.body {
  container: editor / inline-size;
  display: flex;
  flex-wrap: wrap;
  gap: 12px 28px;
}

/* A song step in a small window: the lights are a strip below the other fields. Its label goes to its left. */
@container editor (width < 1296px) {
  .body.with-sound > .lights {
    flex-direction: row;
    align-items: center;
    gap: 14px;
  }
}

.texts {
  flex: 1 1 300px;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.texts.wide {
  max-width: 760px;
}

.labelled {
  display: flex;
  flex-direction: column;
  gap: 5px;
}

.labelled.grow {
  flex: 1 1 auto;
}

.notes {
  flex: 1 1 auto;
  min-height: 58px;
}

.trigger {
  display: flex;
  align-items: center;
  gap: 10px;
}

.trigger + .trigger {
  margin-top: 1px;
}

.trigger-check {
  flex: 0 0 96px;
  min-height: 36px;
}

.trigger-text {
  flex: 1 1 auto;
  min-width: 0;
  height: 36px;
}

/* Wide enough that the lights go below the sound fields in a small window, and next to them in a large one. */
.sound {
  flex: 2 1 640px;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.scale {
  display: flex;
  justify-content: space-between;
  font-size: 12px;
  color: var(--text-dim);
}

.missing {
  display: flex;
  align-items: center;
  gap: 10px;
  min-height: 104px;
  padding: 0 16px;
  border: 1px dashed var(--danger-line);
  border-radius: 10px;
  color: var(--danger);
}

.controls {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px 14px;
}

.position {
  font-size: 14px;
  color: var(--preview);
}

.point {
  width: 84px;
  padding: 0 10px;
  border-color: var(--hall-line);
  color: var(--hall);
  font-size: 14px;
  text-align: right;
}

.point.dashed {
  border-style: dashed;
}

.volume {
  flex: 1 1 200px;
  min-width: 0;
  display: flex;
  align-items: center;
  gap: 12px;
}

.volume input {
  flex: 1 1 auto;
  min-width: 0;
}

.percent {
  width: 44px;
  font-size: 14px;
  text-align: right;
}

.check {
  display: flex;
  align-items: center;
  gap: 10px;
  min-height: 40px;
  font-size: 14px;
  cursor: pointer;
}

.check input {
  width: 20px;
  height: 20px;
  margin: 0;
}

.check.off {
  color: var(--text-dim);
  cursor: default;
}

.fade-set {
  display: flex;
  align-items: center;
  gap: 8px;
}

.fade-time {
  width: 62px;
  height: 34px;
  padding: 0 8px;
  border-radius: 8px;
  font-size: 14px;
  text-align: right;
}

.fade-time::placeholder {
  color: var(--text-dim);
}

.fade-time:disabled {
  opacity: 0.4;
}

.unit {
  margin-left: -3px;
  font-size: 13px;
  color: var(--text-muted);
}

.fade-reset {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 30px;
  height: 30px;
  margin-left: -2px;
  padding: 0;
  border: 0;
  border-radius: 7px;
  background: transparent;
  color: var(--text-muted);
  cursor: pointer;
}

.fade-reset:hover {
  background: var(--surface-2);
  color: var(--text);
}

.limit {
  display: flex;
  align-items: center;
  gap: 10px;
}

.hints {
  flex: 1 1 200px;
  min-width: 0;
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 2px 16px;
  font-size: 12.5px;
  color: var(--text-dim);
  text-align: right;
}

.stops {
  flex: 2 1 560px;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.stops-head {
  display: flex;
  align-items: center;
  gap: 14px;
  min-height: 38px;
}

.stops-auto,
.stops-none {
  font-size: 12.5px;
  color: var(--text-dim);
}

.stops-list {
  display: flex;
  flex-direction: column;
  max-height: 168px;
  padding: 2px 10px;
  border: 1px solid var(--line);
  border-radius: 10px;
  overflow-y: auto;
}

.stop-option {
  flex: 0 0 auto;
  min-height: 36px;
}

.stop-number {
  flex: 0 0 22px;
  color: var(--text-dim);
  text-align: right;
}

.stop-title {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.stop-song {
  flex: 0 1 auto;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 12.5px;
  color: var(--text-muted);
}
</style>

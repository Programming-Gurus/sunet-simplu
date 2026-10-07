<script setup lang="ts">
// The bottom bar (DESIGN.md, 3.2): the song that plays, the step that Space runs next,
// the level of each sound and the two outputs. Show mode has the full bar, Edit mode a thin one.
import { computed, ref, watch } from 'vue'
import AppIcon from './AppIcon.vue'
import { formatClock } from '@/lib/format'
import { t } from '@/lib/i18n'
import { engineState, type Sound } from '@/lib/engine'
import { store } from '@/lib/projectStore'
import { outputsView } from '@/lib/outputs'
import { fadeOutMusic } from '@/lib/show'
import { stepTitle as titleOf } from '@/lib/stepText'

const props = defineProps<{ compact?: boolean }>()

function numberOf(stepId: string): number {
  return (store.project?.steps.findIndex((step) => step.id === stepId) ?? -1) + 1
}

function labelOf(stepId: string): string {
  const number = numberOf(stepId)
  return number === 0 ? '' : `${number} · ${titleOf(store.project?.steps[number - 1])}`
}

/**
 * The sound that the bar shows large: the normal song that plays, else a background that plays,
 * else a sound that fades out. The bar shows silence only when no sound is left.
 */
const main = computed<Sound | null>(() => {
  const sounds = engineState.sounds
  return (
    sounds.findLast((sound) => !sound.fadingOut && !sound.background) ??
    sounds.findLast((sound) => !sound.fadingOut) ??
    sounds[sounds.length - 1] ??
    null
  )
})
const elapsed = computed(() => (main.value ? Math.max(0, main.value.position - main.value.start) : 0))
const total = computed(() => (main.value ? main.value.end - main.value.start : 0))
const percent = computed(() => (total.value > 0 ? Math.round(Math.min(1, elapsed.value / total.value) * 100) : 0))
const stateText = computed(() => {
  const sound = main.value
  if (!sound) return ''
  if (sound.fadingOut) return t('now.fadingOut')
  if (!sound.loop) return t('now.once')
  return sound.loopCount === 0 ? t('now.loopFirst') : t('now.loopNth', { n: sound.loopCount + 1 })
})
const playingCount = computed(() => engineState.sounds.filter((sound) => !sound.fadingOut).length)

// One meter for each sound, the large one first. The thin bar has room for fewer meters.
const ordered = computed(() => {
  const first = main.value
  const others = engineState.sounds.filter((sound) => sound !== first).reverse()
  return first ? [first, ...others] : []
})
const meters = computed(() => ordered.value.slice(0, props.compact ? 2 : 4))
const hiddenMeters = computed(() => ordered.value.length - meters.value.length)

const next = computed(() => {
  const step = store.project?.steps[store.cursor]
  return step ? `${store.cursor + 1} · ${titleOf(step)}` : t('now.end')
})

const interrupted = computed(() => engineState.interrupted[0] ?? null)

/** One line of warning at most. A lost main output is the most important one. */
const warning = computed(() => {
  if (engineState.mainLost) return { text: t('warn.mainLost', { name: outputsView.mainName }), danger: true }
  if (interrupted.value) {
    return {
      text: t('now.interrupted', { step: labelOf(interrupted.value.stepId), time: formatClock(interrupted.value.position) }),
      danger: true,
    }
  }
  if (store.mode === 'show' && outputsView.mainIsDefault) return { text: t('warn.systemDefault'), danger: false }
  return null
})

// A refused run makes the warning flash (5.8, 8.2).
const flashing = ref(false)
watch(
  () => engineState.flash,
  () => {
    flashing.value = false
    requestAnimationFrame(() => (flashing.value = true))
  },
)
</script>

<template>
  <footer class="now" :class="{ compact }">
    <p v-if="warning" class="warning" :class="{ danger: warning.danger, flash: flashing && warning.danger }" role="alert">
      <AppIcon name="warning" :size="18" />
      <span>{{ warning.text }}</span>
    </p>

    <div v-if="compact" class="strip">
      <template v-if="main">
        <span class="strip-time mono" :class="{ fading: main.fadingOut }">{{ formatClock(elapsed) }} / {{ formatClock(total) }}</span>
        <span class="strip-title">{{ labelOf(main.stepId) }}</span>
        <span class="strip-loop">{{ stateText }}</span>
      </template>
      <span v-else class="strip-silence">{{ t('now.silence') }}</span>
      <div class="spacer"></div>
      <button v-if="playingCount > 0" type="button" class="btn btn-small strip-stop" @click="fadeOutMusic">
        <AppIcon name="stopSolid" :size="12" />
        <span>{{ playingCount > 1 ? t('now.stopAll') : 'Stop' }}</span>
      </button>
      <span class="caps">{{ t('now.level') }}</span>
      <template v-for="sound in meters" :key="sound.stepId">
        <span v-if="ordered.length > 1" class="strip-step mono">{{ numberOf(sound.stepId) }}</span>
        <div
          class="meter strip-meter"
          role="meter"
          aria-valuemin="0"
          aria-valuemax="100"
          :aria-valuenow="sound.level"
          :aria-label="t('now.levelOf', { n: numberOf(sound.stepId), percent: sound.level })"
        >
          <div :style="{ width: `${sound.level}%` }"></div>
        </div>
        <span class="percent mono">{{ sound.level }}%</span>
      </template>
      <template v-if="meters.length === 0">
        <div class="meter strip-meter" aria-hidden="true"><div style="width: 0"></div></div>
        <span class="percent mono">0%</span>
      </template>
      <span v-if="hiddenMeters > 0" class="more mono">+{{ hiddenMeters }}</span>
    </div>

    <div v-else class="columns">
      <section class="column wide" :aria-label="t('now.region')">
        <div class="caps">{{ t('now.label') }}</div>
        <div v-if="main" class="now-line" :class="{ fading: main.fadingOut }">
          <span class="time mono">{{ formatClock(elapsed) }}</span>
          <span class="total mono">/ {{ formatClock(total) }}</span>
          <span class="now-title">{{ labelOf(main.stepId) }}</span>
          <span class="loop">
            <AppIcon v-if="main.loop && !main.fadingOut" name="loop" :size="15" />
            <span>{{ stateText }}</span>
          </span>
        </div>
        <div v-else class="now-line silence">{{ t('now.silence') }}</div>
        <div class="progress" role="img" :aria-label="t('now.progress', { percent })">
          <div :style="{ width: `${main ? percent : 0}%` }"></div>
        </div>
      </section>

      <section class="column" :aria-label="t('now.nextRegion')">
        <div class="caps">{{ t('now.next') }}</div>
        <div class="next-title">{{ next }}</div>
        <div class="keys">
          <span><kbd>Space</kbd><span>{{ t('now.keySpace') }}</span></span>
          <span><kbd>Esc</kbd><span>{{ t('now.keyEsc') }}</span></span>
        </div>
      </section>

      <section class="column outputs" :aria-label="t('now.outputsRegion')">
        <div class="levels">
          <div v-for="sound in meters" :key="sound.stepId" class="level" :class="{ fading: sound.fadingOut }">
            <span class="level-name">{{ labelOf(sound.stepId) }}</span>
            <div
              class="meter"
              role="meter"
              aria-valuemin="0"
              aria-valuemax="100"
              :aria-valuenow="sound.level"
              :aria-label="t('now.levelOf', { n: numberOf(sound.stepId), percent: sound.level })"
            >
              <div :style="{ width: `${sound.level}%` }"></div>
            </div>
            <span class="percent mono">{{ sound.level }}%</span>
          </div>
          <div v-if="meters.length === 0" class="level">
            <span class="level-name caps">{{ t('now.level') }}</span>
            <div class="meter" aria-hidden="true"><div style="width: 0"></div></div>
            <span class="percent mono">0%</span>
          </div>
          <div v-if="hiddenMeters > 0" class="more mono">+{{ hiddenMeters }}</div>
        </div>
        <div class="devices">
          <span class="device" :class="{ lost: engineState.mainLost }">
            <AppIcon name="speaker" :size="16" />
            <span>{{ t('now.hall', { name: outputsView.mainName }) }}</span>
          </span>
          <span class="device preview">
            <AppIcon name="headphones" :size="16" />
            <span>{{ outputsView.previewValid ? t('now.preview', { name: outputsView.previewName }) : t('now.previewOff') }}</span>
          </span>
        </div>
      </section>
    </div>
  </footer>
</template>

<style scoped>
.now {
  flex: 0 0 auto;
  display: flex;
  flex-direction: column;
  border-top: 1px solid var(--line);
  background: var(--surface);
}

.warning {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 20px;
  border-bottom: 1px solid var(--line);
  color: var(--hall);
  font-size: 14px;
}

.warning.danger {
  border-bottom-color: var(--danger-line);
  background: var(--danger-bg);
  color: var(--danger);
  font-weight: 500;
}

.compact .warning {
  padding: 8px 20px;
  font-size: 13px;
}

.columns {
  display: flex;
  flex-wrap: wrap;
  align-items: stretch;
  gap: 16px 32px;
  padding: 16px 20px;
}

.column {
  flex: 1 1 220px;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.column.wide {
  flex: 2 1 420px;
}

.column.outputs {
  flex: 1 1 280px;
  gap: 10px;
}

.now-line {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: 8px 20px;
  min-height: 40px;
}

.now-line.silence {
  align-items: center;
  color: var(--text-muted);
  font-size: 18px;
}

.time {
  font-size: 40px;
  font-weight: 500;
  line-height: 1;
  color: var(--hall);
}

.total {
  font-size: 18px;
  color: var(--text-muted);
}

.now-title,
.next-title {
  min-width: 0;
  font-size: 18px;
  font-weight: 500;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.loop {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
  color: var(--text-muted);
}

.progress {
  height: 6px;
  border-radius: 3px;
  background: var(--line);
  overflow: hidden;
}

.progress div {
  height: 6px;
  background: var(--hall);
}

.keys {
  display: flex;
  flex-wrap: wrap;
  gap: 8px 16px;
  font-size: 13px;
  color: var(--text-muted);
}

.keys > span {
  display: flex;
  align-items: center;
  gap: 6px;
}

.now-line.fading .time,
.strip-time.fading {
  color: var(--hall-line);
}

.levels {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.level {
  display: flex;
  align-items: center;
  gap: 12px;
  min-height: 22px;
}

.level-name {
  flex: 0 1 42%;
  min-width: 0;
  font-size: 13px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.level.fading .level-name {
  color: var(--text-muted);
}

/* The level of a sound. It moves during a fade (3.2). */
.meter {
  flex: 1 1 auto;
  min-width: 40px;
  height: 8px;
  border-radius: 4px;
  background: var(--line);
  overflow: hidden;
}

.meter div {
  height: 8px;
  border-radius: 4px;
  background: var(--hall);
  transition: width 60ms linear;
}

.more {
  flex: 0 0 auto;
  font-size: 13px;
  color: var(--text-muted);
}

.percent {
  flex: 0 0 auto;
  width: 44px;
  font-size: 14px;
  text-align: right;
}

.devices {
  display: flex;
  flex-direction: column;
  gap: 4px;
  font-size: 13px;
}

.device {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
}

.device span {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.device.preview {
  color: var(--preview);
}

.device.lost {
  color: var(--danger);
}

.strip {
  display: flex;
  align-items: center;
  gap: 14px;
  min-height: 46px;
  padding: 4px 20px;
  background: var(--bg);
  font-size: 14px;
}

.strip-time {
  flex: 0 0 auto;
  color: var(--hall);
  font-weight: 500;
}

.strip-title {
  min-width: 0;
  font-weight: 500;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.strip-loop,
.strip-silence {
  flex: 0 0 auto;
  font-size: 13px;
  color: var(--text-muted);
}

.strip-stop {
  min-height: 34px;
  border: 0;
  background: var(--hall);
  color: var(--hall-ink);
  font-weight: 600;
}

.strip-step {
  flex: 0 0 auto;
  font-size: 13px;
  color: var(--text-muted);
}

.strip-meter {
  flex: 0 0 110px;
}
</style>

<script setup lang="ts">
// The light cues of the selected step (DESIGN.md, 4.5): for each light group, no change, on or off, and a colour.
import { computed } from 'vue'
import { DEFAULT_LIGHT_COLOR, LIGHT_COLORS, lightStateOf, setLightColor, setLightState, type LightState } from '@shared/lights'
import type { Step } from '@shared/types'
import LightIcon from './LightIcon.vue'
import { t } from '@/lib/i18n'
import { lightColorName, lightGroupName, lightGroups } from '@/lib/lights'
import { openSettings } from '@/lib/nav'
import { touch } from '@/lib/projectStore'

const props = defineProps<{ step: Step }>()

const states: { id: LightState; label: 'lights.none' | 'lights.on' | 'lights.off' }[] = [
  { id: 'none', label: 'lights.none' },
  { id: 'on', label: 'lights.on' },
  { id: 'off', label: 'lights.off' },
]

const rows = computed(() =>
  lightGroups().map((group) => {
    const state = lightStateOf(props.step, group.id)
    const color = props.step.lights.find((cue) => cue.groupId === group.id)?.color ?? DEFAULT_LIGHT_COLOR
    return { id: group.id, name: lightGroupName(group), path: group.iconPath, state, color, colorName: lightColorName(color) }
  }),
)

function setState(groupId: string, state: LightState): void {
  setLightState(props.step, groupId, state)
  touch()
}

function setColor(groupId: string, color: string): void {
  setLightColor(props.step, groupId, color)
  touch()
}

function pick(groupId: string, color: string, event: Event): void {
  setColor(groupId, color)
  ;(event.currentTarget as HTMLElement).closest<HTMLElement>('[popover]')?.hidePopover()
}
</script>

<template>
  <div class="lights" role="group" :aria-label="t('editor.lights')">
    <span class="field-label">{{ t('editor.lights') }}</span>
    <p v-if="rows.length === 0" class="lights-none">
      <span>{{ t('editor.lightsNone') }}</span>
      <button type="button" class="btn btn-small btn-quiet" @click="openSettings">{{ t('editor.lightsSettings') }}</button>
    </p>
    <div v-else class="groups">
      <div v-for="row in rows" :key="row.id" class="group" :class="row.state" :data-group="row.id" :style="{ '--light': row.color }">
        <LightIcon :path="row.path" :size="18" class="group-icon" />
        <span class="group-name">{{ row.name }}</span>
        <div class="segments" role="radiogroup" :aria-label="row.name">
          <button
            v-for="state in states"
            :key="state.id"
            type="button"
            role="radio"
            class="segment"
            :class="{ on: row.state === state.id }"
            :aria-checked="row.state === state.id"
            :aria-label="state.id === 'none' ? t(state.label) : undefined"
            :title="state.id === 'none' ? t(state.label) : undefined"
            :data-state="state.id"
            @click="setState(row.id, state.id)"
          >
            {{ state.id === 'none' ? '–' : t(state.label) }}
          </button>
        </div>
        <button
          type="button"
          class="swatch"
          :popovertarget="`light-colors-${row.id}`"
          :disabled="row.state !== 'on'"
          :aria-label="t('lights.color', { name: row.name })"
          :title="row.colorName || t('lights.customColor')"
        ></button>
        <div :id="`light-colors-${row.id}`" class="palette" popover="auto" :aria-label="t('lights.colors')">
          <div class="palette-colors">
            <button
              v-for="item in LIGHT_COLORS"
              :key="item.id"
              type="button"
              class="palette-color"
              :class="{ on: row.color === item.color }"
              :style="{ background: item.color }"
              :aria-label="t(`color.${item.id}`)"
              :aria-pressed="row.color === item.color"
              :title="t(`color.${item.id}`)"
              :data-color="item.color"
              @click="pick(row.id, item.color, $event)"
            ></button>
          </div>
          <label class="palette-custom">
            <span>{{ t('lights.customColor') }}</span>
            <input type="color" :value="row.color" @input="setColor(row.id, ($event.target as HTMLInputElement).value)" />
          </label>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* A column next to the other fields when the window has room, a strip below them when it has not. */
.lights {
  flex: 1 1 300px;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 5px;
}

.lights-none {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 4px 10px;
  font-size: 12.5px;
  color: var(--text-dim);
}

.groups {
  flex: 1 1 auto;
  min-width: 0;
  display: flex;
  flex-wrap: wrap;
  align-content: flex-start;
  gap: 6px 8px;
  max-height: 222px;
  overflow-y: auto;
}

.group {
  flex: 1 1 290px;
  max-width: 420px;
  min-width: 0;
  display: flex;
  align-items: center;
  gap: 8px;
  min-height: 36px;
  padding: 2px 6px 2px 10px;
  border: 1px solid var(--line);
  border-radius: 10px;
}

.group.on {
  border-color: color-mix(in srgb, var(--light) 55%, transparent);
  background: color-mix(in srgb, var(--light) 8%, transparent);
}

.group.off {
  border-style: dashed;
  border-color: var(--line-strong);
}

.group-icon {
  flex: 0 0 auto;
  color: var(--text-dim);
}

.group.on .group-icon {
  color: var(--light);
}

.group-name {
  flex: 1 1 auto;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 14px;
}

.group.none .group-name {
  color: var(--text-muted);
}

.segments {
  flex: 0 0 auto;
  display: flex;
  border: 1px solid var(--line-strong);
  border-radius: 8px;
  overflow: hidden;
}

.segment {
  min-width: 30px;
  height: 30px;
  padding: 0 9px;
  border: 0;
  border-left: 1px solid var(--line-strong);
  background: transparent;
  color: var(--text-muted);
  font-size: 13px;
  cursor: pointer;
}

.segment:first-child {
  border-left: 0;
}

.segment:hover {
  color: var(--text);
}

.segment.on {
  background: var(--text);
  color: var(--bg);
  font-weight: 600;
}

.segment:focus-visible {
  outline-offset: -2px;
}

.swatch {
  flex: 0 0 auto;
  width: 28px;
  height: 28px;
  padding: 0;
  border: 2px solid var(--line-light);
  border-radius: 50%;
  background: var(--light);
  cursor: pointer;
}

.swatch:disabled {
  border-color: var(--line);
  background: transparent;
  cursor: default;
}

/* The palette opens next to its swatch. The browser keeps it inside the window. */
.palette {
  position-area: block-start span-inline-start;
  position-try-fallbacks: flip-block, flip-inline;
  inset: auto;
  margin: 6px 0;
  padding: 12px;
  border: 1px solid var(--line-strong);
  border-radius: 12px;
  background: var(--surface-2);
  color: var(--text);
}

.palette-colors {
  display: grid;
  grid-template-columns: repeat(5, 32px);
  gap: 8px;
}

.palette-color {
  width: 32px;
  height: 32px;
  padding: 0;
  border: 2px solid transparent;
  border-radius: 50%;
  cursor: pointer;
}

.palette-color.on {
  border-color: var(--text);
  outline: 2px solid var(--bg);
  outline-offset: -4px;
}

.palette-custom {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-top: 12px;
  padding-top: 10px;
  border-top: 1px solid var(--line);
  font-size: 13px;
  color: var(--text-muted);
}

.palette-custom input {
  width: 44px;
  height: 30px;
  padding: 0;
  border: 1px solid var(--line-strong);
  border-radius: 7px;
  background: transparent;
  cursor: pointer;
}
</style>

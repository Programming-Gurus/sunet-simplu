<script setup lang="ts">
// The light cues of a step in the step list (DESIGN.md, 3.2 and 4.5): one chip for each cue.
import { computed } from 'vue'
import type { Step } from '@shared/types'
import LightIcon from './LightIcon.vue'
import { t } from '@/lib/i18n'
import { lightColorName, lightGroupName, stepLights } from '@/lib/lights'

const props = defineProps<{ step: Step; large?: boolean }>()

const chips = computed(() =>
  stepLights(props.step).map(({ group, cue }) => ({
    id: group.id,
    name: lightGroupName(group),
    path: group.iconPath,
    on: cue.on,
    color: cue.color,
    colorName: cue.on ? lightColorName(cue.color) : '',
  })),
)
</script>

<template>
  <div v-if="chips.length > 0" class="chips" :class="{ 'chips-large': large }">
    <span v-for="chip in chips" :key="chip.id" class="chip" :class="{ off: !chip.on }" :style="chip.on ? { '--light': chip.color } : undefined">
      <LightIcon :path="chip.path" :size="large ? 19 : 15" class="chip-icon" />
      <span class="chip-name">{{ chip.name }}</span>
      <span class="chip-state">{{ t(chip.on ? 'lights.chipOn' : 'lights.chipOff') }}</span>
      <span v-if="chip.colorName" class="chip-color">{{ chip.colorName }}</span>
    </span>
  </div>
</template>

<style scoped>
.chips {
  display: flex;
  flex-wrap: wrap;
  gap: 4px 6px;
  margin-top: 3px;
}

.chips-large {
  gap: 6px 8px;
  margin-top: 6px;
}

.chip {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
  padding: 1px 9px 1px 6px;
  border: 1px solid color-mix(in srgb, var(--light) 55%, transparent);
  border-radius: 999px;
  background: color-mix(in srgb, var(--light) 10%, transparent);
  font-size: 12.5px;
  white-space: nowrap;
}

.chips-large .chip {
  gap: 8px;
  padding: 4px 13px 4px 9px;
  font-size: 15px;
}

.chip-icon {
  flex: 0 0 auto;
  color: var(--light);
}

.chip-name {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  font-weight: 500;
}

.chip-state {
  color: var(--text-warm);
}

.chip-color {
  color: var(--light);
}

.chip-state::before,
.chip-color::before {
  content: '· ';
  color: var(--text-dim);
}

/* A cue that turns a group off has no colour. */
.chip.off {
  border: 1px dashed var(--line-strong);
  background: transparent;
  color: var(--text-muted);
}

.chip.off .chip-icon,
.chip.off .chip-state {
  color: var(--text-dim);
}
</style>

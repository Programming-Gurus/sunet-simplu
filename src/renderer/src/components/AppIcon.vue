<script setup lang="ts">
// The line icons of the app, drawn on a 24 × 24 grid.
import { computed } from 'vue'

const props = withDefaults(defineProps<{ name: IconName; size?: number }>(), { size: 20 })

const icons = {
  settings:
    '<path d="M4 6h8"/><path d="M18 6h2"/><circle cx="15" cy="6" r="2.5"/><path d="M4 12h2"/><path d="M12 12h8"/><circle cx="9" cy="12" r="2.5"/><path d="M4 18h10"/><circle cx="17" cy="18" r="2.5"/>',
  plus: '<path d="M12 5v14"/><path d="M5 12h14"/>',
  back: '<path d="M15 6l-6 6 6 6"/>',
  song: '<path d="M9 18V5l11-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="17" cy="16" r="3"/>',
  note: '<path d="M12 20h8"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"/>',
  stop: '<rect x="5" y="5" width="14" height="14" rx="2"/>',
  headphones:
    '<path d="M4 14v-2a8 8 0 0 1 16 0v2"/><rect x="3" y="14" width="4" height="6" rx="1.5"/><rect x="17" y="14" width="4" height="6" rx="1.5"/>',
  speaker: '<path d="M11 5L6 9H3v6h3l5 4Z"/><path d="M15.5 8.5a5 5 0 0 1 0 7"/><path d="M18.5 5.5a9 9 0 0 1 0 13"/>',
  lock: '<rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>',
  loop: '<path d="M17 2l4 4-4 4"/><path d="M3 11V9a3 3 0 0 1 3-3h15"/><path d="M7 22l-4-4 4-4"/><path d="M21 13v2a3 3 0 0 1-3 3H3"/>',
  warning: '<path d="M12 3l10 18H2Z"/><path d="M12 10v5"/><path d="M12 18h.01"/>',
  trash: '<path d="M4 7h16"/><path d="M9 7V4h6v3"/><path d="M6 7l1 13h10l1-13"/><path d="M10 11v5"/><path d="M14 11v5"/>',
  close: '<path d="M6 6l12 12"/><path d="M18 6L6 18"/>',
  reset: '<path d="M4 4v5h5"/><path d="M4.6 9A8 8 0 1 1 4 12"/>',
  line: '<path d="M21 15a2 2 0 0 1-2 2H8l-5 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2Z"/>',
  action: '<circle cx="12" cy="7" r="4"/><path d="M4 21v-1a6 6 0 0 1 6-6h4a6 6 0 0 1 6 6v1"/>',
} as const

const solid = {
  play: '<path d="M7 4l13 8-13 8Z"/>',
  stopSolid: '<rect x="4" y="4" width="16" height="16" rx="2"/>',
} as const

export type IconName = keyof typeof icons | keyof typeof solid

const isSolid = computed(() => props.name in solid)
const markup = computed(() =>
  isSolid.value ? solid[props.name as keyof typeof solid] : icons[props.name as keyof typeof icons],
)
</script>

<template>
  <!-- The markup is a fixed string from this file, never user text. -->
  <svg
    :width="size"
    :height="size"
    viewBox="0 0 24 24"
    :fill="isSolid ? 'currentColor' : 'none'"
    :stroke="isSolid ? 'none' : 'currentColor'"
    stroke-width="2"
    stroke-linecap="round"
    stroke-linejoin="round"
    aria-hidden="true"
    v-html="markup"
  />
</template>

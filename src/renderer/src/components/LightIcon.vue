<script setup lang="ts">
// The icon of a light group: one filled drawing from Material Design Icons, on a 24 × 24 grid.
withDefaults(defineProps<{ path: string; size?: number }>(), { size: 20 })
</script>

<template>
  <svg :width="size" :height="size" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <path :d="path" />
  </svg>
</template>

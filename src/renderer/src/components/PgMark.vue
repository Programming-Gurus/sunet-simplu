<script setup lang="ts">
// The Programming Gurus mark: "concept by" and the dark-mode logo (DESIGN.md, 3.1).
// It opens programminggurus.ro in the default browser. The text stays in English.
import logo from '@/assets/pg-logo-dark.svg'

function open(): void {
  window.api.app.openPgSite()
}
</script>

<template>
  <a
    class="pg-mark"
    href="https://programminggurus.ro"
    lang="en"
    aria-label="Concept by Programming Gurus, programminggurus.ro"
    @click.prevent="open"
  >
    <span class="pg-text" aria-hidden="true">concept<br />by</span>
    <img class="pg-logo" :src="logo" alt="" draggable="false" />
  </a>
</template>

<style scoped>
.pg-mark {
  position: relative;
  display: block;
  flex: 0 0 auto;
  width: 151px;
  height: 53.3px;
  border-radius: 6px;
  cursor: pointer;
}

.pg-text {
  position: absolute;
  left: 0;
  top: 0;
  font-family: 'Inter', system-ui, sans-serif;
  font-size: 8px;
  font-weight: 600;
  line-height: 1;
  color: #d50102;
  white-space: nowrap;
}

.pg-logo {
  position: absolute;
  left: 12.12px;
  top: 7.78px;
  width: auto;
  height: 43.03px;
}
</style>

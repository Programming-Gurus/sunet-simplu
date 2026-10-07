<script setup lang="ts">
import DialogHost from '@/components/DialogHost.vue'
import ToastHost from '@/components/ToastHost.vue'
import { nav } from '@/lib/nav'
import { flushSave } from '@/lib/projectStore'
import { watchCloseGuard } from '@/lib/session'
import ProjectScreen from '@/screens/ProjectScreen.vue'
import ProjectsScreen from '@/screens/ProjectsScreen.vue'
import SettingsScreen from '@/screens/SettingsScreen.vue'

// The main process asks for a last save before the window closes.
window.api.app.onFlushRequest(() => flushSave())
watchCloseGuard()
</script>

<template>
  <ProjectsScreen v-if="nav.screen === 'projects'" />
  <ProjectScreen v-else-if="nav.screen === 'project'" />
  <SettingsScreen v-else />
  <DialogHost />
  <ToastHost />
</template>

<script setup lang="ts">
// The Projects screen (DESIGN.md, 3.1). The app opens here.
import { onMounted, ref } from 'vue'
import type { ProjectSummary } from '@shared/types'
import AppIcon from '@/components/AppIcon.vue'
import PgMark from '@/components/PgMark.vue'
import { confirmDialog, promptDialog } from '@/lib/dialogs'
import { describeChanged } from '@/lib/format'
import { countSongs, countSteps, language, t } from '@/lib/i18n'
import { openSettings } from '@/lib/nav'
import { enterProject } from '@/lib/session'
import { showError, showToast } from '@/lib/toasts'

const projects = ref<ProjectSummary[]>([])
const loaded = ref(false)
/** An export or an import runs. */
const busy = ref(false)

async function refresh(): Promise<void> {
  try {
    projects.value = await window.api.projects.list()
  } catch (error) {
    showError(error)
  }
  loaded.value = true
}

onMounted(refresh)

function changedText(project: ProjectSummary): string {
  const changed = describeChanged(project.updatedAt, language.value)
  if (changed.kind === 'today') return t('projects.changedToday', { time: changed.time })
  if (changed.kind === 'yesterday') return t('projects.changedYesterday', { time: changed.time })
  return t('projects.changedOn', { date: changed.date })
}

async function create(): Promise<void> {
  const name = await promptDialog({
    title: t('projects.newTitle'),
    label: t('projects.newLabel'),
    confirm: t('projects.create'),
  })
  if (!name) return
  try {
    const project = await window.api.projects.create(name)
    await enterProject(project.id)
  } catch (error) {
    showError(error)
  }
}

async function duplicate(project: ProjectSummary): Promise<void> {
  const name = await promptDialog({
    title: t('projects.duplicateTitle'),
    label: t('projects.duplicateLabel'),
    value: t('projects.copyName', { name: project.name }),
    confirm: t('common.duplicate'),
  })
  if (!name) return
  try {
    await window.api.projects.duplicate(project.id, name)
  } catch (error) {
    showError(error)
  }
  await refresh()
}

// Export writes one file with the steps, the settings of the project and the songs (section 7).
async function exportProject(project: ProjectSummary): Promise<void> {
  if (busy.value) return
  busy.value = true
  try {
    const result = await window.api.projects.exportProject(project.id)
    if (result.status === 'done') showToast(t('projects.exported'))
    else if (result.status === 'failed') showError(result.reason)
  } catch (error) {
    showError(error)
  }
  busy.value = false
}

async function importProject(): Promise<void> {
  if (busy.value) return
  busy.value = true
  try {
    const result = await window.api.projects.importProject()
    if (result.status === 'done') showToast(t('projects.imported', { name: result.project.name }))
    else if (result.status === 'invalid') showToast(t('projects.importInvalid'), 'error')
    else if (result.status === 'failed') showError(result.reason)
  } catch (error) {
    showError(error)
  }
  busy.value = false
  await refresh()
}

async function remove(project: ProjectSummary): Promise<void> {
  const confirmed = await confirmDialog({
    title: t('projects.deleteTitle', { name: project.name }),
    body: t('projects.deleteBody'),
    confirm: t('projects.deleteConfirm'),
    danger: true,
  })
  if (!confirmed) return
  try {
    await window.api.projects.remove(project.id)
  } catch (error) {
    showError(error)
  }
  await refresh()
}
</script>

<template>
  <div class="screen">
    <div class="column">
      <header class="head">
        <div class="brand">
          <div class="brand-line">
            <span class="bars" aria-hidden="true"><span></span><span></span><span></span><span></span></span>
            <h1>{{ t('app.name') }}</h1>
          </div>
          <div class="muted">{{ t('projects.title') }}</div>
        </div>
        <button type="button" class="btn" :disabled="busy" @click="importProject">{{ t('projects.import') }}</button>
        <button type="button" class="btn" @click="openSettings">
          <AppIcon name="settings" :size="18" />
          <span>{{ t('common.settings') }}</span>
        </button>
        <button type="button" class="btn btn-primary" @click="create">
          <AppIcon name="plus" :size="16" />
          <span>{{ t('projects.new') }}</span>
        </button>
      </header>

      <main class="list">
        <p v-if="loaded && projects.length === 0" class="empty">{{ t('projects.empty') }}</p>
        <article v-for="project in projects" :key="project.id" class="card">
          <div class="card-main">
            <button type="button" class="card-name" @click="enterProject(project.id)">{{ project.name }}</button>
            <div class="card-meta">
              <span>{{ countSteps(project.stepCount) }}</span>
              <span>{{ countSongs(project.songCount) }}</span>
              <span>{{ changedText(project) }}</span>
            </div>
          </div>
          <button type="button" class="btn btn-quiet" :disabled="busy" @click="exportProject(project)">{{ t('projects.export') }}</button>
          <button type="button" class="btn btn-quiet" @click="duplicate(project)">{{ t('common.duplicate') }}</button>
          <button type="button" class="btn btn-quiet btn-danger" @click="remove(project)">{{ t('common.delete') }}</button>
          <button type="button" class="btn btn-outline" @click="enterProject(project.id)">{{ t('projects.open') }}</button>
        </article>
      </main>

      <div class="fill"></div>

      <footer class="foot">
        <PgMark />
        <span>{{ t('projects.footer') }}</span>
      </footer>
    </div>
  </div>
</template>

<style scoped>
.screen {
  height: 100%;
  overflow-y: auto;
}

.column {
  display: flex;
  flex-direction: column;
  gap: 28px;
  width: 100%;
  max-width: 960px;
  min-height: 100%;
  margin: 0 auto;
  padding: 48px 24px 24px;
}

.head {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-end;
  gap: 16px;
}

.brand {
  flex: 1 1 280px;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.brand-line {
  display: flex;
  align-items: center;
  gap: 12px;
}

.brand h1 {
  font-size: 30px;
  font-weight: 600;
  letter-spacing: 0.01em;
}

.bars {
  display: flex;
  align-items: flex-end;
  gap: 3px;
  height: 26px;
}

.bars span {
  width: 5px;
  border-radius: 2px;
  background: var(--hall);
}

.bars span:nth-child(1) {
  height: 10px;
}

.bars span:nth-child(2) {
  height: 26px;
}

.bars span:nth-child(3) {
  height: 16px;
}

.bars span:nth-child(4) {
  height: 21px;
}

.list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.empty {
  padding: 32px 18px;
  border: 1px dashed var(--line-strong);
  border-radius: 14px;
  color: var(--text-muted);
  text-align: center;
}

.card {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 12px 16px;
  padding: 16px 18px;
  border: 1px solid var(--line);
  border-radius: 14px;
  background: var(--surface);
}

.card-main {
  flex: 1 1 280px;
  min-width: 0;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 4px;
}

.card-name {
  max-width: 100%;
  padding: 0;
  border: 0;
  border-radius: 4px;
  background: transparent;
  font-size: 20px;
  font-weight: 600;
  text-align: left;
  overflow-wrap: anywhere;
  cursor: pointer;
}

.card-name:hover {
  color: #ffffff;
}

.card-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 4px 16px;
  font-size: 13.5px;
  color: var(--text-muted);
}

.fill {
  flex: 1 1 auto;
}

.foot {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding-top: 16px;
  border-top: 1px solid var(--line);
  font-size: 13px;
  color: var(--text-dim);
}
</style>

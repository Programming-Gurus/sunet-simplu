<script setup lang="ts">
// The Settings screen (DESIGN.md, section 8). The settings stay on this computer.
import { computed, nextTick, ref } from 'vue'
import { selectableNames } from '@shared/outputRules'
import AppIcon from '@/components/AppIcon.vue'
import IconPicker from '@/components/IconPicker.vue'
import LightIcon from '@/components/LightIcon.vue'
import PgMark from '@/components/PgMark.vue'
import { confirmDialog } from '@/lib/dialogs'
import { isAudible } from '@/lib/engine'
import { t } from '@/lib/i18n'
import { addLightGroup, changeLightGroup, deleteLightGroup, lightGroupName } from '@/lib/lights'
import { closeSettings } from '@/lib/nav'
import { deviceByName, outputs, outputsView, testDevice } from '@/lib/outputs'
import { settings, updateSettings } from '@/lib/settings'
import { showError } from '@/lib/toasts'
import { LIGHT_NAME_MAX } from '@shared/lights'
import type { Language, LightGroup } from '@shared/types'

const connected = computed(() => outputs.devices.map((device) => device.name))
const mainNames = computed(() => selectableNames(settings.mainOutput, settings.previewOutput, connected.value))
const previewNames = computed(() => selectableNames(settings.previewOutput, settings.mainOutput, connected.value))
/** Grows to draw a list again after the user refused a change. */
const redraw = ref(0)
const testing = ref<'main' | 'preview' | null>(null)

function shownName(name: string): string {
  return connected.value.includes(name) ? name : t('common.notConnected', { name })
}

async function setMain(event: Event): Promise<void> {
  const value = (event.target as HTMLSelectElement).value || null
  if (value === settings.mainOutput) return
  // A change of the main output while music plays needs a confirmation (8.2).
  if (isAudible()) {
    const confirmed = await confirmDialog({
      title: t('settings.changeMainTitle'),
      body: t('settings.changeMainBody', { name: value ?? t('common.systemDefault') }),
      confirm: t('settings.changeMainConfirm'),
    })
    if (!confirmed) {
      redraw.value++
      return
    }
  }
  updateSettings({ mainOutput: value }).catch(showError)
}

function setPreview(event: Event): void {
  updateSettings({ previewOutput: (event.target as HTMLSelectElement).value || null }).catch(showError)
}

async function test(which: 'main' | 'preview'): Promise<void> {
  if (testing.value) return
  const name = which === 'main' ? settings.mainOutput : settings.previewOutput
  const device = deviceByName(name)
  if (name !== null && !device) return
  testing.value = which
  try {
    await testDevice(device?.id ?? '')
  } catch (error) {
    showError(error)
  }
  testing.value = null
}

const languages: { id: Language; name: string }[] = [
  { id: 'ro', name: 'Română' },
  { id: 'en', name: 'English' },
]

function setLanguage(id: Language): void {
  updateSettings({ language: id }).catch(showError)
}

// Light groups (8.3).
const picker = ref<InstanceType<typeof IconPicker> | null>(null)
/** The group whose icon the picker changes. */
const pickingFor = ref<string | null>(null)

async function addGroup(): Promise<void> {
  try {
    const group = await addLightGroup()
    await nextTick()
    document.getElementById(`light-name-${group.id}`)?.focus()
  } catch (error) {
    showError(error)
  }
}

function renameGroup(group: LightGroup, event: Event): void {
  const field = event.target as HTMLInputElement
  changeLightGroup(group.id, { name: field.value })
    .then(() => {
      // Show the name that the app kept.
      field.value = settings.lightGroups.find((item) => item.id === group.id)?.name ?? ''
    })
    .catch(showError)
}

function pickIcon(group: LightGroup): void {
  pickingFor.value = group.id
  void picker.value?.open(group.icon)
}

function setIcon(icon: { icon: string; iconPath: string }): void {
  if (pickingFor.value) changeLightGroup(pickingFor.value, icon).catch(showError)
}

function removeGroup(group: LightGroup): void {
  deleteLightGroup(group).catch(showError)
}

function blurOnEnter(event: KeyboardEvent): void {
  ;(event.target as HTMLElement).blur()
}
</script>

<template>
  <div class="screen">
    <div class="column">
      <header class="head">
        <button type="button" class="back" @click="closeSettings">
          <AppIcon name="back" :size="18" />
          <span>{{ t('common.back') }}</span>
        </button>
        <h1>{{ t('settings.title') }}</h1>
        <span class="subtitle">{{ t('settings.subtitle') }}</span>
      </header>

      <section class="group" aria-labelledby="set-audio">
        <h2 id="set-audio" class="caps">{{ t('settings.audio') }}</h2>

        <div class="card">
          <div class="card-head">
            <span class="badge hall"><AppIcon name="speaker" /></span>
            <div class="card-title">
              <label for="out-main">{{ t('settings.main') }}</label>
              <div class="card-help">{{ t('settings.mainHelp') }}</div>
            </div>
            <span class="state" :class="{ bad: !outputsView.mainConnected }">
              <span class="state-dot" aria-hidden="true"></span>
              <span>{{ t(outputsView.mainConnected ? 'settings.connected' : 'settings.disconnected') }}</span>
            </span>
          </div>
          <div class="card-row">
            <select id="out-main" :key="`main-${redraw}`" class="field" :value="settings.mainOutput ?? ''" @change="setMain">
              <option value="">{{ t('common.systemDefault') }}</option>
              <option v-for="name in mainNames" :key="name" :value="name">{{ shownName(name) }}</option>
            </select>
            <button type="button" class="btn" :disabled="!outputsView.mainConnected || testing !== null" @click="test('main')">
              {{ t('settings.test') }}
            </button>
          </div>
        </div>

        <div class="card">
          <div class="card-head">
            <span class="badge preview"><AppIcon name="headphones" /></span>
            <div class="card-title">
              <label for="out-preview">{{ t('settings.preview') }}</label>
              <div class="card-help">{{ t('settings.previewHelp') }}</div>
            </div>
            <span class="state" :class="{ bad: settings.previewOutput !== null && !outputsView.previewConnected, off: settings.previewOutput === null }">
              <span class="state-dot" aria-hidden="true"></span>
              <span v-if="settings.previewOutput === null">{{ t('settings.off') }}</span>
              <span v-else>{{ t(outputsView.previewConnected ? 'settings.connected' : 'settings.disconnected') }}</span>
            </span>
          </div>
          <div class="card-row">
            <select id="out-preview" class="field" :value="settings.previewOutput ?? ''" @change="setPreview">
              <option value="">{{ t('common.none') }}</option>
              <option v-for="name in previewNames" :key="name" :value="name">{{ shownName(name) }}</option>
            </select>
            <button type="button" class="btn" :disabled="!outputsView.previewConnected || testing !== null" @click="test('preview')">
              {{ t('settings.test') }}
            </button>
          </div>
        </div>

        <div class="hint" :class="{ strong: outputsView.mainIsDefault && settings.previewOutput !== null }">
          <AppIcon name="warning" :size="18" class="hint-icon" />
          <div class="hint-text">
            <span>{{ t('settings.hintDefault') }}</span>
            <span>{{ t('settings.hintPreview') }}</span>
          </div>
        </div>
      </section>

      <section class="group" aria-labelledby="set-lights">
        <h2 id="set-lights" class="caps">{{ t('settings.lights') }}</h2>
        <div class="card">
          <div class="card-help">{{ t('settings.lightsHelp') }} {{ t('settings.lightsTravel') }}</div>
          <p v-if="settings.lightGroups.length === 0" class="lights-empty">{{ t('settings.lightsEmpty') }}</p>
          <ul v-else class="light-groups">
            <li v-for="group in settings.lightGroups" :key="group.id" class="light-group" :data-group="group.id">
              <button
                type="button"
                class="icon-btn light-icon"
                :aria-label="t('settings.lightIcon', { name: lightGroupName(group) })"
                :title="t('settings.lightIcon', { name: lightGroupName(group) })"
                @click="pickIcon(group)"
              >
                <LightIcon :path="group.iconPath" :size="24" />
              </button>
              <input
                :id="`light-name-${group.id}`"
                class="field light-name"
                type="text"
                :value="group.name"
                :maxlength="LIGHT_NAME_MAX"
                :aria-label="t('settings.lightName')"
                :placeholder="t('settings.lightNamePlaceholder')"
                @change="renameGroup(group, $event)"
                @keydown.enter="blurOnEnter"
              />
              <button
                type="button"
                class="icon-btn"
                :aria-label="t('settings.lightDelete', { name: lightGroupName(group) })"
                :title="t('settings.lightDelete', { name: lightGroupName(group) })"
                @click="removeGroup(group)"
              >
                <AppIcon name="trash" :size="18" />
              </button>
            </li>
          </ul>
          <div class="card-row">
            <button type="button" class="btn light-add" @click="addGroup">
              <AppIcon name="plus" :size="16" />
              <span>{{ t('settings.lightAdd') }}</span>
            </button>
          </div>
        </div>
        <IconPicker ref="picker" @pick="setIcon" />
      </section>

      <section class="group" aria-labelledby="set-lang">
        <h2 id="set-lang" class="caps">{{ t('settings.language') }}</h2>
        <div class="languages" role="radiogroup" aria-labelledby="set-lang">
          <label v-for="item in languages" :key="item.id" class="language" :class="{ on: settings.language === item.id }">
            <input
              type="radio"
              name="language"
              :value="item.id"
              :checked="settings.language === item.id"
              :lang="item.id"
              @change="setLanguage(item.id)"
            />
            <span :lang="item.id">{{ item.name }}</span>
          </label>
        </div>
      </section>

      <footer class="foot">
        <PgMark />
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
  max-width: 800px;
  margin: 0 auto;
  padding: 32px 24px;
}

.head {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 16px;
}

.head h1 {
  font-size: 26px;
  font-weight: 600;
}

.subtitle {
  font-size: 13.5px;
  color: var(--text-dim);
}

.back {
  display: flex;
  align-items: center;
  gap: 6px;
  min-height: 44px;
  padding: 0 10px 0 4px;
  border: 0;
  border-radius: 10px;
  background: transparent;
  color: var(--text-muted);
  cursor: pointer;
}

.back:hover {
  color: var(--text);
}

.group {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.card {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 18px;
  border: 1px solid var(--line);
  border-radius: 14px;
  background: var(--surface);
}

.card-head {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 10px 14px;
}

.badge {
  display: flex;
  flex: 0 0 auto;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  border-radius: 10px;
}

.badge.hall {
  background: var(--hall);
  color: var(--hall-ink);
}

.badge.preview {
  background: var(--preview);
  color: var(--preview-ink);
}

.card-title {
  flex: 1 1 220px;
  min-width: 0;
}

.card-title label {
  display: block;
  font-size: 17px;
  font-weight: 600;
}

.card-help {
  font-size: 13.5px;
  color: var(--text-muted);
}

.state {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
}

.state-dot {
  width: 8px;
  height: 8px;
  border-radius: 4px;
  background: var(--text);
}

.state.bad {
  color: var(--danger);
}

.state.bad .state-dot {
  background: var(--danger);
}

.state.off {
  color: var(--text-dim);
}

.state.off .state-dot {
  background: transparent;
  border: 1px solid var(--text-dim);
}

.card-row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 10px;
}

.card-row select {
  flex: 1 1 280px;
  min-width: 0;
}

.hint {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  padding: 4px 4px 0;
  font-size: 13.5px;
  color: var(--text-muted);
}

.hint.strong {
  color: var(--hall);
}

.hint-icon {
  flex: 0 0 auto;
  margin-top: 1px;
  color: var(--hall);
}

.hint-text {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.lights-empty {
  font-size: 13.5px;
  color: var(--text-dim);
}

.light-groups {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.light-group {
  display: flex;
  align-items: center;
  gap: 10px;
}

.light-icon {
  border-color: var(--line-strong);
  color: var(--text);
}

.light-name {
  flex: 1 1 auto;
  min-width: 0;
  height: 44px;
  border-radius: 10px;
}

.languages {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
}

.language {
  display: flex;
  align-items: center;
  gap: 10px;
  min-height: 44px;
  padding: 0 16px;
  border: 1px solid var(--line);
  border-radius: 10px;
  cursor: pointer;
}

.language.on {
  border-color: var(--line-light);
  background: var(--surface-2);
}

.language input {
  width: 18px;
  height: 18px;
  margin: 0;
}

.foot {
  display: flex;
  padding-top: 16px;
  border-top: 1px solid var(--line);
}
</style>

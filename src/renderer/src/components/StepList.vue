<script setup lang="ts">
// The list of steps (DESIGN.md, 3.2 and 4.2). In Edit mode you select, add and drag steps.
import { nextTick, ref, watch } from 'vue'
import AppIcon from './AppIcon.vue'
import StepRow from './StepRow.vue'
import { formatClock } from '@/lib/format'
import { t } from '@/lib/i18n'
import { addStep, moveStep, setCursor, store } from '@/lib/projectStore'
import { interruptedAt } from '@/lib/show'

const emit = defineEmits<{ added: [] }>()

const list = ref<HTMLElement | null>(null)
const dragFrom = ref<number | null>(null)
/** The gap where the dragged step lands: the index of the step below the gap. */
const dropAt = ref<number | null>(null)

const STEP_TYPE = 'application/x-sunet-simplu-step'

// Keep the cursor step in view.
watch(
  () => [store.cursor, store.mode, store.project?.steps.length],
  async () => {
    await nextTick()
    list.value?.querySelector('[aria-current="true"]')?.scrollIntoView({ block: 'nearest' })
  },
)

function add(): void {
  addStep()
  emit('added')
}

function onDragStart(event: DragEvent, index: number): void {
  if (store.mode !== 'edit' || !event.dataTransfer) return
  dragFrom.value = index
  event.dataTransfer.effectAllowed = 'move'
  event.dataTransfer.setData(STEP_TYPE, String(index))
}

function onDragOver(event: DragEvent, index: number): void {
  if (dragFrom.value === null) return
  event.preventDefault()
  const box = (event.currentTarget as HTMLElement).getBoundingClientRect()
  dropAt.value = event.clientY < box.top + box.height / 2 ? index : index + 1
}

function onDrop(event: DragEvent): void {
  if (dragFrom.value === null || dropAt.value === null) return
  event.preventDefault()
  const from = dragFrom.value
  // The gap index counts the dragged step. Without it, the gaps below move up by one.
  const to = dropAt.value > from ? dropAt.value - 1 : dropAt.value
  moveStep(from, to)
  endDrag()
}

function endDrag(): void {
  dragFrom.value = null
  dropAt.value = null
}
</script>

<template>
  <main ref="list" class="list" :class="store.mode" @dragover="dragFrom !== null && $event.preventDefault()" @drop="onDrop">
    <template v-if="store.project">
      <p v-if="store.project.steps.length === 0" class="empty">
        {{ t(store.mode === 'edit' ? 'steps.emptyEdit' : 'steps.emptyShow') }}
      </p>
      <div
        v-for="(step, index) in store.project.steps"
        :key="step.id"
        class="slot"
        :class="{ 'drop-before': dropAt === index, 'drop-after': dropAt === index + 1 && index === store.project.steps.length - 1, dragging: dragFrom === index }"
        :draggable="store.mode === 'edit'"
        @dragstart="onDragStart($event, index)"
        @dragover="onDragOver($event, index)"
        @dragend="endDrag"
        @click="setCursor(index)"
      >
        <StepRow :step="step" :index="index">
          <template #interrupted>{{ t('steps.interrupted', { time: formatClock(interruptedAt(step.id)) }) }}</template>
        </StepRow>
      </div>
      <button v-if="store.mode === 'edit'" type="button" class="add" @click="add">
        <AppIcon name="plus" :size="16" />
        <span>{{ t('steps.add') }}</span>
      </button>
    </template>
  </main>
</template>

<style scoped>
.list {
  flex: 999 1 560px;
  min-width: 0;
  display: flex;
  flex-direction: column;
  overflow-y: auto;
}

.list.edit {
  gap: 4px;
  padding: 12px 12px 12px 20px;
}

.list.show {
  gap: 6px;
  padding: 14px 20px;
}

.slot {
  position: relative;
  flex: 0 0 auto;
}

.slot.dragging {
  opacity: 0.4;
}

.slot.drop-before::before,
.slot.drop-after::after {
  content: '';
  position: absolute;
  left: 8px;
  right: 8px;
  height: 2px;
  border-radius: 1px;
  background: var(--text);
}

.slot.drop-before::before {
  top: -3px;
}

.slot.drop-after::after {
  bottom: -3px;
}

.empty {
  padding: 28px 16px;
  color: var(--text-muted);
  text-align: center;
}

.add {
  display: flex;
  flex: 0 0 auto;
  align-items: center;
  justify-content: center;
  gap: 8px;
  min-height: 44px;
  margin-top: 4px;
  border: 1px dashed var(--line-strong);
  border-radius: 10px;
  background: transparent;
  color: var(--text);
  cursor: pointer;
}

.add:hover {
  border-color: var(--line-light);
}
</style>

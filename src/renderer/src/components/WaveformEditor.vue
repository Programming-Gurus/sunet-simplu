<script setup lang="ts">
// The waveform of a song, with handles for the start point, the end point and the continue limit
// (DESIGN.md, 5.4). wavesurfer.js draws the waveform. Its regions part gives the handles.
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'
import WaveSurfer from 'wavesurfer.js'
import RegionsPlugin, { type Region } from 'wavesurfer.js/dist/plugins/regions.esm.js'
import { MIN_PART, type Part } from '@shared/project'

const props = defineProps<{
  url: string
  peaks: number[] | null
  duration: number
  part: Part
  /** The continue limit shows only if Continue is on. */
  showLimit: boolean
  label: string
}>()

const emit = defineEmits<{
  start: [seconds: number]
  end: [seconds: number]
  limit: [seconds: number]
  position: [seconds: number]
  /** The audio element of the waveform. The preview output plays it. */
  media: [element: HTMLAudioElement | null]
}>()

const container = ref<HTMLElement | null>(null)

const DIM = 'rgba(18, 17, 16, 0.78)'
const HALL = '#F2A93B'

let surfer: WaveSurfer | null = null
let regions: ReturnType<typeof RegionsPlugin.create> | null = null
let element: HTMLAudioElement | null = null
let partRegion: Region | null = null
let limitRegion: Region | null = null
let dimLeft: Region | null = null
let dimRight: Region | null = null
/** True while the user drags a handle. The values then come from the handle, not from the project. */
let dragging = false

function limitTab(): HTMLElement {
  const tab = document.createElement('div')
  tab.style.cssText =
    'position:absolute;bottom:0;left:-8px;width:14px;height:18px;box-sizing:border-box;' +
    `border:2px solid ${HALL};border-radius:5px 5px 0 0;background:#121110;cursor:ew-resize`
  return tab
}

function placeDim(start: number, end: number): void {
  dimLeft?.setOptions({ start: 0, end: Math.max(0.0001, start) })
  dimRight?.setOptions({ start: Math.min(props.duration - 0.0001, end), end: props.duration })
}

function syncLimit(): void {
  if (!regions) return
  if (!props.showLimit) {
    limitRegion?.remove()
    limitRegion = null
    return
  }
  if (!limitRegion) {
    limitRegion = regions.addRegion({ id: 'limit', start: props.part.limit, drag: true, resize: false, color: HALL, content: limitTab() })
  } else if (Math.abs(limitRegion.start - props.part.limit) > 0.001) {
    limitRegion.setOptions({ start: props.part.limit })
  }
}

function syncFromPart(): void {
  if (!partRegion || dragging) return
  const { start, end } = props.part
  if (Math.abs(partRegion.start - start) > 0.001 || Math.abs(partRegion.end - end) > 0.001) {
    partRegion.setOptions({ start, end })
  }
  placeDim(start, end)
  syncLimit()
}

function setUpRegions(): void {
  if (!regions) return
  const { start, end } = props.part
  dimLeft = regions.addRegion({ id: 'dim-left', start: 0, end: Math.max(0.0001, start), drag: false, resize: false, color: DIM })
  dimRight = regions.addRegion({ id: 'dim-right', start: Math.min(props.duration - 0.0001, end), end: props.duration, drag: false, resize: false, color: DIM })
  partRegion = regions.addRegion({
    id: 'part',
    start,
    end,
    drag: false,
    resize: true,
    minLength: Math.min(MIN_PART, props.duration),
    color: 'rgba(242, 169, 59, 0.07)',
  })
  syncLimit()

  regions.on('region-update', (region, side) => {
    dragging = true
    if (region === partRegion) {
      placeDim(region.start, region.end)
      if (side === 'start') emit('start', region.start)
      else emit('end', region.end)
    } else if (region === limitRegion && partRegion) {
      // The limit stays between the two points.
      const clamped = Math.min(partRegion.end, Math.max(partRegion.start, region.start))
      if (clamped !== region.start) region.setOptions({ start: clamped })
      emit('limit', clamped)
    }
  })
  regions.on('region-updated', () => {
    dragging = false
    syncFromPart()
  })
}

onMounted(() => {
  if (!container.value) return
  element = new Audio()
  element.preload = 'auto'
  element.src = props.url
  regions = RegionsPlugin.create()
  surfer = WaveSurfer.create({
    container: container.value,
    height: 92,
    waveColor: '#D9CFBD',
    progressColor: '#D9CFBD',
    cursorColor: '#6AAEE6',
    cursorWidth: 2,
    barWidth: 3,
    barGap: 3,
    barRadius: 2,
    interact: true,
    dragToSeek: false,
    hideScrollbar: true,
    autoScroll: false,
    autoCenter: false,
    media: element,
    ...(props.peaks && props.peaks.length > 0 ? { peaks: [props.peaks], duration: props.duration } : {}),
    plugins: [regions],
  })
  surfer.once('ready', () => {
    setUpRegions()
    surfer?.setTime(props.part.start)
    emit('position', props.part.start)
  })
  surfer.on('timeupdate', (time) => emit('position', time))
  surfer.on('seeking', (time) => emit('position', time))
  emit('media', element)
})

watch(() => [props.part.start, props.part.end, props.part.limit, props.showLimit], syncFromPart)

onBeforeUnmount(() => {
  emit('media', null)
  surfer?.destroy()
  surfer = null
  regions = null
  if (element) {
    element.pause()
    element.removeAttribute('src')
    element.load()
    element = null
  }
})

/** Puts the position of the waveform at a time, in seconds. */
function setPosition(seconds: number): void {
  surfer?.setTime(seconds)
}

defineExpose({ setPosition })
</script>

<template>
  <div ref="container" class="waveform" role="img" :aria-label="label"></div>
</template>

<style>
/* wavesurfer.js draws inside a closed part of the page. Only `::part` rules reach it. */
.waveform {
  height: 94px;
  padding: 0;
  border: 1px solid var(--line);
  border-radius: 10px;
  background: var(--bg);
  overflow: hidden;
  cursor: text;
}

.waveform ::part(dim-left),
.waveform ::part(dim-right) {
  pointer-events: none;
}

.waveform ::part(part) {
  pointer-events: none;
  overflow: visible !important;
}

.waveform ::part(region-handle) {
  pointer-events: auto;
  width: 16px !important;
  border-radius: 0 !important;
  cursor: ew-resize;
}

.waveform ::part(region-handle-left) {
  left: -8px !important;
  border-left: 0 !important;
  background: linear-gradient(90deg, transparent 7px, #f2a93b 7px 9px, transparent 9px);
}

.waveform ::part(region-handle-right) {
  right: -8px !important;
  border-right: 0 !important;
  background: linear-gradient(90deg, transparent 7px, #f2a93b 7px 9px, transparent 9px);
}

.waveform ::part(region-handle)::before {
  content: '';
  position: absolute;
  top: 0;
  left: 1px;
  width: 14px;
  height: 18px;
  border-radius: 0 0 5px 5px;
  background: #f2a93b;
}

.waveform ::part(limit) {
  border-left: 2px dashed #f2a93b !important;
  background: transparent !important;
  margin-left: -1px;
  overflow: visible !important;
  cursor: ew-resize;
}

.waveform ::part(region-content) {
  padding: 0 !important;
  margin: 0 !important;
}
</style>

// The output devices that are connected, and what the settings mean for them (DESIGN.md, 8.2).

import { reactive, watch } from 'vue'
import { outputStatus } from '@shared/outputRules'
import * as engine from './engine'
import { engineState } from './engine'
import { t } from './i18n'
import * as preview from './preview'
import { settings } from './settings'

export interface OutputDevice {
  id: string
  /** The name that the system gives, for example "External Headphones (Built-in)". */
  name: string
}

export const outputs = reactive({ devices: [] as OutputDevice[] })

function status(): ReturnType<typeof outputStatus> {
  return outputStatus(
    settings.mainOutput,
    settings.previewOutput,
    outputs.devices.map((device) => device.name),
  )
}

/** The two outputs as the screens show them. */
export const outputsView = reactive({
  get mainName(): string {
    return settings.mainOutput ?? t('common.systemDefault')
  },
  get mainIsDefault(): boolean {
    return settings.mainOutput === null
  },
  get mainConnected(): boolean {
    return status().mainConnected
  },
  get previewName(): string {
    return settings.previewOutput ?? t('common.none')
  },
  get previewConnected(): boolean {
    return status().previewConnected
  },
  get previewValid(): boolean {
    return status().previewValid
  },
})

export function deviceByName(name: string | null): OutputDevice | undefined {
  return name === null ? undefined : outputs.devices.find((device) => device.name === name)
}

async function readDevices(): Promise<OutputDevice[]> {
  const all = await navigator.mediaDevices.enumerateDevices()
  const seen = new Set<string>()
  const devices: OutputDevice[] = []
  for (const device of all) {
    // "default" and "communications" are other names of a device that is in the list already.
    if (device.kind !== 'audiooutput' || !device.label || device.deviceId === 'default' || device.deviceId === 'communications') continue
    if (seen.has(device.label)) continue
    seen.add(device.label)
    devices.push({ id: device.deviceId, name: device.label })
  }
  return devices
}

let applying: Promise<void> = Promise.resolve()

/** Sends the settings and the connected devices to the two sound paths. */
async function apply(): Promise<void> {
  const main = deviceByName(settings.mainOutput)
  if (settings.mainOutput === null) {
    await engine.setMainSink('')
    if (engineState.mainLost) engine.mainOutputReturned()
  } else if (main) {
    await engine.setMainSink(main.id)
    if (engineState.mainLost) engine.mainOutputReturned()
  } else if (!engineState.mainLost) {
    // The app does not move the music to a different device (8.2).
    engine.mainOutputLost()
  }
  const previewDevice = deviceByName(settings.previewOutput)
  preview.setPreviewSink(status().previewValid && previewDevice ? previewDevice.id : null)
}

export function refreshOutputs(): Promise<void> {
  const run = async (): Promise<void> => {
    try {
      outputs.devices = await readDevices()
    } catch {
      outputs.devices = []
    }
    await apply()
  }
  applying = applying.then(run, run)
  return applying
}

/** Starts to follow the devices and the settings. Call one time, when the app starts. */
export function watchOutputs(): Promise<void> {
  navigator.mediaDevices.addEventListener('devicechange', () => void refreshOutputs())
  watch(
    () => [settings.mainOutput, settings.previewOutput],
    () => void refreshOutputs(),
  )
  return refreshOutputs()
}

/** The Test button: a short sound on one device (8.2). An empty id is the system default. */
export async function testDevice(deviceId: string): Promise<void> {
  const context = new AudioContext() as engine.SinkContext
  try {
    if (deviceId) await context.setSinkId(deviceId)
    await context.resume()
    const now = context.currentTime
    const gain = context.createGain()
    gain.gain.setValueAtTime(0, now)
    gain.gain.linearRampToValueAtTime(0.25, now + 0.03)
    gain.gain.setValueAtTime(0.25, now + 0.45)
    gain.gain.linearRampToValueAtTime(0, now + 0.6)
    gain.connect(context.destination)
    for (const [frequency, at] of [
      [523.25, 0],
      [783.99, 0.22],
    ] as const) {
      const tone = context.createOscillator()
      tone.frequency.value = frequency
      tone.connect(gain)
      tone.start(now + at)
      tone.stop(now + 0.6)
    }
    await new Promise((resolve) => setTimeout(resolve, 750))
  } finally {
    void context.close().catch(() => undefined)
  }
}

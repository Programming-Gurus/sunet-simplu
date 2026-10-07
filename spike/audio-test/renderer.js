'use strict'

// Throwaway test page. See main.js.

const $ = (id) => document.getElementById(id)
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

const FADE_SECONDS = 1
const SYSTEM_DEFAULT = '' // the sink id that means "the system default device"
const NONE = 'none'

// ---------- log ----------

const logLines = []
function log(message) {
  const time = new Date().toLocaleTimeString('en-GB')
  logLines.push(`${time}  ${message}`)
  $('log').value = resultsText()
  $('log').scrollTop = $('log').scrollHeight
}

// ---------- test sounds ----------

// Builds a WAV file in memory, so the test needs no audio file. A note of 0 Hz is silence.
function makeWav(notes, noteSeconds) {
  const sampleRate = 44100
  const total = Math.floor(notes.length * noteSeconds * sampleRate)
  const buffer = new ArrayBuffer(44 + total * 2)
  const view = new DataView(buffer)
  const text = (offset, value) => {
    for (let i = 0; i < value.length; i++) view.setUint8(offset + i, value.charCodeAt(i))
  }
  text(0, 'RIFF')
  view.setUint32(4, 36 + total * 2, true)
  text(8, 'WAVE')
  text(12, 'fmt ')
  view.setUint32(16, 16, true)
  view.setUint16(20, 1, true) // PCM
  view.setUint16(22, 1, true) // mono
  view.setUint32(24, sampleRate, true)
  view.setUint32(28, sampleRate * 2, true)
  view.setUint16(32, 2, true)
  view.setUint16(34, 16, true)
  text(36, 'data')
  view.setUint32(40, total * 2, true)
  for (let i = 0; i < total; i++) {
    const t = i / sampleRate
    const index = Math.min(notes.length - 1, Math.floor(t / noteSeconds))
    const local = t - index * noteSeconds
    const envelope = Math.max(0, Math.min(1, local / 0.02, (noteSeconds - local) / 0.05))
    const sample = Math.sin(2 * Math.PI * notes[index] * local) * envelope * 0.4
    view.setInt16(44 + i * 2, sample * 32767, true)
  }
  return new Blob([buffer], { type: 'audio/wav' })
}

const mainSound = makeWav([220, 277, 330, 277, 220, 277, 330, 415, 440, 415, 330, 277, 220, 165, 220, 0], 0.5)
const previewSound = makeWav([880, 0, 1175, 0, 880, 0, 1319, 0], 0.25)

// ---------- outputs ----------

// One audio context for each output, as in DESIGN.md section 9:
// audio element -> gain node -> the context -> the chosen device.
function createOutput(name, sound, volume) {
  const context = new AudioContext()
  const gain = context.createGain()
  gain.gain.value = 0
  gain.connect(context.destination)
  const element = new Audio(URL.createObjectURL(sound))
  element.loop = true
  context.createMediaElementSource(element).connect(gain)

  const output = { name, context, gain, element, volume, playing: false, wantedLabel: null, connected: true }
  context.addEventListener('statechange', () => log(`${name}: audio context state is "${context.state}"`))
  context.addEventListener('sinkchange', () => log(`${name}: sink changed to ${describeSink(context.sinkId)}`))
  context.addEventListener('error', () => log(`${name}: the audio context reports an ERROR (output device failed)`))
  return output
}

function describeSink(sinkId) {
  if (typeof sinkId === 'object' && sinkId !== null) return `{type: ${sinkId.type}}`
  if (sinkId === SYSTEM_DEFAULT) return '"" (system default)'
  const device = devices.find((d) => d.deviceId === sinkId)
  return device ? `"${device.label}"` : `id ${String(sinkId).slice(0, 8)}…`
}

async function play(output) {
  await output.context.resume()
  const now = output.context.currentTime
  output.gain.gain.cancelScheduledValues(now)
  output.gain.gain.setValueAtTime(output.gain.gain.value, now)
  output.gain.gain.linearRampToValueAtTime(output.volume, now + FADE_SECONDS)
  await output.element.play()
  output.playing = true
  log(`${output.name}: play, on ${describeSink(output.context.sinkId)}`)
}

async function stop(output) {
  if (!output.playing) return
  const now = output.context.currentTime
  output.gain.gain.cancelScheduledValues(now)
  output.gain.gain.setValueAtTime(output.gain.gain.value, now)
  output.gain.gain.linearRampToValueAtTime(0, now + FADE_SECONDS)
  output.playing = false
  log(`${output.name}: stop (fade-out)`)
  await wait(FADE_SECONDS * 1000 + 50)
  if (!output.playing) output.element.pause()
}

const main = createOutput('main', mainSound, 0.9)
const preview = createOutput('preview', previewSound, 0.9)

// ---------- devices ----------

let devices = [] // the named output devices that are connected now

async function readDevices() {
  const all = await navigator.mediaDevices.enumerateDevices()
  // Chromium adds "default" and, on Windows, "communications". They are aliases, not devices.
  return all.filter((d) => d.kind === 'audiooutput' && d.deviceId !== 'default' && d.deviceId !== 'communications')
}

async function refreshDevices(reason) {
  const before = devices
  devices = await readDevices()
  if (reason === 'devicechange') {
    for (const d of devices) if (!before.some((b) => b.label === d.label)) log(`device CONNECTED: "${d.label}"`)
    for (const b of before) if (!devices.some((d) => d.label === b.label)) log(`device DISCONNECTED: "${b.label}"`)
  }

  $('device-list').replaceChildren(
    ...devices.map((d) => {
      const item = document.createElement('li')
      item.textContent = d.label || '(no name)'
      return item
    }),
  )
  fillSelect($('main-device'), main, [{ value: SYSTEM_DEFAULT, label: 'System default' }])
  fillSelect($('preview-device'), preview, [{ value: NONE, label: 'None' }])

  await followDevice(main)
  await followDevice(preview)
  updateStatus()
}

// The app remembers a device by its name, as DESIGN.md says. The id is looked up each time.
function fillSelect(select, output, firstOptions) {
  const options = [...firstOptions, ...devices.map((d) => ({ value: d.label, label: d.label }))]
  const wanted = output.wantedLabel
  if (wanted && !devices.some((d) => d.label === wanted)) {
    options.push({ value: wanted, label: `${wanted} (not connected)` })
  }
  select.replaceChildren(
    ...options.map((o) => {
      const option = document.createElement('option')
      option.value = o.value
      option.textContent = o.label
      return option
    }),
  )
  select.value = wanted ?? firstOptions[0].value
}

// Sends an output to the device that it wants, when that device is connected.
async function followDevice(output) {
  const wanted = output.wantedLabel
  if (wanted === null) {
    output.connected = true
    return
  }
  const device = devices.find((d) => d.label === wanted)
  const wasConnected = output.connected
  output.connected = Boolean(device)
  if (!device) {
    if (wasConnected) log(`${output.name}: its device "${wanted}" is NOT CONNECTED. Playing: ${output.playing}`)
    return
  }
  if (output.context.sinkId === device.deviceId) return
  try {
    await output.context.setSinkId(device.deviceId)
    if (!wasConnected) log(`${output.name}: its device "${wanted}" RETURNED; output set again`)
  } catch (error) {
    log(`${output.name}: setSinkId FAILED for "${wanted}": ${error}`)
  }
}

async function chooseDevice(output, value) {
  if (value === NONE || value === SYSTEM_DEFAULT) {
    output.wantedLabel = null
    output.connected = true
    if (value === SYSTEM_DEFAULT) {
      try {
        await output.context.setSinkId(SYSTEM_DEFAULT)
      } catch (error) {
        log(`${output.name}: setSinkId FAILED for the system default: ${error}`)
      }
    }
    log(`${output.name}: set to ${value === NONE ? 'None' : 'System default'}`)
  } else {
    output.wantedLabel = value
    output.connected = true // followDevice corrects it and reports a missing device
    await followDevice(output)
    log(`${output.name}: set to "${value}"`)
  }
  updateStatus()
}

// The rule of DESIGN.md 5.7: a preview needs a named main device and a different, connected preview device.
function previewIsValid() {
  return (
    main.wantedLabel !== null &&
    preview.wantedLabel !== null &&
    preview.wantedLabel !== main.wantedLabel &&
    preview.connected
  )
}

function updateStatus() {
  const line = (output) => {
    const where = output.wantedLabel ?? (output === main ? 'System default' : 'None')
    const lost = output.wantedLabel !== null && !output.connected
    return (
      `${output.playing ? 'PLAYS' : 'silent'} · device: ${where}${lost ? ' — NOT CONNECTED' : ''}` +
      ` · context: ${output.context.state} · song position: ${output.element.currentTime.toFixed(1)} s`
    )
  }
  $('main-status').textContent = line(main)
  $('main-status').classList.toggle('bad', main.wantedLabel !== null && !main.connected)
  $('preview-status').textContent = previewIsValid()
    ? line(preview)
    : 'Preview is off. It needs a named main device and a different, connected preview device.'
  $('preview-play').disabled = !previewIsValid()
  $('wave-listen').disabled = !previewIsValid()
  if (!previewIsValid() && preview.playing) stop(preview)
}

// ---------- waveform ----------

let wave = null
let part = null
let limit = null

function createWaveform(container) {
  const regions = WaveSurfer.Regions.create()
  const surfer = WaveSurfer.create({
    container,
    height: 96,
    waveColor: '#b3ab9d',
    progressColor: '#6aaee6',
    cursorColor: '#6aaee6',
    plugins: [regions],
  })
  const ready = new Promise((resolve, reject) => {
    surfer.once('ready', resolve)
    surfer.once('error', reject)
  })
  surfer.loadBlob(mainSound)
  return { surfer, regions, ready }
}

async function setUpWaveform() {
  const created = createWaveform($('waveform'))
  wave = created.surfer
  await created.ready
  const duration = wave.getDuration()
  part = created.regions.addRegion({
    start: duration * 0.1,
    end: duration * 0.85,
    color: 'rgba(242, 169, 59, 0.18)',
    drag: false,
    resize: true,
  })
  limit = created.regions.addRegion({ start: duration * 0.475, color: '#f2a93b', drag: true })
  const describe = () => {
    $('wave-status').textContent =
      `start ${part.start.toFixed(1)} s · end ${part.end.toFixed(1)} s · limit ${limit.start.toFixed(1)} s`
  }
  created.regions.on('region-updated', (region) => {
    describe()
    log(`waveform: ${region === limit ? 'limit' : 'part'} moved (${$('wave-status').textContent})`)
  })
  describe()
}

async function listen() {
  const device = devices.find((d) => d.label === preview.wantedLabel)
  if (!device) return
  try {
    await wave.setSinkId(device.deviceId)
    part.play(true)
    log(`waveform: listen from ${part.start.toFixed(1)} s to ${part.end.toFixed(1)} s, on "${device.label}"`)
  } catch (error) {
    log(`waveform: listen FAILED: ${error}`)
  }
}

// ---------- the manual steps ----------

const steps = [
  'Names. Connect the jack headphones and the Bluetooth headphones. Do you see both, by name, in the list at the top?',
  'Two outputs. Set Main to the jack and Preview to the Bluetooth headphones. Press “Play main”, then “Play preview”. Do you hear the low melody only in the jack and the beeps only in Bluetooth?',
  'Preview lost. While both play, turn the Bluetooth headphones off. Does the main melody continue with no change, and does the Preview line say that the preview is off?',
  'Main lost. While main plays, pull the jack out. Is there silence (no sound from the laptop speakers), and does the Main line turn red?',
  'Main returns. Put the jack back in. Does the melody return in the jack, without a click on anything?',
  'Waveform. With both devices connected, press “Listen on preview”. Do you hear it only in the Bluetooth headphones, and does it stop at the end of the amber part?',
]
const answers = steps.map(() => ({ result: '', note: '' }))

function buildSteps() {
  steps.forEach((text, index) => {
    const item = document.createElement('li')
    item.append(text)
    const answer = document.createElement('div')
    answer.className = 'answer'
    for (const choice of ['yes', 'no']) {
      const label = document.createElement('label')
      const radio = document.createElement('input')
      radio.type = 'radio'
      radio.name = `step-${index}`
      radio.addEventListener('change', () => {
        answers[index].result = choice
        log(`step ${index + 1}: ${choice.toUpperCase()}`)
      })
      label.append(radio, choice === 'yes' ? 'Yes' : 'No')
      answer.append(label)
    }
    const note = document.createElement('input')
    note.type = 'text'
    note.placeholder = 'What happened, if not as expected'
    note.addEventListener('change', () => {
      answers[index].note = note.value
      $('log').value = resultsText()
    })
    answer.append(note)
    item.append(answer)
    $('steps').append(item)
  })
}

function resultsText() {
  const summary = steps.map((_, index) => {
    const answer = answers[index]
    return `step ${index + 1}: ${answer.result || 'not done'}${answer.note ? ` — ${answer.note}` : ''}`
  })
  return [navigator.userAgent, '', ...summary, '', ...logLines].join('\n')
}

// ---------- automatic checks (silent) ----------

// Checks that the calls work. It cannot check what a person hears.
async function runSelfTest() {
  const result = { userAgent: navigator.userAgent, checks: [] }
  const check = async (name, fn) => {
    try {
      result.checks.push({ name, ok: true, detail: await fn() })
    } catch (error) {
      result.checks.push({ name, ok: false, detail: String(error) })
    }
  }
  // Opens a context on a device, plays silence, and checks that time moves.
  const openSilent = async (device) => {
    const context = new AudioContext()
    await context.setSinkId(device.deviceId)
    const gain = context.createGain()
    gain.gain.value = 0
    gain.connect(context.destination)
    const oscillator = context.createOscillator()
    oscillator.connect(gain)
    oscillator.start()
    await context.resume()
    return context
  }
  const moved = async (context) => {
    const before = context.currentTime
    await wait(500)
    if (!(context.currentTime > before)) throw new Error(`time did not move (state ${context.state})`)
  }

  let outputs = []
  await check('lists the output devices by name', async () => {
    outputs = await readDevices()
    if (outputs.length === 0) throw new Error('no output device')
    if (outputs.some((d) => !d.label)) throw new Error('a device has no name')
    return outputs.map((d) => d.label)
  })

  for (const device of outputs) {
    await check(`plays on a named device: ${device.label}`, async () => {
      const context = await openSilent(device)
      try {
        await moved(context)
      } finally {
        await context.close()
      }
      return 'the audio context ran on it'
    })
  }

  await check('two outputs at the same time', async () => {
    if (outputs.length < 2) throw new Error('needs two output devices')
    const first = await openSilent(outputs[0])
    const second = await openSilent(outputs[1])
    try {
      await Promise.all([moved(first), moved(second)])
    } finally {
      await first.close()
      await second.close()
    }
    return `${outputs[0].label} + ${outputs[1].label}`
  })

  await check('wavesurfer.js draws, has handles, and plays on a named device', async () => {
    const container = document.createElement('div')
    container.style.cssText = 'position: fixed; left: -9999px; width: 400px'
    document.body.append(container)
    const created = createWaveform(container)
    try {
      await created.ready
      created.regions.addRegion({ start: 1, end: 5, resize: true, drag: false })
      created.regions.addRegion({ start: 3, drag: true })
      created.surfer.setVolume(0)
      await created.surfer.setSinkId(outputs[0].deviceId)
      await created.surfer.play()
      await wait(500)
      const time = created.surfer.getCurrentTime()
      created.surfer.pause()
      if (!(time > 0)) throw new Error('playback time did not move')
      return `regions: ${created.regions.getRegions().length}, played ${time.toFixed(2)} s on ${outputs[0].label}`
    } finally {
      created.surfer.destroy()
      container.remove()
    }
  })

  return result
}
window.runSelfTest = runSelfTest

// ---------- start ----------

$('main-device').addEventListener('change', (event) => chooseDevice(main, event.target.value))
$('preview-device').addEventListener('change', (event) => chooseDevice(preview, event.target.value))
$('main-play').addEventListener('click', () => play(main))
$('main-stop').addEventListener('click', () => stop(main))
$('preview-play').addEventListener('click', () => previewIsValid() && play(preview))
$('preview-stop').addEventListener('click', () => stop(preview))
$('wave-listen').addEventListener('click', listen)
$('wave-stop').addEventListener('click', () => wave.pause())
$('run-checks').addEventListener('click', async () => {
  $('run-checks').disabled = true
  log('automatic checks: started')
  const result = await runSelfTest()
  for (const item of result.checks) {
    log(`automatic check ${item.ok ? 'OK  ' : 'FAIL'} ${item.name}: ${JSON.stringify(item.detail)}`)
  }
  $('run-checks').disabled = false
})
$('copy-results').addEventListener('click', async () => {
  try {
    await navigator.clipboard.writeText(resultsText())
    $('copy-status').textContent = 'Copied.'
  } catch {
    $('log').select()
    $('copy-status').textContent = 'Not copied. The text is selected: press Cmd/Ctrl+C.'
  }
})

navigator.mediaDevices.addEventListener('devicechange', () => refreshDevices('devicechange'))
setInterval(updateStatus, 500)

buildSteps()
refreshDevices('start').then(() => log(`start: ${devices.length} output devices: ${devices.map((d) => d.label).join(', ')}`))
setUpWaveform().catch((error) => log(`waveform: setup FAILED: ${error}`))

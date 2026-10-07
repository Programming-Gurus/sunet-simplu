import { describe, expect, it } from 'vitest'
import {
  continueAvailable,
  defaultSongSettings,
  defaultTrigger,
  effectiveFades,
  endValue,
  newProject,
  newStep,
  normalizeProject,
  partOf,
  removeSong,
  resolveStart,
  roundFade,
  setStepKind,
  setStopTarget,
  startValue,
  stepFades,
  stepsUsingSong,
  stopCandidates,
  stopsChosen,
  stopTargets,
  TRIGGER_TEXT_MAX,
  triggerAction,
  triggerLine,
} from '@shared/project'
import type { Project, Step } from '@shared/types'
// Project files that version 0.2.0 wrote: the project file of an export, and a project with
// fade switches, background steps and stop-step choices.
import exportFile from './fixtures/0.2.0/export-project.json?raw'
import layersFile from './fixtures/0.2.0/layers-project.json?raw'
// A project file that version 0.3.0 wrote, with fade times of a step and a step without a title.
import export030File from './fixtures/0.3.0/export-project.json?raw'

function songStep(id: string, songId: string): Step {
  const step = newStep(id)
  setStepKind(step, 'song', songId)
  return step
}

describe('fade times (5.3)', () => {
  it('keeps values in 0–300 s, in steps of 0.1 s', () => {
    expect(roundFade(1.04)).toBe(1)
    expect(roundFade(1.06)).toBe(1.1)
    expect(roundFade(-3)).toBe(0)
    expect(roundFade(99)).toBe(99)
    expect(roundFade(300)).toBe(300)
    expect(roundFade(301)).toBe(300)
    expect(roundFade(Number.NaN, 5)).toBe(5)
  })

  it('gives a new project a fade-in of 10 s and a fade-out of 5 s', () => {
    const project = newProject('p1', 'Test', '2026-10-07T10:00:00.000Z')
    expect(project.fadeIn).toBe(10)
    expect(project.fadeOut).toBe(5)
  })

  it('shortens both fades when the part is too short (5.4)', () => {
    expect(effectiveFades(10, 1, 1)).toEqual({ fadeIn: 1, fadeOut: 1 })
    const short = effectiveFades(1, 1, 3)
    expect(short.fadeIn).toBeCloseTo(0.25)
    expect(short.fadeOut).toBeCloseTo(0.75)
    expect(effectiveFades(5, 0, 0)).toEqual({ fadeIn: 0, fadeOut: 0 })
  })
})

describe('start point and end point (5.4)', () => {
  it('defaults to the full song, with the limit in the middle', () => {
    const part = partOf(defaultSongSettings(), 185)
    expect(part).toEqual({ start: 0, end: 185, limit: 92.5, naturalStart: true, naturalEnd: true })
  })

  it('marks moved points as cut points', () => {
    const part = partOf({ ...defaultSongSettings(), start: 12, end: 160 }, 185)
    expect(part.naturalStart).toBe(false)
    expect(part.naturalEnd).toBe(false)
    expect(part.limit).toBe(86)
  })

  it('keeps the end at least 1 s after the start', () => {
    const part = partOf({ ...defaultSongSettings(), start: 100, end: 100.2 }, 185)
    expect(part.end - part.start).toBeCloseTo(1)
    expect(endValue(50.3, 50, 185)).toBe(51)
    expect(startValue(184.9, 185)).toBe(184)
  })

  it('stores the ends of the file as natural points', () => {
    expect(startValue(0.01, 100)).toBeNull()
    expect(endValue(184.99, 0, 185)).toBeNull()
    expect(startValue(12, 100)).toBe(12)
  })

  it('keeps a moved limit between the two points', () => {
    const part = partOf({ ...defaultSongSettings(), start: 10, end: 20, limit: 50 }, 100)
    expect(part.limit).toBe(20)
  })

  it('accepts a song shorter than 1 s', () => {
    const part = partOf(defaultSongSettings(), 0.4)
    expect(part.start).toBe(0)
    expect(part.end).toBeCloseTo(0.4)
  })
})

describe('Continue (5.6)', () => {
  const part = partOf({ ...defaultSongSettings(), start: 12, end: 160 }, 185)

  it('is available only if a step above uses the same song', () => {
    const steps = [songStep('a', 's1'), newStep('n'), songStep('b', 's2'), songStep('c', 's1')]
    expect(continueAvailable(steps, 0)).toBe(false)
    expect(continueAvailable(steps, 2)).toBe(false)
    expect(continueAvailable(steps, 3)).toBe(true)
    expect(continueAvailable(steps, 1)).toBe(false)
  })

  it('starts at the remembered position', () => {
    expect(resolveStart(part, true, 60)).toBe(60)
  })

  it('starts from the start point with Continue off', () => {
    expect(resolveStart(part, false, 60)).toBe(12)
  })

  it('starts from the start point if the song did not play', () => {
    expect(resolveStart(part, true, undefined)).toBe(12)
  })

  it('starts from the start point if the song stopped after the limit', () => {
    expect(resolveStart(part, true, 86.1)).toBe(12)
    expect(resolveStart(part, true, 86)).toBe(86)
  })

  it('starts from the start point if the song stopped before the start point', () => {
    expect(resolveStart(part, true, 5)).toBe(12)
  })
})

describe('what a step is (4.3)', () => {
  it('gives a new song the default settings', () => {
    const step = songStep('a', 's1')
    expect(step.kind).toBe('song')
    expect(step.songSettings.s1).toEqual(defaultSongSettings())
  })

  it('keeps the settings of each song, also through Note and Stop', () => {
    const step = songStep('a', 's1')
    step.songSettings.s1.start = 12
    step.songSettings.s1.volume = 70
    setStepKind(step, 'song', 's2')
    expect(step.songSettings.s2.volume).toBe(100)
    setStepKind(step, 'note')
    expect(step.kind).toBe('note')
    expect(step.songId).toBeNull()
    setStepKind(step, 'stop')
    setStepKind(step, 'song', 's1')
    expect(step.songSettings.s1.start).toBe(12)
    expect(step.songSettings.s1.volume).toBe(70)
  })

  it('does not count kept settings as use of a song', () => {
    const step = songStep('a', 's1')
    setStepKind(step, 'note')
    expect(stepsUsingSong([step, songStep('b', 's2')], 's1')).toEqual([])
    expect(stepsUsingSong([step, songStep('b', 's2')], 's2')).toEqual([2])
  })

  it('removes the kept settings with the song', () => {
    const project = newProject('p1', 'Test', '2026-10-07T10:00:00.000Z')
    project.songs.push({ id: 's1', name: 'a.mp3', file: 's1.mp3', duration: 10 })
    const step = songStep('a', 's1')
    setStepKind(step, 'note')
    project.steps.push(step)
    removeSong(project, 's1')
    expect(project.songs).toEqual([])
    expect(step.songSettings).toEqual({})
  })
})

describe('fade switches and background (5.2, 5.3)', () => {
  it('gives a new song step both fades and the normal layer', () => {
    const settings = defaultSongSettings()
    expect(settings.fadesIn).toBe(true)
    expect(settings.fadesOut).toBe(true)
    expect(settings.background).toBe(false)
  })

  it('reads a project from before the switches as it played then', () => {
    const project = normalizeProject({
      id: 'p1',
      songs: [{ id: 's1', name: 'a.mp3', file: 's1.mp3', duration: 10 }],
      steps: [
        { id: 'a', kind: 'song', songId: 's1', songSettings: { s1: { volume: 70 } } },
        { id: 'b', kind: 'stop' },
      ],
    })
    expect(project!.steps[0].songSettings.s1).toEqual({ ...defaultSongSettings(), volume: 70 })
    expect(project!.steps[1].stops).toEqual([])
  })

  it('keeps the switches that the file has', () => {
    const project = normalizeProject({
      id: 'p1',
      songs: [{ id: 's1', name: 'a.mp3', file: 's1.mp3', duration: 10 }],
      steps: [{ id: 'a', kind: 'song', songId: 's1', songSettings: { s1: { fadesIn: false, fadesOut: false, background: true } } }],
    })
    const settings = project!.steps[0].songSettings.s1
    expect([settings.fadesIn, settings.fadesOut, settings.background]).toEqual([false, false, true])
  })
})

describe('fade times of a step (5.3)', () => {
  const project = { fadeIn: 10, fadeOut: 5 }

  it('follows the project until the step has its own time', () => {
    const settings = defaultSongSettings()
    expect(settings.fadeInTime).toBeNull()
    expect(settings.fadeOutTime).toBeNull()
    expect(stepFades(settings, project)).toEqual({ fadeIn: 10, fadeOut: 5 })
    expect(stepFades(settings, { fadeIn: 3, fadeOut: 2 })).toEqual({ fadeIn: 3, fadeOut: 2 })
  })

  it('uses the times of the step, each one by itself', () => {
    expect(stepFades({ ...defaultSongSettings(), fadeOutTime: 20 }, project)).toEqual({ fadeIn: 10, fadeOut: 20 })
    expect(stepFades({ ...defaultSongSettings(), fadeInTime: 0 }, project)).toEqual({ fadeIn: 0, fadeOut: 5 })
  })

  it('keeps the times that the file has, in 0–300 s and in steps of 0.1 s', () => {
    const read = normalizeProject({
      id: 'p1',
      songs: [{ id: 's1', name: 'a.mp3', file: 's1.mp3', duration: 10 }],
      steps: [
        { id: 'a', kind: 'song', songId: 's1', songSettings: { s1: { fadeInTime: 2.54, fadeOutTime: 999 } } },
        { id: 'b', kind: 'song', songId: 's1', songSettings: { s1: { fadeInTime: 'long', fadeOutTime: 0 } } },
      ],
    })
    expect(read!.steps[0].songSettings.s1.fadeInTime).toBe(2.5)
    expect(read!.steps[0].songSettings.s1.fadeOutTime).toBe(300)
    expect(read!.steps[1].songSettings.s1.fadeInTime).toBeNull()
    expect(read!.steps[1].songSettings.s1.fadeOutTime).toBe(0)
  })
})

describe('project files from older versions', () => {
  const files: [name: string, raw: string][] = [
    ['0.2.0: the project file of an export', exportFile],
    ['0.2.0: a project with switches, backgrounds and stop-step choices', layersFile],
    ['0.3.0: the project file of an export', export030File],
  ]

  /** The file as the app must read it: every old value, plus the values that the file did not have. */
  function expected(raw: string): Project {
    const file = JSON.parse(raw) as Project
    for (const step of file.steps) {
      // Before the triggers, the title was the line (4.4). The step had no light cues.
      step.trigger = { ...defaultTrigger(), lineText: step.title }
      step.title = ''
      step.lights = []
      // A file from before the fade times of a step follows the times of the project.
      for (const settings of Object.values(step.songSettings)) {
        settings.fadeInTime ??= null
        settings.fadeOutTime ??= null
      }
    }
    file.lightGroups = []
    return file
  }

  for (const [name, raw] of files) {
    it(`opens ${name} with every value kept`, () => {
      const file = expected(raw)
      expect(file.steps.length).toBeGreaterThan(0)
      expect(normalizeProject(JSON.parse(raw))).toEqual(file)
    })

    it(`reads ${name} the same way after a save`, () => {
      const first = normalizeProject(JSON.parse(raw))
      expect(normalizeProject(JSON.parse(JSON.stringify(first)))).toEqual(first)
    })
  }

  for (const [name, raw] of files.slice(0, 2)) {
    it(`plays ${name} with the fade times of the project`, () => {
      const project = normalizeProject(JSON.parse(raw))!
      const songSteps = project.steps.filter((step) => step.kind === 'song')
      expect(songSteps.length).toBeGreaterThan(0)
      for (const step of songSteps) {
        expect(stepFades(step.songSettings[step.songId!], project)).toEqual({ fadeIn: project.fadeIn, fadeOut: project.fadeOut })
      }
    })
  }

  it('keeps the fade times of a step from 0.3.0', () => {
    const project = normalizeProject(JSON.parse(export030File))!
    const step = project.steps[3]
    expect(stepFades(step.songSettings[step.songId!], project)).toEqual({ fadeIn: 20, fadeOut: 1.5 })
  })
})

describe('what triggers a step (4.4)', () => {
  const songs = [{ id: 's1', name: 'a.mp3', file: 's1.mp3', duration: 10 }]

  it('gives a new step a line trigger without text', () => {
    const step = newStep('a')
    expect(step.trigger).toEqual({ line: true, lineText: '', action: false, actionText: '' })
    expect(triggerLine(step)).toBe('')
    expect(triggerAction(step)).toBe('')
  })

  it('gives only the triggers that are on and have text', () => {
    const step = newStep('a')
    step.trigger = { line: true, lineText: '  Au sosit!  ', action: false, actionText: 'Ana iese' }
    expect(triggerLine(step)).toBe('Au sosit!')
    expect(triggerAction(step)).toBe('')
    step.trigger.line = false
    step.trigger.action = true
    expect(triggerLine(step)).toBe('')
    expect(triggerAction(step)).toBe('Ana iese')
  })

  it('reads the title of an old step as its line, for each kind of step', () => {
    const project = normalizeProject({
      id: 'p1',
      songs,
      steps: [
        { id: 'a', kind: 'song', songId: 's1', title: 'Nu mai am nimic de spus.' },
        { id: 'b', kind: 'note', title: 'Bună, East' },
        { id: 'c', kind: 'stop', title: 'Ce mai așteptăm?' },
        { id: 'd', kind: 'stop' },
      ],
    })!
    expect(project.steps.map((step) => step.title)).toEqual(['', '', '', ''])
    expect(project.steps.map(triggerLine)).toEqual(['Nu mai am nimic de spus.', 'Bună, East', 'Ce mai așteptăm?', ''])
    expect(project.steps.every((step) => step.trigger.line && !step.trigger.action)).toBe(true)
  })

  it('keeps the title of a step that has a trigger', () => {
    const project = normalizeProject({
      id: 'p1',
      songs,
      steps: [
        { id: 'a', kind: 'note', title: 'Scena 2', trigger: { line: false, lineText: 'x', action: true, actionText: 'Ana iese pe ușă' } },
        { id: 'b', kind: 'note', title: 'Scena 3', trigger: {} },
      ],
    })!
    expect(project.steps[0].title).toBe('Scena 2')
    expect(project.steps[0].trigger).toEqual({ line: false, lineText: 'x', action: true, actionText: 'Ana iese pe ușă' })
    // A trigger without values is a line trigger without text.
    expect(project.steps[1].title).toBe('Scena 3')
    expect(project.steps[1].trigger).toEqual(defaultTrigger())
  })

  it('repairs a trigger that is not text', () => {
    const project = normalizeProject({
      id: 'p1',
      songs,
      steps: [{ id: 'a', kind: 'note', trigger: { line: 'yes', lineText: 7, action: 1, actionText: 'x'.repeat(TRIGGER_TEXT_MAX + 50) } }],
    })!
    expect(project.steps[0].trigger).toEqual({ line: true, lineText: '', action: false, actionText: 'x'.repeat(TRIGGER_TEXT_MAX) })
  })
})

describe('what a stop step stops (5.2)', () => {
  function stopStep(id: string, stops: string[] = []): Step {
    const step = newStep(id)
    setStepKind(step, 'stop')
    step.stops = stops
    return step
  }

  it('lists the song steps above it, nearest first', () => {
    const steps = [songStep('a', 's1'), newStep('n'), songStep('b', 's2'), stopStep('x'), songStep('c', 's1')]
    expect(stopCandidates(steps, 3).map((step) => step.id)).toEqual(['b', 'a'])
    expect(stopCandidates(steps, 0)).toEqual([])
  })

  it('stops the nearest song step above it, without a choice', () => {
    const steps = [songStep('a', 's1'), songStep('b', 's2'), newStep('n'), stopStep('x')]
    expect(stopTargets(steps, 3)).toEqual(['b'])
    expect(stopsChosen(steps, 3)).toBe(false)
  })

  it('stops nothing if no song step is above it', () => {
    const steps = [newStep('n'), stopStep('x'), songStep('a', 's1')]
    expect(stopTargets(steps, 1)).toEqual([])
    expect(stopTargets(steps, 2)).toEqual([])
  })

  it('stops the steps that the user chose', () => {
    const steps = [songStep('a', 's1'), songStep('b', 's2'), songStep('c', 's1'), stopStep('x', ['a', 'b'])]
    expect(stopTargets(steps, 3)).toEqual(['b', 'a'])
    expect(stopsChosen(steps, 3)).toBe(true)
  })

  it('returns to the default if no chosen step is above it', () => {
    const steps = [songStep('a', 's1'), stopStep('x', ['b', 'gone']), songStep('b', 's2')]
    expect(stopTargets(steps, 1)).toEqual(['a'])
    expect(stopsChosen(steps, 1)).toBe(false)
  })

  it('adds and removes a step, and keeps at least one', () => {
    const steps = [songStep('a', 's1'), songStep('b', 's2'), stopStep('x')]
    setStopTarget(steps, 2, 'a', true)
    expect(steps[2].stops).toEqual(['b', 'a'])
    setStopTarget(steps, 2, 'b', false)
    expect(steps[2].stops).toEqual(['a'])
    setStopTarget(steps, 2, 'a', false)
    expect(steps[2].stops).toEqual([])
    expect(stopTargets(steps, 2)).toEqual(['b'])
  })

  it('keeps only the steps of the project when it reads a file', () => {
    const project = normalizeProject({
      id: 'p1',
      songs: [{ id: 's1', name: 'a.mp3', file: 's1.mp3', duration: 10 }],
      steps: [
        { id: 'a', kind: 'song', songId: 's1' },
        { id: 'x', kind: 'stop', stops: ['a', 'a', 'gone', 'x', 7, '../bad'] },
      ],
    })
    expect(project!.steps[1].stops).toEqual(['a'])
  })
})

describe('project data from a file', () => {
  it('refuses data that is not a project', () => {
    expect(normalizeProject(null)).toBeNull()
    expect(normalizeProject({ id: '../x', songs: [], steps: [] })).toBeNull()
    expect(normalizeProject({ id: 'p1', songs: 'no', steps: [] })).toBeNull()
  })

  it('repairs what it can', () => {
    const project = normalizeProject({
      id: 'p1',
      name: '  Pescărușul ',
      fadeIn: 999,
      songs: [
        { id: 's1', name: 'vals.flac', file: 's1.flac', duration: 332 },
        { id: 's2', name: 'bad', file: '../../etc/passwd', duration: 1 },
      ],
      steps: [
        { id: 'a', kind: 'song', songId: 's1', title: 'Vals', songSettings: { s1: { start: 5, volume: 250 }, gone: {} } },
        { id: 'b', kind: 'song', songId: 's2', title: 'Lost song' },
        { id: 'c', kind: 'stop' },
        { id: 'a', kind: 'note', title: 'Same id twice' },
      ],
    })
    expect(project).not.toBeNull()
    expect(project!.name).toBe('Pescărușul')
    expect(project!.fadeIn).toBe(300)
    expect(project!.fadeOut).toBe(5)
    expect(project!.songs.map((song) => song.id)).toEqual(['s1'])
    expect(project!.steps.map((step) => step.kind)).toEqual(['song', 'note', 'stop'])
    expect(project!.steps[0].songSettings).toEqual({ s1: { ...defaultSongSettings(), start: 5, volume: 100 } })
  })
})

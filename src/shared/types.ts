// Data shapes that the main process and the interface share.
// The section numbers refer to DESIGN.md.

export type Language = 'ro' | 'en'

/** App settings (section 8). They stay on the computer. */
export interface AppSettings {
  language: Language
  /** Name of the main output device. `null` is "System default". */
  mainOutput: string | null
  /** Name of the preview output device. `null` is "None". */
  previewOutput: string | null
  /** The light groups of this computer (8.3). A project holds a copy of the groups that its steps use. */
  lightGroups: LightGroup[]
}

/** A set of lights that the operator switches together (8.3). */
export interface LightGroup {
  id: string
  name: string
  /** The name of the icon in Material Design Icons, for example `mdiSpotlightBeam`. */
  icon: string
  /** The drawing of the icon: an SVG path on a 24 × 24 grid. A group shows without the icon library. */
  iconPath: string
}

/** One light change of a step (4.5). */
export interface LightCue {
  groupId: string
  /** `true` turns the group on. `false` turns it off. */
  on: boolean
  /** The colour of the light, as `#rrggbb`. A cue that turns the group off keeps it and does not show it. */
  color: string
}

/** What tells the operator to run a step (4.4): a line, an action on the stage, or both. */
export interface Trigger {
  line: boolean
  /** The line that an actor says. */
  lineText: string
  action: boolean
  /** What happens on the stage. */
  actionText: string
}

export type StepKind = 'note' | 'stop' | 'song'

/** The settings that a song step has for one song (4.1, 4.3). Times are in seconds. */
export interface SongSettings {
  /** `null` is the natural start, the beginning of the file. */
  start: number | null
  /** `null` is the natural end, the end of the file. */
  end: number | null
  /** Continue limit. `null` follows the middle between the two points. */
  limit: number | null
  /** 0–100. */
  volume: number
  loop: boolean
  continue: boolean
  /** The step fades in when it starts. Off for a sound effect (5.3). */
  fadesIn: boolean
  /** The step fades out when it stops. Off for a sound effect (5.3). */
  fadesOut: boolean
  /** The fade-in time of the step, in seconds. `null` follows the project (5.3). */
  fadeInTime: number | null
  /** The fade-out time of the step, in seconds. `null` follows the project (5.3). */
  fadeOutTime: number | null
  /** A background step stops nothing, and other song steps do not stop it (5.2). */
  background: boolean
}

export interface Step {
  id: string
  kind: StepKind
  title: string
  trigger: Trigger
  notes: string
  /** The light changes of the step, one at most for each light group (4.5). */
  lights: LightCue[]
  /** The song of a song step. `null` for the other kinds. */
  songId: string | null
  /** The settings that the step keeps for each song that it had (4.3). */
  songSettings: Record<string, SongSettings>
  /** The song steps that a stop step stops. Empty: the nearest song step above it (5.2). */
  stops: string[]
}

export interface Song {
  id: string
  /** The file name that the user added, for display. */
  name: string
  /** The file name in the `audio/` folder of the project. */
  file: string
  /** Seconds. */
  duration: number
}

export interface Project {
  formatVersion: 1
  id: string
  name: string
  /** Seconds, 0–300 in steps of 0.1 (5.3). */
  fadeIn: number
  fadeOut: number
  songs: Song[]
  steps: Step[]
  /** A copy of the light groups that the steps use, so an export shows them on any computer (7). */
  lightGroups: LightGroup[]
  createdAt: string
  updatedAt: string
}

export interface ProjectSummary {
  id: string
  name: string
  stepCount: number
  songCount: number
  updatedAt: string
}

/** What the main process asks before it closes the window while music plays (5.8). */
export interface CloseGuard {
  message: string
  detail: string
  confirm: string
  cancel: string
}

export type ExportResult = { status: 'done'; path: string } | { status: 'canceled' } | { status: 'failed'; reason: string }

export type ImportResult =
  | { status: 'done'; project: ProjectSummary }
  | { status: 'canceled' }
  | { status: 'invalid' }
  | { status: 'failed'; reason: string }

export const AUDIO_EXTENSIONS = ['mp3', 'wav', 'm4a', 'aac', 'flac', 'ogg', 'opus'] as const

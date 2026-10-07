// The functions that the interface can call in the main process.
// The preload script implements this, and the interface sees it as `window.api`.

import type { AppSettings, CloseGuard, ExportResult, ImportResult, Project, ProjectSummary } from './types'

export interface Api {
  settings: {
    get(): Promise<AppSettings>
    set(patch: Partial<AppSettings>): Promise<AppSettings>
  }
  projects: {
    list(): Promise<ProjectSummary[]>
    create(name: string): Promise<Project>
    read(id: string): Promise<Project | null>
    save(project: Project): Promise<void>
    duplicate(id: string, name: string): Promise<ProjectSummary | null>
    /** Moves the project to the Trash of the computer. */
    remove(id: string): Promise<void>
    exportProject(id: string): Promise<ExportResult>
    importProject(): Promise<ImportResult>
    /** The names of the projects on this computer whose steps use a light group. */
    usingLightGroup(groupId: string): Promise<string[]>
  }
  songs: {
    /** Copies an audio file and its waveform into the project. Returns the stored file name. */
    add(projectId: string, songId: string, extension: string, bytes: Uint8Array, peaks: number[]): Promise<string>
    /** Returns `null` if the file is missing. */
    read(projectId: string, file: string): Promise<Uint8Array | null>
    readPeaks(projectId: string, songId: string): Promise<number[] | null>
    remove(projectId: string, songId: string, file: string): Promise<void>
  }
  app: {
    openPgSite(): void
    /** Keeps the computer awake while a project is in Show mode (5.8). */
    setShowMode(on: boolean): void
    /** `null` lets the window close without a question. */
    setCloseGuard(guard: CloseGuard | null): void
    /** The main process asks the interface to save before the window closes. */
    onFlushRequest(handler: () => Promise<void>): void
    selfTest: boolean
    /** Only in a self-test run. */
    selfTestResize(width: number, height: number): Promise<void>
    selfTestCapture(name: string): Promise<void>
    selfTestExport(id: string): Promise<string>
    selfTestImport(file: string): Promise<ImportResult>
  }
}

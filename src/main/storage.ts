// Projects on disk (DESIGN.md, section 7).
// Each project is one folder: `project.json` and an `audio/` folder.

import { app, shell } from 'electron'
import { promises as fs } from 'node:fs'
import path from 'node:path'
import { randomUUID } from 'node:crypto'
import { isValidAudioFile, isValidId, newProject, normalizeProject } from '@shared/project'
import { AUDIO_EXTENSIONS, type Project, type ProjectSummary } from '@shared/types'

const PROJECT_FILE = 'project.json'
const AUDIO_FOLDER = 'audio'

// A self-test run works in a temporary folder. It deletes there and never fills the Trash.
const selfTest = process.argv.includes('--selftest')

async function discard(target: string): Promise<void> {
  if (selfTest) await fs.rm(target, { recursive: true, force: true })
  else await shell.trashItem(target)
}

export function projectsFolder(): string {
  return path.join(app.getPath('userData'), 'projects')
}

export function projectFolder(id: string): string {
  if (!isValidId(id)) throw new Error('Invalid project id')
  return path.join(projectsFolder(), id)
}

function audioPath(projectId: string, file: string): string {
  if (!isValidAudioFile(file)) throw new Error('Invalid audio file name')
  return path.join(projectFolder(projectId), AUDIO_FOLDER, file)
}

function peaksPath(projectId: string, songId: string): string {
  if (!isValidId(songId)) throw new Error('Invalid song id')
  return path.join(projectFolder(projectId), AUDIO_FOLDER, `${songId}.peaks.json`)
}

function summaryOf(project: Project): ProjectSummary {
  return {
    id: project.id,
    name: project.name,
    stepCount: project.steps.length,
    songCount: project.songs.length,
    updatedAt: project.updatedAt,
  }
}

async function exists(target: string): Promise<boolean> {
  try {
    await fs.access(target)
    return true
  } catch {
    return false
  }
}

export async function readProject(id: string): Promise<Project | null> {
  try {
    const raw = JSON.parse(await fs.readFile(path.join(projectFolder(id), PROJECT_FILE), 'utf8'))
    const project = normalizeProject(raw)
    if (!project) return null
    // The folder name is the identity. A copied folder keeps working.
    project.id = id
    return project
  } catch {
    return null
  }
}

// Writes to one project wait for each other, so a fast series of saves cannot mix.
const writeQueues = new Map<string, Promise<void>>()

export function writeProject(project: Project): Promise<void> {
  const folder = projectFolder(project.id)
  const data = JSON.stringify(project, null, 2)
  const previous = writeQueues.get(project.id) ?? Promise.resolve()
  const next = previous
    .catch(() => undefined)
    .then(async () => {
      await fs.mkdir(path.join(folder, AUDIO_FOLDER), { recursive: true })
      // Write a second file, then swap. A crash never leaves half a project file.
      const temporary = path.join(folder, `${PROJECT_FILE}.tmp`)
      await fs.writeFile(temporary, data, 'utf8')
      await fs.rename(temporary, path.join(folder, PROJECT_FILE))
    })
  writeQueues.set(project.id, next)
  return next
}

export async function saveProject(raw: unknown): Promise<void> {
  const project = normalizeProject(raw)
  if (!project) throw new Error('Invalid project data')
  if (!(await exists(projectFolder(project.id)))) throw new Error('The project does not exist')
  await writeProject(project)
}

export async function listProjects(): Promise<ProjectSummary[]> {
  let entries: string[]
  try {
    entries = await fs.readdir(projectsFolder())
  } catch {
    return []
  }
  const summaries: ProjectSummary[] = []
  for (const entry of entries) {
    if (!isValidId(entry)) continue
    const project = await readProject(entry)
    if (project) summaries.push(summaryOf(project))
  }
  return summaries.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
}

export async function createProject(name: string): Promise<Project> {
  const project = newProject(randomUUID(), cleanName(name), new Date().toISOString())
  await writeProject(project)
  return project
}

export async function duplicateProject(id: string, name: string): Promise<ProjectSummary | null> {
  const source = await readProject(id)
  if (!source) return null
  await writeQueues.get(id)?.catch(() => undefined)
  const copyId = randomUUID()
  await fs.cp(projectFolder(id), projectFolder(copyId), { recursive: true })
  const now = new Date().toISOString()
  const copy: Project = { ...source, id: copyId, name: cleanName(name), createdAt: now, updatedAt: now }
  await writeProject(copy)
  return summaryOf(copy)
}

/** The names of the projects on this computer whose steps use a light group (8.3). */
export async function projectsUsingLightGroup(groupId: string): Promise<string[]> {
  let entries: string[]
  try {
    entries = await fs.readdir(projectsFolder())
  } catch {
    return []
  }
  const names: string[] = []
  for (const entry of entries) {
    if (!isValidId(entry)) continue
    const project = await readProject(entry)
    if (project?.steps.some((step) => step.lights.some((cue) => cue.groupId === groupId))) names.push(project.name)
  }
  return names.sort((a, b) => a.localeCompare(b))
}

/** Delete goes to the Trash of the computer, so a wrong click can be undone. */
export async function removeProject(id: string): Promise<void> {
  const folder = projectFolder(id)
  await writeQueues.get(id)?.catch(() => undefined)
  writeQueues.delete(id)
  if (await exists(folder)) await discard(folder)
}

export async function addSong(
  projectId: string,
  songId: string,
  extension: string,
  bytes: Uint8Array,
  peaks: number[],
): Promise<string> {
  const ext = extension.toLowerCase()
  if (!(AUDIO_EXTENSIONS as readonly string[]).includes(ext)) throw new Error('Unsupported audio format')
  if (!isValidId(songId)) throw new Error('Invalid song id')
  const file = `${songId}.${ext}`
  const target = audioPath(projectId, file)
  await fs.mkdir(path.dirname(target), { recursive: true })
  await fs.writeFile(target, bytes)
  await fs.writeFile(peaksPath(projectId, songId), JSON.stringify(cleanPeaks(peaks)), 'utf8')
  return file
}

export async function readSong(projectId: string, file: string): Promise<Uint8Array | null> {
  try {
    return await fs.readFile(audioPath(projectId, file))
  } catch {
    return null
  }
}

export async function readPeaks(projectId: string, songId: string): Promise<number[] | null> {
  try {
    const raw = JSON.parse(await fs.readFile(peaksPath(projectId, songId), 'utf8'))
    return Array.isArray(raw) ? cleanPeaks(raw) : null
  } catch {
    return null
  }
}

export async function removeSongFiles(projectId: string, songId: string, file: string): Promise<void> {
  const target = audioPath(projectId, file)
  if (await exists(target)) await discard(target)
  await fs.rm(peaksPath(projectId, songId), { force: true })
}

function cleanPeaks(peaks: unknown[]): number[] {
  return peaks.slice(0, 20000).map((value) => (typeof value === 'number' && Number.isFinite(value) ? value : 0))
}

export function cleanName(name: unknown): string {
  const value = typeof name === 'string' ? name.trim().slice(0, 120) : ''
  return value || 'Sunet Simplu'
}

export { summaryOf, AUDIO_FOLDER, PROJECT_FILE }

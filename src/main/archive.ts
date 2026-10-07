// Export and import of a project as one file (DESIGN.md, section 7).
// The file is a ZIP archive with the extension `.sunetsimplu`.

import { app, dialog, type BrowserWindow } from 'electron'
import { createWriteStream, promises as fs } from 'node:fs'
import path from 'node:path'
import { randomUUID } from 'node:crypto'
import { pipeline } from 'node:stream/promises'
import yauzl from 'yauzl'
import yazl from 'yazl'
import { usedLightGroups } from '@shared/lights'
import { normalizeProject } from '@shared/project'
import { AUDIO_EXTENSIONS, type ExportResult, type ImportResult } from '@shared/types'
import { getSettings } from './settings'
import { AUDIO_FOLDER, PROJECT_FILE, listProjects, projectFolder, readProject, summaryOf, writeProject } from './storage'

export const ARCHIVE_EXTENSION = 'sunetsimplu'
const FILTERS = [{ name: 'Sunet Simplu', extensions: [ARCHIVE_EXTENSION] }]
const MAX_PROJECT_BYTES = 20 * 1024 * 1024
/** One audio file. A long WAV file is some hundreds of megabytes. */
const MAX_ENTRY_BYTES = 2 * 1024 * 1024 * 1024

// Only these entries leave an archive: the project file, audio files and waveforms.
const AUDIO_ENTRY = new RegExp(`^${AUDIO_FOLDER}/[A-Za-z0-9-]{1,64}\\.(?:${AUDIO_EXTENSIONS.join('|')}|peaks\\.json)$`)

async function exists(target: string): Promise<boolean> {
  try {
    await fs.access(target)
    return true
  } catch {
    return false
  }
}

function fileNameFor(projectName: string): string {
  const clean = projectName.replace(/[\\/:*?"<>|\u0000-\u001f]/g, ' ').replace(/\s+/g, ' ').trim()
  return `${clean || 'Sunet Simplu'}.${ARCHIVE_EXTENSION}`
}

export async function exportProjectTo(id: string, target: string): Promise<void> {
  const project = await readProject(id)
  if (!project) throw new Error('The project does not exist')
  // The export carries the light groups as the settings have them now, also if the project file is older.
  project.lightGroups = usedLightGroups(project.steps, [...(await getSettings()).lightGroups, ...project.lightGroups])
  const folder = projectFolder(id)
  const zip = new yazl.ZipFile()
  zip.addBuffer(Buffer.from(JSON.stringify(project, null, 2), 'utf8'), PROJECT_FILE)
  for (const song of project.songs) {
    const audio = path.join(folder, AUDIO_FOLDER, song.file)
    // Audio formats are compressed already. A second compression only costs time.
    if (await exists(audio)) zip.addFile(audio, `${AUDIO_FOLDER}/${song.file}`, { compress: false })
    const peaks = path.join(folder, AUDIO_FOLDER, `${song.id}.peaks.json`)
    if (await exists(peaks)) zip.addFile(peaks, `${AUDIO_FOLDER}/${song.id}.peaks.json`)
  }
  zip.end()
  // Write a second file, then swap. A failed export never leaves half a file with the final name.
  const temporary = `${target}.tmp`
  try {
    await pipeline(zip.outputStream, createWriteStream(temporary))
    await fs.rename(temporary, target)
  } catch (error) {
    await fs.rm(temporary, { force: true })
    throw error
  }
}

export async function exportProject(window: BrowserWindow, id: string): Promise<ExportResult> {
  const project = await readProject(id)
  if (!project) return { status: 'failed', reason: 'The project does not exist' }
  const choice = await dialog.showSaveDialog(window, {
    defaultPath: path.join(app.getPath('documents'), fileNameFor(project.name)),
    filters: FILTERS,
  })
  if (choice.canceled || !choice.filePath) return { status: 'canceled' }
  try {
    await exportProjectTo(id, choice.filePath)
    return { status: 'done', path: choice.filePath }
  } catch (error) {
    return { status: 'failed', reason: error instanceof Error ? error.message : String(error) }
  }
}

function openZip(file: string): Promise<yauzl.ZipFile> {
  return new Promise((resolve, reject) => {
    yauzl.open(file, { lazyEntries: true }, (error, zip) => (error || !zip ? reject(error ?? new Error('Not an archive')) : resolve(zip)))
  })
}

/** Unpacks the permitted entries of an archive into a folder. Returns `false` if it is not a project archive. */
async function unpack(file: string, folder: string): Promise<boolean> {
  let zip: yauzl.ZipFile
  try {
    zip = await openZip(file)
  } catch {
    return false
  }
  let foundProject = false
  await new Promise<void>((resolve, reject) => {
    zip.on('error', reject)
    zip.on('end', resolve)
    zip.on('entry', (entry: yauzl.Entry) => {
      const name = entry.fileName
      const isProject = name === PROJECT_FILE
      // An entry name never chooses a place outside the project folder: the name must match exactly.
      if (!isProject && !AUDIO_ENTRY.test(name)) {
        zip.readEntry()
        return
      }
      if (entry.uncompressedSize > (isProject ? MAX_PROJECT_BYTES : MAX_ENTRY_BYTES)) {
        reject(new Error('An entry of the archive is too large'))
        return
      }
      zip.openReadStream(entry, (error, stream) => {
        if (error || !stream) {
          reject(error ?? new Error('Cannot read the archive'))
          return
        }
        const target = path.join(folder, ...name.split('/'))
        fs.mkdir(path.dirname(target), { recursive: true })
          .then(() => pipeline(stream, createWriteStream(target)))
          .then(() => {
            if (isProject) foundProject = true
            zip.readEntry()
          })
          .catch(reject)
      })
    })
    zip.readEntry()
  }).finally(() => zip.close())
  return foundProject
}

async function uniqueName(name: string): Promise<string> {
  const names = new Set((await listProjects()).map((project) => project.name))
  if (!names.has(name)) return name
  for (let n = 2; ; n++) {
    const candidate = `${name} (${n})`
    if (!names.has(candidate)) return candidate
  }
}

export async function importProjectFrom(file: string): Promise<ImportResult> {
  const id = randomUUID()
  const folder = projectFolder(id)
  try {
    const name = await fs.stat(file).then(() => true)
    if (!name) return { status: 'invalid' }
    if (!(await unpack(file, folder))) {
      await fs.rm(folder, { recursive: true, force: true })
      return { status: 'invalid' }
    }
    const raw = JSON.parse(await fs.readFile(path.join(folder, PROJECT_FILE), 'utf8'))
    const project = normalizeProject({ ...raw, id })
    if (!project) {
      await fs.rm(folder, { recursive: true, force: true })
      return { status: 'invalid' }
    }
    // The import is a new project on this computer. It never replaces a project.
    project.name = await uniqueName(project.name)
    await writeProject(project)
    return { status: 'done', project: summaryOf(project) }
  } catch (error) {
    await fs.rm(folder, { recursive: true, force: true })
    if (error instanceof SyntaxError) return { status: 'invalid' }
    return { status: 'failed', reason: error instanceof Error ? error.message : String(error) }
  }
}

export async function importProject(window: BrowserWindow): Promise<ImportResult> {
  const choice = await dialog.showOpenDialog(window, { filters: FILTERS, properties: ['openFile'] })
  if (choice.canceled || choice.filePaths.length === 0) return { status: 'canceled' }
  return importProjectFrom(choice.filePaths[0])
}

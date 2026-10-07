// App settings on this computer (DESIGN.md, section 8). They are not part of a project.

import { app } from 'electron'
import { promises as fs } from 'node:fs'
import path from 'node:path'
import { normalizeLightGroups } from '@shared/lights'
import type { AppSettings } from '@shared/types'

const defaults: AppSettings = { language: 'ro', mainOutput: null, previewOutput: null, lightGroups: [] }

let current: AppSettings | null = null

function settingsFile(): string {
  return path.join(app.getPath('userData'), 'settings.json')
}

function deviceName(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.slice(0, 300) : null
}

function normalize(raw: unknown): AppSettings {
  const source = typeof raw === 'object' && raw !== null ? (raw as Record<string, unknown>) : {}
  const settings: AppSettings = {
    language: source.language === 'en' ? 'en' : 'ro',
    mainOutput: deviceName(source.mainOutput),
    previewOutput: deviceName(source.previewOutput),
    lightGroups: normalizeLightGroups(source.lightGroups),
  }
  // The same device cannot be both outputs (8.2).
  if (settings.previewOutput && settings.previewOutput === settings.mainOutput) settings.previewOutput = null
  return settings
}

export async function getSettings(): Promise<AppSettings> {
  if (current) return current
  try {
    current = normalize(JSON.parse(await fs.readFile(settingsFile(), 'utf8')))
  } catch {
    current = { ...defaults }
  }
  return current
}

export async function setSettings(patch: unknown): Promise<AppSettings> {
  const next = normalize({ ...(await getSettings()), ...(typeof patch === 'object' && patch !== null ? patch : {}) })
  current = next
  await fs.mkdir(path.dirname(settingsFile()), { recursive: true })
  await fs.writeFile(settingsFile(), JSON.stringify(next, null, 2), 'utf8')
  return next
}

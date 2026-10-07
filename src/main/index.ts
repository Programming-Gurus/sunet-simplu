// Main process: the window, the permissions and the access to the disk.

import { app, BrowserWindow, dialog, ipcMain, Menu, powerSaveBlocker, session, shell } from 'electron'
import { mkdirSync, mkdtempSync, promises as fs } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import type { CloseGuard } from '@shared/types'
import { exportProject, exportProjectTo, importProject, importProjectFrom } from './archive'
import { getSettings, setSettings } from './settings'
import {
  addSong,
  createProject,
  duplicateProject,
  listProjects,
  projectsUsingLightGroup,
  readPeaks,
  readProject,
  readSong,
  removeProject,
  removeSongFiles,
  saveProject,
} from './storage'

const PG_SITE = 'https://programminggurus.ro'
const selfTest = process.argv.includes('--selftest')

app.setName('Sunet Simplu')
if (selfTest) {
  // The self-test never touches real projects.
  app.setPath('userData', mkdtempSync(path.join(os.tmpdir(), 'sunet-simplu-selftest-')))
} else if (!app.isPackaged) {
  // A development run keeps its projects away from the installed app.
  app.setPath('userData', path.join(app.getPath('appData'), 'Sunet Simplu Dev'))
}

// A show starts sound from the Space key. It must never wait for a click.
app.commandLine.appendSwitch('autoplay-policy', 'no-user-gesture-required')

// The interface may list and select output devices. Nothing else.
const allowedPermissions = new Set(['media', 'speaker-selection'])

let mainWindow: BrowserWindow | null = null
let closeGuard: CloseGuard | null = null
let closeConfirmed = false
let flushed = false
let showModeBlocker: number | null = null

function createWindow(): void {
  const window = new BrowserWindow({
    width: 1360,
    height: 840,
    minWidth: 1280,
    minHeight: 720,
    show: false,
    backgroundColor: '#121110',
    title: 'Sunet Simplu',
    webPreferences: {
      preload: path.join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      // The lights app is in front during a show. Timers and fades must not slow down.
      backgroundThrottling: false,
      additionalArguments: selfTest ? ['--sunet-selftest'] : [],
    },
  })
  mainWindow = window

  window.once('ready-to-show', () => {
    if (!selfTest) window.show()
  })

  // The app shows only its own pages. Links never open inside it.
  window.webContents.setWindowOpenHandler(() => ({ action: 'deny' }))
  window.webContents.on('will-navigate', (event) => event.preventDefault())

  window.on('close', (event) => {
    if (closeGuard && !closeConfirmed) {
      event.preventDefault()
      const choice = dialog.showMessageBoxSync(window, {
        type: 'warning',
        message: closeGuard.message,
        detail: closeGuard.detail,
        buttons: [closeGuard.confirm, closeGuard.cancel],
        defaultId: 1,
        cancelId: 1,
      })
      if (choice !== 0) return
      closeConfirmed = true
    }
    if (!flushed) {
      // Let the interface write its last change, then close.
      event.preventDefault()
      const finish = (): void => {
        if (flushed) return
        flushed = true
        if (!window.isDestroyed()) window.close()
      }
      ipcMain.once('app:flushed', finish)
      setTimeout(finish, 1500)
      window.webContents.send('app:flush')
    }
  })

  window.on('closed', () => {
    mainWindow = null
  })

  if (process.env.ELECTRON_RENDERER_URL) {
    void window.loadURL(process.env.ELECTRON_RENDERER_URL)
  } else {
    void window.loadFile(path.join(__dirname, '../renderer/index.html'))
  }

  if (selfTest) void runSelfTest(window)
}

async function runSelfTest(window: BrowserWindow): Promise<void> {
  let result: Record<string, unknown>
  try {
    await new Promise<void>((resolve) => window.webContents.once('did-finish-load', () => resolve()))
    result = await window.webContents.executeJavaScript('window.__sunetSelfTest()')
  } catch (error) {
    result = { fatal: String(error) }
  }
  result.electron = process.versions.electron
  result.chrome = process.versions.chrome
  result.os = `${process.platform} ${process.arch}`
  console.log(JSON.stringify(result, null, 2))
  closeConfirmed = true
  flushed = true
  app.exit(result.fatal || result.failed ? 1 : 0)
}

function buildMenu(): void {
  const template: Electron.MenuItemConstructorOptions[] = [
    ...(process.platform === 'darwin' ? [{ role: 'appMenu' } as Electron.MenuItemConstructorOptions] : []),
    { role: 'editMenu' },
    { role: 'windowMenu' },
  ]
  if (!app.isPackaged) {
    template.push({ label: 'Develop', submenu: [{ role: 'reload' }, { role: 'toggleDevTools' }] })
  }
  Menu.setApplicationMenu(Menu.buildFromTemplate(template))
}

function registerHandlers(): void {
  ipcMain.handle('settings:get', () => getSettings())
  ipcMain.handle('settings:set', (_event, patch: unknown) => setSettings(patch))

  ipcMain.handle('projects:list', () => listProjects())
  ipcMain.handle('projects:create', (_event, name: string) => createProject(name))
  ipcMain.handle('projects:read', (_event, id: string) => readProject(id))
  ipcMain.handle('projects:save', (_event, project: unknown) => saveProject(project))
  ipcMain.handle('projects:duplicate', (_event, id: string, name: string) => duplicateProject(id, name))
  ipcMain.handle('projects:remove', (_event, id: string) => removeProject(id))
  ipcMain.handle('projects:export', (_event, id: string) =>
    mainWindow ? exportProject(mainWindow, id) : { status: 'failed', reason: 'No window' },
  )
  ipcMain.handle('projects:import', () => (mainWindow ? importProject(mainWindow) : { status: 'failed', reason: 'No window' }))
  ipcMain.handle('projects:usingLightGroup', (_event, groupId: string) => projectsUsingLightGroup(String(groupId)))

  ipcMain.handle('songs:add', (_event, projectId: string, songId: string, extension: string, bytes: Uint8Array, peaks: number[]) =>
    addSong(projectId, songId, String(extension), bytes, Array.isArray(peaks) ? peaks : []),
  )
  ipcMain.handle('songs:read', (_event, projectId: string, file: string) => readSong(projectId, file))
  ipcMain.handle('songs:readPeaks', (_event, projectId: string, songId: string) => readPeaks(projectId, songId))
  ipcMain.handle('songs:remove', (_event, projectId: string, songId: string, file: string) =>
    removeSongFiles(projectId, songId, file),
  )

  if (selfTest) registerSelfTestHandlers()

  ipcMain.on('app:openPgSite', () => {
    void shell.openExternal(PG_SITE)
  })
  ipcMain.on('app:setShowMode', (_event, on: boolean) => {
    if (on && showModeBlocker === null) {
      showModeBlocker = powerSaveBlocker.start('prevent-display-sleep')
    } else if (!on && showModeBlocker !== null) {
      powerSaveBlocker.stop(showModeBlocker)
      showModeBlocker = null
    }
  })
  ipcMain.on('app:setCloseGuard', (_event, guard: CloseGuard | null) => {
    closeGuard =
      guard && typeof guard.message === 'string'
        ? {
            message: String(guard.message),
            detail: String(guard.detail ?? ''),
            confirm: String(guard.confirm ?? 'OK'),
            cancel: String(guard.cancel ?? 'Cancel'),
          }
        : null
  })
}

/** Only in a self-test run: the interface can size the window and save a picture of itself. */
function registerSelfTestHandlers(): void {
  const folder = process.env.SUNET_SELFTEST_OUT || path.join(app.getPath('userData'), 'pictures')
  mkdirSync(folder, { recursive: true })
  ipcMain.handle('selftest:resize', (_event, width: number, height: number) => {
    mainWindow?.setContentSize(Math.round(width), Math.round(height))
  })
  // Export and import without the file dialogs, in the temporary folder.
  ipcMain.handle('selftest:export', async (_event, id: string) => {
    const target = path.join(app.getPath('userData'), 'export-test.sunetsimplu')
    await exportProjectTo(id, target)
    return target
  })
  ipcMain.handle('selftest:import', async (_event, file: string) => {
    if (file !== 'invalid') return importProjectFrom(file)
    const junk = path.join(app.getPath('userData'), 'not-a-project.sunetsimplu')
    await fs.writeFile(junk, 'This is not an archive.')
    return importProjectFrom(junk)
  })
  ipcMain.handle('selftest:capture', async (_event, name: string) => {
    if (!mainWindow) return
    const image = await mainWindow.webContents.capturePage()
    await fs.writeFile(path.join(folder, `${String(name).replace(/[^A-Za-z0-9-]/g, '_')}.png`), image.toPNG())
  })
}

app.whenReady().then(() => {
  session.defaultSession.setPermissionCheckHandler((_webContents, permission) => allowedPermissions.has(permission))
  session.defaultSession.setPermissionRequestHandler((_webContents, permission, callback) =>
    callback(allowedPermissions.has(permission)),
  )
  registerHandlers()
  buildMenu()
  createWindow()
})

app.on('window-all-closed', () => app.quit())

export function getMainWindow(): BrowserWindow | null {
  return mainWindow
}

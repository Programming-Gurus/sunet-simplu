'use strict'

// Throwaway test app. It proves the audio-device assumptions of DESIGN.md, section 9.
// It is not the start of the real app.

const { app, BrowserWindow, session } = require('electron')
const path = require('node:path')

const selfTest = process.argv.includes('--selftest')

// The real app starts sound from the Space key, so it must not wait for a click.
app.commandLine.appendSwitch('autoplay-policy', 'no-user-gesture-required')

// The page may list and select output devices, and copy the results. Nothing else.
const allowedPermissions = new Set(['speaker-selection', 'media', 'clipboard-sanitized-write'])
const askedPermissions = new Set()

app.whenReady().then(async () => {
  session.defaultSession.setPermissionCheckHandler((_webContents, permission) => {
    askedPermissions.add(permission)
    return allowedPermissions.has(permission)
  })
  session.defaultSession.setPermissionRequestHandler((_webContents, permission, callback) => {
    askedPermissions.add(permission)
    callback(allowedPermissions.has(permission))
  })

  const window = new BrowserWindow({
    width: 1000,
    height: 900,
    backgroundColor: '#121110',
    webPreferences: { contextIsolation: true, nodeIntegration: false, sandbox: true },
  })
  window.removeMenu()
  await window.loadFile(path.join(__dirname, 'index.html'))

  if (!selfTest) return

  // Automatic checks, all silent. Print the result and quit.
  let result
  try {
    result = await window.webContents.executeJavaScript('runSelfTest()')
  } catch (error) {
    result = { fatal: String(error) }
  }
  result.electron = process.versions.electron
  result.chrome = process.versions.chrome
  result.os = `${process.platform} ${process.arch}`
  result.permissionsAsked = [...askedPermissions]
  console.log(JSON.stringify(result, null, 2))
  app.quit()
})

app.on('window-all-closed', () => app.quit())

// Draws the app icon: the four amber bars of the Projects screen on a dark tile.
// Run with `npm run icon`. It writes build/icon.png, which electron-builder turns into the Mac icon.
const { app, BrowserWindow } = require('electron')
const fs = require('node:fs')
const path = require('node:path')

const svg = `
<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 1024 1024">
  <rect x="100" y="100" width="824" height="824" rx="186" fill="#1A1917"/>
  <rect x="101" y="101" width="822" height="822" rx="185" fill="none" stroke="#34312C" stroke-width="2"/>
  <g fill="#F2A93B">
    <rect x="292" y="548" width="80" height="170" rx="30"/>
    <rect x="412" y="306" width="80" height="412" rx="30"/>
    <rect x="532" y="458" width="80" height="260" rx="30"/>
    <rect x="652" y="382" width="80" height="336" rx="30"/>
  </g>
</svg>`

app.disableHardwareAcceleration()
app.whenReady().then(async () => {
  const window = new BrowserWindow({ width: 512, height: 512, show: false, frame: false, transparent: true, webPreferences: { offscreen: true } })
  const page = `<html><body style="margin:0;background:transparent">${svg}</body></html>`
  await window.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(page)}`)
  await new Promise((resolve) => setTimeout(resolve, 300))
  const image = (await window.webContents.capturePage()).resize({ width: 1024, height: 1024, quality: 'best' })
  const target = path.join(__dirname, '..', 'build', 'icon.png')
  fs.mkdirSync(path.dirname(target), { recursive: true })
  fs.writeFileSync(target, image.toPNG())
  console.log(`${target}: ${image.getSize().width} x ${image.getSize().height}`)
  app.quit()
})

// The bridge between the interface and the main process.
// The interface has no direct access to the disk or to Electron.

import { contextBridge, ipcRenderer } from 'electron'
import type { Api } from '@shared/api'

const api: Api = {
  settings: {
    get: () => ipcRenderer.invoke('settings:get'),
    set: (patch) => ipcRenderer.invoke('settings:set', patch),
  },
  projects: {
    list: () => ipcRenderer.invoke('projects:list'),
    create: (name) => ipcRenderer.invoke('projects:create', name),
    read: (id) => ipcRenderer.invoke('projects:read', id),
    save: (project) => ipcRenderer.invoke('projects:save', project),
    duplicate: (id, name) => ipcRenderer.invoke('projects:duplicate', id, name),
    remove: (id) => ipcRenderer.invoke('projects:remove', id),
    exportProject: (id) => ipcRenderer.invoke('projects:export', id),
    importProject: () => ipcRenderer.invoke('projects:import'),
    usingLightGroup: (groupId) => ipcRenderer.invoke('projects:usingLightGroup', groupId),
  },
  songs: {
    add: (projectId, songId, extension, bytes, peaks) =>
      ipcRenderer.invoke('songs:add', projectId, songId, extension, bytes, peaks),
    read: (projectId, file) => ipcRenderer.invoke('songs:read', projectId, file),
    readPeaks: (projectId, songId) => ipcRenderer.invoke('songs:readPeaks', projectId, songId),
    remove: (projectId, songId, file) => ipcRenderer.invoke('songs:remove', projectId, songId, file),
  },
  app: {
    openPgSite: () => ipcRenderer.send('app:openPgSite'),
    setShowMode: (on) => ipcRenderer.send('app:setShowMode', on),
    setCloseGuard: (guard) => ipcRenderer.send('app:setCloseGuard', guard),
    onFlushRequest: (handler) => {
      ipcRenderer.removeAllListeners('app:flush')
      ipcRenderer.on('app:flush', () => {
        void handler()
          .catch(() => undefined)
          .then(() => ipcRenderer.send('app:flushed'))
      })
    },
    selfTest: process.argv.includes('--sunet-selftest'),
    selfTestResize: (width, height) => ipcRenderer.invoke('selftest:resize', width, height),
    selfTestCapture: (name) => ipcRenderer.invoke('selftest:capture', name),
    selfTestExport: (id) => ipcRenderer.invoke('selftest:export', id),
    selfTestImport: (file) => ipcRenderer.invoke('selftest:import', file),
  },
}

contextBridge.exposeInMainWorld('api', api)

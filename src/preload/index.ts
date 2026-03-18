import { contextBridge, ipcRenderer } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'
import type { ElectronAPI } from '@shared/types'

// Full typed API for renderer
const api: ElectronAPI = {
  memo: {
    create: (req) => ipcRenderer.invoke('memo:create', req),
    read: (id) => ipcRenderer.invoke('memo:read', id),
    update: (req) => ipcRenderer.invoke('memo:update', req),
    delete: (id) => ipcRenderer.invoke('memo:delete', id),
    list: () => ipcRenderer.invoke('memo:list'),
    getVersions: (id) => ipcRenderer.invoke('memo:versions', id),
    restoreVersion: (memoId, versionId) =>
      ipcRenderer.invoke('memo:restore-version', memoId, versionId),
    deleteVersion: (memoId, versionId) =>
      ipcRenderer.invoke('memo:delete-version', memoId, versionId),
    clearAll: () => ipcRenderer.invoke('memo:clear-all')
  },
  tag: {
    list: () => ipcRenderer.invoke('tag:list'),
    rename: (oldPath, newPath) => ipcRenderer.invoke('tag:rename', oldPath, newPath),
    delete: (tagPath) => ipcRenderer.invoke('tag:delete', tagPath)
  },
  search: {
    query: (req) => ipcRenderer.invoke('search:query', req)
  },
  image: {
    save: (req) => ipcRenderer.invoke('image:save', req),
    getPath: (filename) => ipcRenderer.invoke('image:load', filename)
  },
  recycle: {
    list: () => ipcRenderer.invoke('recycle:list'),
    restore: (id) => ipcRenderer.invoke('recycle:restore', id),
    purge: (id) => ipcRenderer.invoke('recycle:purge', id),
    empty: () => ipcRenderer.invoke('recycle:empty')
  },
  import: {
    selectDirectory: () => ipcRenderer.invoke('import:select-directory'),
    flomo: (dirPath) => ipcRenderer.invoke('import:flomo', dirPath),
    anyhark: (dirPath) => ipcRenderer.invoke('import:anyhark', dirPath)
  },
  export: {
    csv: () => ipcRenderer.invoke('export:csv'),
    json: () => ipcRenderer.invoke('export:json')
  },
  onDataChanged: (callback: () => void) => {
    const listener = (): void => callback()
    ipcRenderer.on('data-changed', listener)
    return () => { ipcRenderer.removeListener('data-changed', listener) }
  }
}

// Use `contextBridge` APIs to expose Electron APIs to
// renderer only if context isolation is enabled, otherwise
// just add to the DOM global.
if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('electron', electronAPI)
    contextBridge.exposeInMainWorld('api', api)
  } catch (error) {
    console.error(error)
  }
} else {
  // @ts-ignore (define in dts)
  window.electron = electronAPI
  // @ts-ignore (define in dts)
  window.api = api
}

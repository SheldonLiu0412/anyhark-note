import { ipcMain } from 'electron'
import * as tagIndexService from '../services/tag-index.service'

export function registerTagIpc(): void {
  ipcMain.handle('tag:list', async () => {
    try {
      return tagIndexService.getTagIndex()
    } catch (error) {
      console.error('[IPC] tag:list failed:', error)
      throw error
    }
  })

  ipcMain.handle('tag:rename', async (_event, oldPath: string, newPath: string) => {
    try {
      return await tagIndexService.renameTag(oldPath, newPath)
    } catch (error) {
      console.error('[IPC] tag:rename failed:', error)
      throw error
    }
  })

  ipcMain.handle('tag:delete', async (_event, tagPath: string) => {
    try {
      return await tagIndexService.deleteTag(tagPath)
    } catch (error) {
      console.error('[IPC] tag:delete failed:', error)
      throw error
    }
  })
}

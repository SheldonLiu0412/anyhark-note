import { ipcMain } from 'electron'
import * as memoService from '../services/memo.service'

export function registerRecycleIpc(): void {
  ipcMain.handle('recycle:list', async () => {
    try {
      return memoService.listDeletedMeta()
    } catch (error) {
      console.error('[IPC] recycle:list failed:', error)
      throw error
    }
  })

  ipcMain.handle('recycle:restore', async (_event, id: string) => {
    try {
      return await memoService.restoreMemo(id)
    } catch (error) {
      console.error('[IPC] recycle:restore failed:', error)
      throw error
    }
  })

  ipcMain.handle('recycle:purge', async (_event, id: string) => {
    try {
      return await memoService.purgeMemo(id)
    } catch (error) {
      console.error('[IPC] recycle:purge failed:', error)
      throw error
    }
  })

  ipcMain.handle('recycle:empty', async () => {
    try {
      const deletedMemos = memoService.listDeletedMeta()
      for (const memo of deletedMemos) {
        await memoService.purgeMemo(memo.id)
      }
    } catch (error) {
      console.error('[IPC] recycle:empty failed:', error)
      throw error
    }
  })
}

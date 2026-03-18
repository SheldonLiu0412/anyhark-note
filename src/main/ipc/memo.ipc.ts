import { ipcMain } from 'electron'
import type { CreateMemoRequest, UpdateMemoRequest } from '@shared/types'
import * as memoService from '../services/memo.service'
import * as tagIndexService from '../services/tag-index.service'

export function registerMemoIpc(): void {
  ipcMain.handle('memo:create', async (_event, req: CreateMemoRequest) => {
    try {
      return await memoService.createMemo(req)
    } catch (error) {
      console.error('[IPC] memo:create failed:', error)
      throw error
    }
  })

  ipcMain.handle('memo:read', async (_event, id: string) => {
    try {
      return await memoService.readMemo(id)
    } catch (error) {
      console.error('[IPC] memo:read failed:', error)
      throw error
    }
  })

  ipcMain.handle('memo:update', async (_event, req: UpdateMemoRequest) => {
    try {
      return await memoService.updateMemo(req)
    } catch (error) {
      console.error('[IPC] memo:update failed:', error)
      throw error
    }
  })

  ipcMain.handle('memo:delete', async (_event, id: string) => {
    try {
      return await memoService.softDeleteMemo(id)
    } catch (error) {
      console.error('[IPC] memo:delete failed:', error)
      throw error
    }
  })

  ipcMain.handle('memo:list', async () => {
    try {
      return memoService.listMemoMeta()
    } catch (error) {
      console.error('[IPC] memo:list failed:', error)
      throw error
    }
  })

  ipcMain.handle('memo:versions', async (_event, id: string) => {
    try {
      return await memoService.getVersions(id)
    } catch (error) {
      console.error('[IPC] memo:versions failed:', error)
      throw error
    }
  })

  ipcMain.handle('memo:restore-version', async (_event, memoId: string, versionId: string) => {
    try {
      return await memoService.restoreVersion(memoId, versionId)
    } catch (error) {
      console.error('[IPC] memo:restore-version failed:', error)
      throw error
    }
  })

  ipcMain.handle('memo:delete-version', async (_event, memoId: string, versionId: string) => {
    try {
      return await memoService.deleteVersion(memoId, versionId)
    } catch (error) {
      console.error('[IPC] memo:delete-version failed:', error)
      throw error
    }
  })

  ipcMain.handle('memo:clear-all', async () => {
    try {
      await memoService.clearAllMemos()
      // Rebuild empty tag index
      await tagIndexService.init([])
    } catch (error) {
      console.error('[IPC] memo:clear-all failed:', error)
      throw error
    }
  })
}

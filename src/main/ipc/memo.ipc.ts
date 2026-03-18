import { ipcMain } from 'electron'
import type { CreateMemoRequest, UpdateMemoRequest } from '@shared/types'
import * as memoService from '../services/memo.service'
import * as tagIndexService from '../services/tag-index.service'

export function registerMemoIpc(): void {
  ipcMain.handle('memo:create', async (_event, req: CreateMemoRequest) => {
    try {
      const memo = await memoService.createMemo(req)
      tagIndexService.updateTagsForMemo(memo.id, [], memo.tags)
      await tagIndexService.save()
      return memo
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
      const oldMemo = await memoService.readMemo(req.id)
      const oldTags = oldMemo.tags
      const memo = await memoService.updateMemo(req)
      tagIndexService.updateTagsForMemo(memo.id, oldTags, memo.tags)
      await tagIndexService.save()
      return memo
    } catch (error) {
      console.error('[IPC] memo:update failed:', error)
      throw error
    }
  })

  ipcMain.handle('memo:delete', async (_event, id: string) => {
    try {
      const oldMemo = await memoService.readMemo(id)
      await memoService.softDeleteMemo(id)
      tagIndexService.updateTagsForMemo(id, oldMemo.tags, [])
      await tagIndexService.save()
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

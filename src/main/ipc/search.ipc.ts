import { ipcMain } from 'electron'
import type { SearchRequest } from '@shared/types'
import * as searchService from '../services/search.service'
import * as memoService from '../services/memo.service'

export function registerSearchIpc(): void {
  ipcMain.handle('search:query', async (_event, req: SearchRequest) => {
    try {
      // When includeDeleted is true, combine active and deleted memos
      const memos = req.includeDeleted
        ? [...memoService.listMemoMeta(), ...memoService.listDeletedMeta()]
        : memoService.listMemoMeta()
      return searchService.search(req, memos)
    } catch (error) {
      console.error('[IPC] search:query failed:', error)
      throw error
    }
  })
}

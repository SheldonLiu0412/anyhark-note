import { ipcMain, dialog, BrowserWindow } from 'electron'
import { importFromFlomo } from '../services/flomo-import.service'
import * as memoService from '../services/memo.service'
import * as tagIndexService from '../services/tag-index.service'

export function registerImportIpc(): void {
  ipcMain.handle('import:select-directory', async () => {
    const win = BrowserWindow.getFocusedWindow()
    if (!win) return null

    const result = await dialog.showOpenDialog(win, {
      title: '选择 Flomo 导出文件夹',
      properties: ['openDirectory'],
      buttonLabel: '导入'
    })

    if (result.canceled || result.filePaths.length === 0) return null
    return result.filePaths[0]
  })

  ipcMain.handle('import:flomo', async (_event, dirPath: string) => {
    const result = await importFromFlomo(dirPath)

    // Force rebuild indexes from disk after import
    await memoService.rebuildMetadataIndex()
    tagIndexService.rebuildTagIndex(memoService.listMemoMeta())
    await tagIndexService.save()

    return result
  })
}

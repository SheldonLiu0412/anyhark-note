import { ipcMain, dialog, BrowserWindow } from 'electron'
import { importFromFlomo } from '../services/flomo-import.service'
import { importFromAnyhark } from '../services/anyhark-import.service'
import * as memoService from '../services/memo.service'
import * as tagIndexService from '../services/tag-index.service'

async function rebuildIndexes(): Promise<void> {
  await memoService.rebuildMetadataIndex()
  tagIndexService.rebuildTagIndex(memoService.listMemoMeta())
  await tagIndexService.save()
}

export function registerImportIpc(): void {
  ipcMain.handle('import:select-directory', async () => {
    const win = BrowserWindow.getFocusedWindow()
    if (!win) return null

    const result = await dialog.showOpenDialog(win, {
      title: '选择导入文件夹',
      properties: ['openDirectory'],
      buttonLabel: '导入'
    })

    if (result.canceled || result.filePaths.length === 0) return null
    return result.filePaths[0]
  })

  ipcMain.handle('import:flomo', async (_event, dirPath: string) => {
    const result = await importFromFlomo(dirPath)
    await rebuildIndexes()
    return result
  })

  ipcMain.handle('import:anyhark', async (_event, dirPath: string) => {
    const result = await importFromAnyhark(dirPath)
    await rebuildIndexes()
    return result
  })
}

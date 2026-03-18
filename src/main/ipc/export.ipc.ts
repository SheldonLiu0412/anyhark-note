import { ipcMain, dialog, BrowserWindow } from 'electron'
import { createWriteStream } from 'fs'
import archiver from 'archiver'
import * as memoService from '../services/memo.service'
import { getImagePath } from '../services/image.service'

function escapeCSV(value: string): string {
  if (value.includes(',') || value.includes('"') || value.includes('\n') || value.includes('\r')) {
    return `"${value.replace(/"/g, '""')}"`
  }
  return value
}

export function registerExportIpc(): void {
  ipcMain.handle('export:csv', async () => {
    const win = BrowserWindow.getFocusedWindow()
    if (!win) return null

    const rows = await memoService.getAllMemosForExport()
    if (rows.length === 0) return null

    const result = await dialog.showSaveDialog(win, {
      title: '导出笔记',
      defaultPath: `anyhark-export-${new Date().toISOString().slice(0, 10)}.zip`,
      filters: [{ name: 'ZIP', extensions: ['zip'] }]
    })

    if (result.canceled || !result.filePath) return null

    const hasAnyImages = rows.some((r) => r.images.length > 0)

    let csv = '\uFEFF' + 'content,created_at\n'
    for (const row of rows) {
      let content = row.content
      if (row.images.length > 0) {
        const imgLines = row.images.map((_f, i) => `[图片${i + 1}] images/${row.id}/${_f}`).join('\n')
        content = content + '\n' + imgLines
      }
      csv += `${escapeCSV(content)},${row.createdAt}\n`
    }

    await new Promise<void>((resolve, reject) => {
      const output = createWriteStream(result.filePath!)
      const archive = archiver('zip', { zlib: { level: 9 } })

      output.on('close', resolve)
      archive.on('error', reject)
      archive.pipe(output)

      archive.append(csv, { name: 'anyhark-export.csv' })

      if (hasAnyImages) {
        const imagePromises: Promise<void>[] = []
        for (const row of rows) {
          for (const filename of row.images) {
            imagePromises.push(
              getImagePath(filename)
                .then((absPath) => {
                  archive.file(absPath, { name: `images/${row.id}/${filename}` })
                })
                .catch(() => {
                  // skip missing images
                })
            )
          }
        }

        Promise.all(imagePromises)
          .then(() => archive.finalize())
          .catch(reject)
      } else {
        archive.finalize()
      }
    })

    return { count: rows.length, path: result.filePath }
  })

  ipcMain.handle('export:json', async () => {
    const win = BrowserWindow.getFocusedWindow()
    if (!win) return null

    const memos = await memoService.getAllMemosForJsonExport()
    if (memos.length === 0) return null

    const result = await dialog.showSaveDialog(win, {
      title: '导出笔记 (JSON)',
      defaultPath: `anyhark-backup-${new Date().toISOString().slice(0, 10)}.zip`,
      filters: [{ name: 'ZIP', extensions: ['zip'] }]
    })

    if (result.canceled || !result.filePath) return null

    const allImages = memos.flatMap((m) => m.images || [])

    await new Promise<void>((resolve, reject) => {
      const output = createWriteStream(result.filePath!)
      const archive = archiver('zip', { zlib: { level: 9 } })

      output.on('close', resolve)
      archive.on('error', reject)
      archive.pipe(output)

      for (const memo of memos) {
        archive.append(JSON.stringify(memo, null, 2), { name: `memos/${memo.id}.json` })
      }

      if (allImages.length > 0) {
        const imagePromises = allImages.map((filename) =>
          getImagePath(filename)
            .then((absPath) => {
              archive.file(absPath, { name: `images/${filename}` })
            })
            .catch(() => {
              // skip missing images
            })
        )

        Promise.all(imagePromises)
          .then(() => archive.finalize())
          .catch(reject)
      } else {
        archive.finalize()
      }
    })

    return { count: memos.length, path: result.filePath }
  })
}

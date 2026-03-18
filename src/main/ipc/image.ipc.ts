import { ipcMain } from 'electron'
import type { SaveImageRequest } from '@shared/types'
import * as imageService from '../services/image.service'

export function registerImageIpc(): void {
  ipcMain.handle('image:save', async (_event, req: SaveImageRequest) => {
    try {
      return await imageService.saveImage(req)
    } catch (error) {
      console.error('[IPC] image:save failed:', error)
      throw error
    }
  })

  ipcMain.handle('image:load', async (_event, filename: string) => {
    try {
      return await imageService.getImagePath(filename)
    } catch (error) {
      console.error('[IPC] image:load failed:', error)
      throw error
    }
  })
}

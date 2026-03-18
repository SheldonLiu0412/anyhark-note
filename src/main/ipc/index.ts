import * as memoService from '../services/memo.service'
import * as tagIndexService from '../services/tag-index.service'
import { seedExampleMemos } from '../services/seed.service'
import { startApiServer } from '../services/api-server.service'
import { registerMemoIpc } from './memo.ipc'
import { registerTagIpc } from './tag.ipc'
import { registerSearchIpc } from './search.ipc'
import { registerImageIpc } from './image.ipc'
import { registerRecycleIpc } from './recycle.ipc'
import { registerImportIpc } from './import.ipc'
import { registerExportIpc } from './export.ipc'

/**
 * Initialize services and register all IPC handlers.
 * Must be called before creating the browser window.
 */
export async function registerAllIpcHandlers(): Promise<void> {
  // Initialize storage services
  await memoService.init()

  // Seed example notes on first launch
  await seedExampleMemos()
  await memoService.rebuildMetadataIndex()

  await tagIndexService.init(memoService.listMemoMeta())

  // Register IPC handlers
  registerMemoIpc()
  registerTagIpc()
  registerSearchIpc()
  registerImageIpc()
  registerRecycleIpc()
  registerImportIpc()
  registerExportIpc()

  // Start local HTTP API server for CLI / Agent access
  startApiServer()

  console.log('[IPC] All handlers registered')
}

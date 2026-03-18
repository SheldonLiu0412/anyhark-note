import { app, shell, BrowserWindow, protocol, net, dialog } from 'electron'
import { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import { autoUpdater } from 'electron-updater'
import icon from '../../resources/icon.png?asset'
import { registerAllIpcHandlers } from './ipc'
import { getImagePath } from './services/image.service'
import { stopApiServer } from './services/api-server.service'

// Register privileged scheme before app is ready
protocol.registerSchemesAsPrivileged([
  {
    scheme: 'anyhark-image',
    privileges: { secure: true, supportFetchAPI: true, stream: true }
  }
])

function createWindow(): void {
  const mainWindow = new BrowserWindow({
    width: 1100,
    height: 750,
    minWidth: 800,
    minHeight: 500,
    show: false,
    titleBarStyle: 'hiddenInset',
    trafficLightPosition: { x: 14, y: 14 },
    title: 'Anyhark',
    ...(process.platform === 'linux' ? { icon } : {}),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false
    }
  })

  mainWindow.on('ready-to-show', () => {
    mainWindow.show()
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  // HMR for renderer base on electron-vite cli.
  // Load the remote URL for development or the local html file for production.
  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.whenReady().then(async () => {
  // Set app user model id for windows
  electronApp.setAppUserModelId('com.anyhark.app')

  // Default open or close DevTools by F12 in development
  // and ignore CommandOrControl + R in production.
  // see https://github.com/alex8088/electron-toolkit/tree/master/packages/utils
  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  // Register custom protocol for serving images
  protocol.handle('anyhark-image', async (request) => {
    // URL may be normalized with trailing slash: anyhark-image://filename/
    const raw = decodeURIComponent(request.url.replace('anyhark-image://', ''))
    const filename = raw.replace(/\/+$/, '')
    try {
      const filePath = await getImagePath(filename)
      return net.fetch(`file://${filePath}`)
    } catch (err) {
      console.error('[protocol] Image not found:', filename, err)
      return new Response('Image not found', { status: 404 })
    }
  })

  // Initialize services and register IPC handlers
  await registerAllIpcHandlers()

  createWindow()

  if (!is.dev) {
    autoUpdater.autoDownload = false
    autoUpdater.checkForUpdates().catch(() => {})
    autoUpdater.on('update-available', (info) => {
      dialog
        .showMessageBox({
          type: 'info',
          title: '发现新版本',
          message: `Anyhark ${info.version} 已发布，是否下载更新？`,
          buttons: ['下载更新', '稍后再说']
        })
        .then(({ response }) => {
          if (response === 0) autoUpdater.downloadUpdate()
        })
    })
    autoUpdater.on('update-downloaded', () => {
      dialog
        .showMessageBox({
          type: 'info',
          title: '更新就绪',
          message: '新版本已下载完成，重启应用即可完成更新。',
          buttons: ['立即重启', '稍后']
        })
        .then(({ response }) => {
          if (response === 0) autoUpdater.quitAndInstall()
        })
    })
  }

  app.on('activate', function () {
    // On macOS it's common to re-create a window in the app when the
    // dock icon is clicked and there are no other windows open.
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

app.on('will-quit', () => {
  stopApiServer()
})

import { app } from 'electron'
import path from 'path'
import fs from 'fs'

function getDataDir(): string {
  const dir = path.join(app.getPath('userData'), 'data')
  fs.mkdirSync(dir, { recursive: true })
  return dir
}

function getMemosDir(): string {
  const dir = path.join(getDataDir(), 'memos')
  fs.mkdirSync(dir, { recursive: true })
  return dir
}

function getImagesDir(): string {
  const dir = path.join(getDataDir(), 'images')
  fs.mkdirSync(dir, { recursive: true })
  return dir
}

function getIndexDir(): string {
  const dir = path.join(getDataDir(), '_index')
  fs.mkdirSync(dir, { recursive: true })
  return dir
}

function getConfigDir(): string {
  const dir = path.join(app.getPath('userData'), 'config')
  fs.mkdirSync(dir, { recursive: true })
  return dir
}

export { getDataDir, getMemosDir, getImagesDir, getIndexDir, getConfigDir }

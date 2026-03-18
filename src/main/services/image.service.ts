import path from 'path'
import fs from 'fs/promises'
import { ulid } from 'ulid'
import type { SaveImageRequest, SaveImageResponse } from '@shared/types'
import { getImagesDir } from '../utils/paths'
import { deleteFile } from './storage.service'

/**
 * Save a base64-encoded image to disk.
 * Images are organized in YYYY/MM subdirectories.
 */
export async function saveImage(req: SaveImageRequest): Promise<SaveImageResponse> {
  const now = new Date()
  const year = now.getFullYear().toString()
  const month = (now.getMonth() + 1).toString().padStart(2, '0')

  const ext = getExtensionFromMimeType(req.mimeType) || getExtensionFromFilename(req.filename)
  const filename = `img_${ulid()}.${ext}`

  const dir = path.join(getImagesDir(), year, month)
  await fs.mkdir(dir, { recursive: true })

  const filePath = path.join(dir, filename)

  // Decode base64 and write
  const buffer = Buffer.from(req.data, 'base64')
  await fs.writeFile(filePath, buffer)

  return {
    filename,
    filePath
  }
}

/**
 * Resolve the absolute path of an image by searching the images directory.
 */
export async function getImagePath(filename: string): Promise<string> {
  const imagesDir = getImagesDir()
  const found = await searchFile(imagesDir, filename)
  if (!found) {
    throw new Error(`Image not found: ${filename}`)
  }
  return found
}

/**
 * Delete an image file.
 */
export async function deleteImage(filename: string): Promise<void> {
  const filePath = await getImagePath(filename)
  await deleteFile(filePath)
}

/**
 * Recursively search for a file by name in a directory.
 */
async function searchFile(dir: string, filename: string): Promise<string | null> {
  let entries: string[]
  try {
    entries = await fs.readdir(dir)
  } catch {
    return null
  }

  for (const entry of entries) {
    const fullPath = path.join(dir, entry)
    const stat = await fs.stat(fullPath)
    if (stat.isDirectory()) {
      const result = await searchFile(fullPath, filename)
      if (result) return result
    } else if (entry === filename) {
      return fullPath
    }
  }

  return null
}

function getExtensionFromMimeType(mimeType: string): string | null {
  const map: Record<string, string> = {
    'image/png': 'png',
    'image/jpeg': 'jpg',
    'image/gif': 'gif',
    'image/webp': 'webp',
    'image/svg+xml': 'svg',
    'image/bmp': 'bmp'
  }
  return map[mimeType] ?? null
}

function getExtensionFromFilename(filename: string): string {
  const ext = path.extname(filename).slice(1).toLowerCase()
  return ext || 'png'
}

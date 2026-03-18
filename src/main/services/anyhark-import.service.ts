import path from 'path'
import fs from 'fs/promises'
import { ulid } from 'ulid'
import type { Memo, TipTapNode } from '@shared/types'
import type { AnyharkImportResult } from '@shared/types'
import { getMemosDir, getImagesDir } from '../utils/paths'
import { writeJSON, readJSON } from './storage.service'

/**
 * Import memos from an Anyhark JSON export directory.
 * Expects: memos/*.json + images/*
 */
export async function importFromAnyhark(dirPath: string): Promise<AnyharkImportResult> {
  const memosSourceDir = path.join(dirPath, 'memos')

  let memoFiles: string[]
  try {
    const entries = await fs.readdir(memosSourceDir)
    memoFiles = entries.filter((f) => f.endsWith('.json'))
  } catch {
    throw new Error('未找到 memos 文件夹，请确认选择了正确的 Anyhark 导出目录')
  }

  if (memoFiles.length === 0) {
    throw new Error('memos 文件夹中没有找到任何 JSON 文件')
  }

  const imagesSourceDir = path.join(dirPath, 'images')
  const memosDir = getMemosDir()

  let imported = 0
  let skipped = 0
  let imagesCopied = 0

  for (const file of memoFiles) {
    try {
      const memo = await readJSON<Memo>(path.join(memosSourceDir, file))

      const newId = ulid()
      const oldImages = memo.images || []

      const newImageFilenames: string[] = []
      const imageRenameMap = new Map<string, string>()

      for (const oldFilename of oldImages) {
        const ext = path.extname(oldFilename).slice(1) || 'jpg'
        const newFilename = `img_${ulid()}.${ext}`
        imageRenameMap.set(oldFilename, newFilename)

        const srcPath = path.join(imagesSourceDir, oldFilename)
        try {
          await fs.access(srcPath)
          const date = new Date(memo.createdAt)
          const year = date.getFullYear().toString()
          const month = (date.getMonth() + 1).toString().padStart(2, '0')
          const destDir = path.join(getImagesDir(), year, month)
          await fs.mkdir(destDir, { recursive: true })
          await fs.copyFile(srcPath, path.join(destDir, newFilename))
          newImageFilenames.push(newFilename)
          imagesCopied++
        } catch {
          // skip missing images
        }
      }

      if (imageRenameMap.size > 0) {
        updateImageReferences(memo.content.content, imageRenameMap)
      }

      const newMemo: Memo = {
        ...memo,
        id: newId,
        images: newImageFilenames,
        deletedAt: null,
        versions: memo.versions || []
      }

      await writeJSON(path.join(memosDir, `${newId}.json`), newMemo)
      imported++
    } catch {
      skipped++
    }
  }

  return {
    total: memoFiles.length,
    imported,
    skipped,
    images: imagesCopied
  }
}

function updateImageReferences(
  nodes: TipTapNode[] | undefined,
  renameMap: Map<string, string>
): void {
  if (!nodes) return
  for (const node of nodes) {
    if (node.type === 'image' && node.attrs?.src) {
      const src = String(node.attrs.src)
      const prefix = 'anyhark-image://'
      if (src.startsWith(prefix)) {
        const oldName = src.slice(prefix.length)
        const newName = renameMap.get(oldName)
        if (newName) {
          node.attrs.src = `${prefix}${newName}`
        }
      }
    }
    if (node.content) {
      updateImageReferences(node.content, renameMap)
    }
  }
}

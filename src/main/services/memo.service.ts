import path from 'path'
import { ulid } from 'ulid'
import type {
  Memo,
  MemoMeta,
  MemoVersion,
  MetadataIndex,
  CreateMemoRequest,
  UpdateMemoRequest
} from '@shared/types'
import { getMemosDir, getIndexDir } from '../utils/paths'
import { extractPlainText, extractTags, extractImageFilenames } from '../utils/tiptap-text'
import { readJSON, writeJSON, deleteFile, listFiles, fileExists } from './storage.service'

const MAX_VERSIONS = 10

/** In-memory metadata index */
let metadataIndex: MemoMeta[] = []

/**
 * Clear ALL memo data: delete every memo file and rebuild empty index.
 */
export async function clearAllMemos(): Promise<void> {
  const memosDir = getMemosDir()
  const files = await listFiles(memosDir)
  for (const file of files) {
    await deleteFile(path.join(memosDir, file))
  }
  metadataIndex = []
  await saveMetadataIndex()
}

/**
 * Initialize the memo service. Loads metadata index from disk,
 * or rebuilds it by scanning all memo files.
 */
export async function init(): Promise<void> {
  // Always rebuild to ensure derived fields (wordCount etc.) are up-to-date
  await rebuildMetadataIndex()
}

/**
 * Rebuild the metadata index by scanning all memo JSON files.
 */
export async function rebuildMetadataIndex(): Promise<void> {
  const memosDir = getMemosDir()
  const files = await listFiles(memosDir)
  const metas: MemoMeta[] = []
  const seenIds = new Set<string>()

  for (const file of files) {
    try {
      const memo = await readJSON<Memo>(path.join(memosDir, file))
      // Dedup: each file is named by ULID, skip if duplicate ID somehow exists
      if (seenIds.has(memo.id)) continue
      seenIds.add(memo.id)
      metas.push(buildMemoMeta(memo))
    } catch {
      // Skip corrupted files
    }
  }

  metadataIndex = metas
  await saveMetadataIndex()
}

/**
 * Persist the metadata index to disk.
 */
async function saveMetadataIndex(): Promise<void> {
  const indexPath = path.join(getIndexDir(), 'metadata.json')
  const data: MetadataIndex = {
    memos: metadataIndex,
    updatedAt: new Date().toISOString()
  }
  await writeJSON(indexPath, data)
}

/**
 * Build lightweight MemoMeta from a full Memo object.
 */
export function buildMemoMeta(memo: Memo): MemoMeta {
  const preview = memo.plainText.slice(0, 100)
  // For Chinese text, count characters (not words split by whitespace)
  const wordCount = memo.plainText ? memo.plainText.replace(/\s+/g, '').length : 0

  return {
    id: memo.id,
    tags: memo.tags,
    images: memo.images,
    plainTextPreview: preview,
    wordCount,
    createdAt: memo.createdAt,
    updatedAt: memo.updatedAt,
    deletedAt: memo.deletedAt
  }
}

/**
 * Create a new memo.
 */
export async function createMemo(req: CreateMemoRequest): Promise<Memo> {
  const now = new Date().toISOString()
  const id = ulid()

  const memo: Memo = {
    id,
    content: req.content,
    plainText: extractPlainText(req.content),
    tags: extractTags(req.content),
    images: req.images ?? extractImageFilenames(req.content),
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
    versions: []
  }

  const filePath = path.join(getMemosDir(), `${id}.json`)
  await writeJSON(filePath, memo)

  const meta = buildMemoMeta(memo)
  metadataIndex.push(meta)
  await saveMetadataIndex()

  return memo
}

/**
 * Read a memo by ID.
 */
export async function readMemo(id: string): Promise<Memo> {
  const filePath = path.join(getMemosDir(), `${id}.json`)
  return readJSON<Memo>(filePath)
}

/**
 * Update an existing memo. Pushes current content to version history.
 */
export async function updateMemo(req: UpdateMemoRequest): Promise<Memo> {
  const filePath = path.join(getMemosDir(), `${req.id}.json`)
  const existing = await readJSON<Memo>(filePath)

  // Push current content to versions
  const version: MemoVersion = {
    versionId: ulid(),
    content: existing.content,
    plainText: existing.plainText,
    tags: existing.tags,
    savedAt: existing.updatedAt
  }

  const versions = [version, ...existing.versions].slice(0, MAX_VERSIONS)

  const now = new Date().toISOString()
  const updated: Memo = {
    ...existing,
    content: req.content,
    plainText: extractPlainText(req.content),
    tags: extractTags(req.content),
    images: req.images ?? extractImageFilenames(req.content),
    updatedAt: now,
    versions
  }

  await writeJSON(filePath, updated)

  // Update metadata index
  const idx = metadataIndex.findIndex((m) => m.id === req.id)
  const meta = buildMemoMeta(updated)
  if (idx >= 0) {
    metadataIndex[idx] = meta
  } else {
    metadataIndex.push(meta)
  }
  await saveMetadataIndex()

  return updated
}

/**
 * Soft delete a memo by setting deletedAt timestamp.
 */
export async function softDeleteMemo(id: string): Promise<void> {
  const filePath = path.join(getMemosDir(), `${id}.json`)
  const memo = await readJSON<Memo>(filePath)
  memo.deletedAt = new Date().toISOString()
  await writeJSON(filePath, memo)

  const idx = metadataIndex.findIndex((m) => m.id === id)
  if (idx >= 0) {
    metadataIndex[idx].deletedAt = memo.deletedAt
  }
  await saveMetadataIndex()
}

/**
 * Restore a soft-deleted memo.
 */
export async function restoreMemo(id: string): Promise<void> {
  const filePath = path.join(getMemosDir(), `${id}.json`)
  const memo = await readJSON<Memo>(filePath)
  memo.deletedAt = null
  await writeJSON(filePath, memo)

  const idx = metadataIndex.findIndex((m) => m.id === id)
  if (idx >= 0) {
    metadataIndex[idx].deletedAt = null
  }
  await saveMetadataIndex()
}

/**
 * Permanently delete a memo file.
 */
export async function purgeMemo(id: string): Promise<void> {
  const filePath = path.join(getMemosDir(), `${id}.json`)
  await deleteFile(filePath)

  metadataIndex = metadataIndex.filter((m) => m.id !== id)
  await saveMetadataIndex()
}

/**
 * Return in-memory metadata, excluding soft-deleted memos.
 */
export function listMemoMeta(): MemoMeta[] {
  return metadataIndex.filter((m) => m.deletedAt === null)
}

/**
 * Return only soft-deleted memo metadata.
 */
export function listDeletedMeta(): MemoMeta[] {
  return metadataIndex.filter((m) => m.deletedAt !== null)
}

/**
 * Get version history for a memo.
 */
export async function getVersions(id: string): Promise<MemoVersion[]> {
  const memo = await readMemo(id)
  return memo.versions
}

/**
 * Restore a specific version of a memo.
 */
export async function restoreVersion(memoId: string, versionId: string): Promise<Memo> {
  const memo = await readMemo(memoId)
  const version = memo.versions.find((v) => v.versionId === versionId)
  if (!version) {
    throw new Error(`Version ${versionId} not found for memo ${memoId}`)
  }

  // Treat this as an update with the version's content
  const req: UpdateMemoRequest = {
    id: memoId,
    content: version.content,
    plainText: version.plainText,
    tags: version.tags,
    images: extractImageFilenames(version.content)
  }

  return updateMemo(req)
}

/**
 * Delete a specific version from a memo's history.
 */
export async function deleteVersion(memoId: string, versionId: string): Promise<void> {
  const filePath = path.join(getMemosDir(), `${memoId}.json`)
  const memo = await readJSON<Memo>(filePath)
  memo.versions = memo.versions.filter((v) => v.versionId !== versionId)
  await writeJSON(filePath, memo)
}

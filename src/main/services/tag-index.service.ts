import path from 'path'
import type { TagIndex, MemoMeta } from '@shared/types'
import { getIndexDir } from '../utils/paths'
import { readJSON, writeJSON, fileExists } from './storage.service'

/** In-memory tag index: tag path -> memo IDs */
let tagIndex: TagIndex = {
  tags: {},
  updatedAt: new Date().toISOString()
}

/**
 * Initialize the tag index service. Loads from disk or rebuilds.
 */
export async function init(memos?: MemoMeta[]): Promise<void> {
  // Always rebuild to ensure parent tag paths are expanded correctly
  if (memos) {
    rebuildTagIndex(memos)
    await save()
  }
}

/**
 * Expand tag paths to include all ancestor paths.
 * "a/b/c" → ["a", "a/b", "a/b/c"]
 */
function expandTagPaths(tags: string[]): string[] {
  const result = new Set<string>()
  for (const tag of tags) {
    const parts = tag.split('/')
    for (let i = 1; i <= parts.length; i++) {
      result.add(parts.slice(0, i).join('/'))
    }
  }
  return [...result]
}

/**
 * Rebuild the tag index from memo metadata.
 */
export function rebuildTagIndex(memos: MemoMeta[]): void {
  const tags: Record<string, string[]> = {}

  for (const memo of memos) {
    if (memo.deletedAt !== null) continue
    const expanded = expandTagPaths(memo.tags)
    for (const tag of expanded) {
      if (!tags[tag]) {
        tags[tag] = []
      }
      if (!tags[tag].includes(memo.id)) {
        tags[tag].push(memo.id)
      }
    }
  }

  tagIndex = {
    tags,
    updatedAt: new Date().toISOString()
  }
}

/**
 * Return the current tag index.
 */
export function getTagIndex(): TagIndex {
  return tagIndex
}

/**
 * Update tags for a memo by diffing old and new tag arrays.
 */
export function updateTagsForMemo(memoId: string, oldTags: string[], newTags: string[]): void {
  const expandedOld = expandTagPaths(oldTags)
  const expandedNew = expandTagPaths(newTags)

  // Remove memo from paths no longer present
  for (const tag of expandedOld) {
    if (!expandedNew.includes(tag) && tagIndex.tags[tag]) {
      tagIndex.tags[tag] = tagIndex.tags[tag].filter((id) => id !== memoId)
      if (tagIndex.tags[tag].length === 0) {
        delete tagIndex.tags[tag]
      }
    }
  }

  // Add memo to new paths
  for (const tag of expandedNew) {
    if (!tagIndex.tags[tag]) {
      tagIndex.tags[tag] = []
    }
    if (!tagIndex.tags[tag].includes(memoId)) {
      tagIndex.tags[tag].push(memoId)
    }
  }

  tagIndex.updatedAt = new Date().toISOString()
}

/**
 * Rename a tag path. Updates all entries in the index.
 */
export async function renameTag(oldPath: string, newPath: string): Promise<void> {
  const memoIds = tagIndex.tags[oldPath] ?? []
  delete tagIndex.tags[oldPath]

  if (!tagIndex.tags[newPath]) {
    tagIndex.tags[newPath] = []
  }

  for (const id of memoIds) {
    if (!tagIndex.tags[newPath].includes(id)) {
      tagIndex.tags[newPath].push(id)
    }
  }

  // Also rename child tags (prefix match)
  const oldPrefix = oldPath + '/'
  const keysToRename = Object.keys(tagIndex.tags).filter((k) => k.startsWith(oldPrefix))
  for (const key of keysToRename) {
    const newKey = newPath + '/' + key.slice(oldPrefix.length)
    const ids = tagIndex.tags[key]
    delete tagIndex.tags[key]

    if (!tagIndex.tags[newKey]) {
      tagIndex.tags[newKey] = []
    }
    for (const id of ids) {
      if (!tagIndex.tags[newKey].includes(id)) {
        tagIndex.tags[newKey].push(id)
      }
    }
  }

  tagIndex.updatedAt = new Date().toISOString()
  await save()
}

/**
 * Delete a tag from the index.
 */
export async function deleteTag(tagPath: string): Promise<void> {
  delete tagIndex.tags[tagPath]

  // Also delete child tags
  const prefix = tagPath + '/'
  for (const key of Object.keys(tagIndex.tags)) {
    if (key.startsWith(prefix)) {
      delete tagIndex.tags[key]
    }
  }

  tagIndex.updatedAt = new Date().toISOString()
  await save()
}

/**
 * Persist the tag index to disk.
 */
export async function save(): Promise<void> {
  const indexPath = path.join(getIndexDir(), 'tags.json')
  await writeJSON(indexPath, tagIndex)
}

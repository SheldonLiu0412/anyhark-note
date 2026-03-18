import type { SearchRequest, SearchResult, MemoMeta } from '@shared/types'

/**
 * Search memos by keyword, tags, and image presence.
 * - keyword: case-insensitive substring match on plainTextPreview
 * - tags: memo must contain ALL specified tags (AND logic), prefix match
 * - hasImage: filter to memos with images
 * - includeDeleted: whether to include soft-deleted memos
 */
export function search(req: SearchRequest, memos: MemoMeta[]): SearchResult {
  let filtered = memos

  // Filter deleted unless includeDeleted
  if (!req.includeDeleted) {
    filtered = filtered.filter((m) => m.deletedAt === null)
  }

  // Keyword filter
  if (req.keyword && req.keyword.trim().length > 0) {
    const kw = req.keyword.toLowerCase()
    filtered = filtered.filter((m) => m.plainTextPreview.toLowerCase().includes(kw))
  }

  // Tag filter (AND logic with prefix match)
  if (req.tags && req.tags.length > 0) {
    filtered = filtered.filter((m) =>
      req.tags!.every((searchTag) =>
        m.tags.some((memoTag) => memoTag === searchTag || memoTag.startsWith(searchTag + '/'))
      )
    )
  }

  // Image filter
  if (req.hasImage) {
    filtered = filtered.filter((m) => m.images.length > 0)
  }

  // Dedup by memo ID (safety net for duplicate data on disk)
  const seen = new Set<string>()
  filtered = filtered.filter((m) => {
    if (seen.has(m.id)) return false
    seen.add(m.id)
    return true
  })

  return {
    memos: filtered,
    total: filtered.length
  }
}

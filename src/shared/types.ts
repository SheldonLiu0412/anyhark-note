// ============================================================
// Core Data Types - Anyhark
// ============================================================

/** TipTap JSON document structure */
export interface TipTapNode {
  type: string
  attrs?: Record<string, unknown>
  content?: TipTapNode[]
  marks?: TipTapMark[]
  text?: string
}

export interface TipTapMark {
  type: string
  attrs?: Record<string, unknown>
}

export interface TipTapDocument {
  type: 'doc'
  content: TipTapNode[]
}

/** Unique identifier for a memo - ULID format */
export type MemoId = string

/** ISO 8601 timestamp string */
export type Timestamp = string

/** A historical version snapshot */
export interface MemoVersion {
  versionId: string
  content: TipTapDocument
  plainText: string
  tags: string[]
  savedAt: Timestamp
}

/** A single memo (card-style note) - the shape of each JSON file on disk */
export interface Memo {
  id: MemoId
  content: TipTapDocument
  plainText: string
  tags: string[]
  images: string[]
  createdAt: Timestamp
  updatedAt: Timestamp
  deletedAt: Timestamp | null
  versions: MemoVersion[]
}

/** Lightweight memo metadata for the in-memory index */
export interface MemoMeta {
  id: MemoId
  tags: string[]
  images: string[]
  plainTextPreview: string
  wordCount: number
  createdAt: Timestamp
  updatedAt: Timestamp
  deletedAt: Timestamp | null
}

/** Tag index file shape */
export interface TagIndex {
  tags: Record<string, string[]>
  updatedAt: Timestamp
}

/** Metadata index file shape */
export interface MetadataIndex {
  memos: MemoMeta[]
  updatedAt: Timestamp
}

// ============================================================
// IPC Request/Response Types
// ============================================================

export interface CreateMemoRequest {
  content: TipTapDocument
  plainText: string
  tags: string[]
  images: string[]
}

export interface UpdateMemoRequest {
  id: MemoId
  content: TipTapDocument
  plainText: string
  tags: string[]
  images: string[]
}

export interface SearchRequest {
  keyword?: string
  tags?: string[]
  hasImage?: boolean
  includeDeleted?: boolean
}

export interface SearchResult {
  memos: MemoMeta[]
  total: number
}

export interface SaveImageRequest {
  data: string
  filename: string
  mimeType: string
}

export interface SaveImageResponse {
  filename: string
  filePath: string
}

export interface FlomoImportResult {
  total: number
  imported: number
  skipped: number
  images: number
}

export interface AnyharkImportResult {
  total: number
  imported: number
  skipped: number
  images: number
}

export interface AppleNotesImportResult {
  total: number
  imported: number
  skipped: number
  images: number
  hashConverted: number
}

// ============================================================
// ElectronAPI shape exposed to renderer
// ============================================================

export interface ElectronAPI {
  memo: {
    create(req: CreateMemoRequest): Promise<Memo>
    read(id: string): Promise<Memo>
    update(req: UpdateMemoRequest): Promise<Memo>
    delete(id: string): Promise<void>
    list(): Promise<MemoMeta[]>
    getVersions(id: string): Promise<MemoVersion[]>
    restoreVersion(memoId: string, versionId: string): Promise<Memo>
    deleteVersion(memoId: string, versionId: string): Promise<void>
    clearAll(): Promise<void>
  }
  tag: {
    list(): Promise<TagIndex>
    rename(oldPath: string, newPath: string): Promise<void>
    delete(tagPath: string): Promise<void>
  }
  search: {
    query(req: SearchRequest): Promise<SearchResult>
  }
  image: {
    save(req: SaveImageRequest): Promise<SaveImageResponse>
    getPath(filename: string): Promise<string>
  }
  recycle: {
    list(): Promise<MemoMeta[]>
    restore(id: string): Promise<void>
    purge(id: string): Promise<void>
    empty(): Promise<void>
  }
  import: {
    selectDirectory(): Promise<string | null>
    flomo(dirPath: string): Promise<FlomoImportResult>
    anyhark(dirPath: string): Promise<AnyharkImportResult>
    appleNotes(): Promise<AppleNotesImportResult>
  }
  export: {
    csv(): Promise<{ count: number; path: string } | null>
    json(): Promise<{ count: number; path: string } | null>
  }
  onDataChanged(callback: () => void): () => void
}

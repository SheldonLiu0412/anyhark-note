import { create } from 'zustand'
import type { MemoMeta, Memo, CreateMemoRequest, UpdateMemoRequest, TipTapDocument, TipTapNode } from '@shared/types'
import { api } from '@renderer/lib/api'
import { useTagStore } from './tag.store'

function countWordsExcludingTags(doc: TipTapDocument): number {
  const parts: string[] = []
  function walk(nodes: TipTapNode[]): void {
    for (const node of nodes) {
      if (node.type === 'tag') continue
      if (node.text) parts.push(node.text.replace(/#[^\s#]+/g, ''))
      if (node.content) walk(node.content)
    }
  }
  walk(doc.content)
  return parts.join('').replace(/\s+/g, '').length
}

interface MemoState {
  memos: MemoMeta[]
  currentMemo: Memo | null
  isLoading: boolean
  editingMemoId: string | null
  /** Cache of full memo content to avoid flicker on newly created/updated memos */
  contentCache: Map<string, Memo>
  loadMemos: () => Promise<void>
  createMemo: (req: CreateMemoRequest) => Promise<Memo>
  updateMemo: (req: UpdateMemoRequest) => Promise<Memo>
  deleteMemo: (id: string) => Promise<void>
  loadFullMemo: (id: string) => Promise<Memo>
  refreshMemo: (id: string) => Promise<Memo>
  setEditingMemo: (id: string | null) => void
}

export const useMemoStore = create<MemoState>((set, get) => ({
  memos: [],
  currentMemo: null,
  isLoading: false,
  editingMemoId: null,
  contentCache: new Map(),

  loadMemos: async () => {
    const state = useMemoStore.getState()
    if (state.memos.length === 0) {
      set({ isLoading: true })
    }
    try {
      const memos = await api.memo.list()
      // Clear content cache on full reload to avoid stale data
      set({ memos, contentCache: new Map() })
    } finally {
      set({ isLoading: false })
    }
  },

  createMemo: async (req) => {
    const memo = await api.memo.create(req)
    const meta: MemoMeta = {
      id: memo.id,
      tags: memo.tags,
      images: memo.images,
      plainTextPreview: memo.plainText.slice(0, 100),
      wordCount: countWordsExcludingTags(memo.content),
      createdAt: memo.createdAt,
      updatedAt: memo.updatedAt,
      deletedAt: memo.deletedAt
    }
    const cache = new Map(get().contentCache)
    cache.set(memo.id, memo)
    set((state) => ({ memos: [meta, ...state.memos], contentCache: cache }))
    useTagStore.getState().loadTags()
    return memo
  },

  updateMemo: async (req) => {
    const memo = await api.memo.update(req)
    const meta: MemoMeta = {
      id: memo.id,
      tags: memo.tags,
      images: memo.images,
      plainTextPreview: memo.plainText.slice(0, 100),
      wordCount: countWordsExcludingTags(memo.content),
      createdAt: memo.createdAt,
      updatedAt: memo.updatedAt,
      deletedAt: memo.deletedAt
    }
    const cache = new Map(get().contentCache)
    cache.set(memo.id, memo)
    set((state) => ({
      memos: state.memos.map((m) => (m.id === memo.id ? meta : m)),
      currentMemo: state.currentMemo?.id === memo.id ? memo : state.currentMemo,
      contentCache: cache
    }))
    useTagStore.getState().loadTags()
    return memo
  },

  deleteMemo: async (id) => {
    await api.memo.delete(id)
    const cache = new Map(get().contentCache)
    cache.delete(id)
    set((state) => ({
      memos: state.memos.filter((m) => m.id !== id),
      currentMemo: state.currentMemo?.id === id ? null : state.currentMemo,
      editingMemoId: state.editingMemoId === id ? null : state.editingMemoId,
      contentCache: cache
    }))
    useTagStore.getState().loadTags()
  },

  loadFullMemo: async (id) => {
    // Return from cache if available (avoids flicker for new/updated memos)
    const cached = get().contentCache.get(id)
    if (cached) {
      set({ currentMemo: cached })
      return cached
    }
    const memo = await api.memo.read(id)
    // Cache the loaded memo to prevent re-fetching on re-renders
    const cache = new Map(get().contentCache)
    cache.set(id, memo)
    set({ currentMemo: memo, contentCache: cache })
    return memo
  },

  refreshMemo: async (id) => {
    const memo = await api.memo.read(id)
    const meta: MemoMeta = {
      id: memo.id,
      tags: memo.tags,
      images: memo.images,
      plainTextPreview: memo.plainText.slice(0, 100),
      wordCount: countWordsExcludingTags(memo.content),
      createdAt: memo.createdAt,
      updatedAt: memo.updatedAt,
      deletedAt: memo.deletedAt
    }
    const cache = new Map(get().contentCache)
    cache.set(memo.id, memo)
    set((state) => ({
      memos: state.memos.map((m) => (m.id === memo.id ? meta : m)),
      contentCache: cache
    }))
    return memo
  },

  setEditingMemo: (id) => {
    set({ editingMemoId: id })
  }
}))

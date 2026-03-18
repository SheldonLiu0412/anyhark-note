import { create } from 'zustand'
import type { TagIndex } from '@shared/types'
import { api } from '@renderer/lib/api'

interface TagState {
  tagIndex: TagIndex | null
  selectedTag: string | null
  expandedTags: Set<string>
  loadTags: () => Promise<void>
  selectTag: (tagPath: string | null) => void
  toggleTagExpanded: (tagPath: string) => void
  renameTag: (oldPath: string, newPath: string) => Promise<void>
  deleteTag: (tagPath: string) => Promise<void>
}

export const useTagStore = create<TagState>((set, get) => ({
  tagIndex: null,
  selectedTag: null,
  expandedTags: new Set<string>(),

  loadTags: async () => {
    const tagIndex = await api.tag.list()
    set({ tagIndex })
  },

  selectTag: (tagPath) => {
    set({ selectedTag: tagPath })
  },

  toggleTagExpanded: (tagPath) => {
    set((state) => {
      const next = new Set(state.expandedTags)
      if (next.has(tagPath)) {
        next.delete(tagPath)
      } else {
        next.add(tagPath)
      }
      return { expandedTags: next }
    })
  },

  renameTag: async (oldPath, newPath) => {
    await api.tag.rename(oldPath, newPath)
    await get().loadTags()
  },

  deleteTag: async (tagPath) => {
    await api.tag.delete(tagPath)
    set((state) => ({
      selectedTag: state.selectedTag === tagPath ? null : state.selectedTag
    }))
    await get().loadTags()
  }
}))

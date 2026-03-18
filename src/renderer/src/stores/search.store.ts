import { create } from 'zustand'
import type { MemoMeta } from '@shared/types'
import { api } from '@renderer/lib/api'

interface SearchState {
  searchKeyword: string
  searchResults: MemoMeta[] | null
  hasImageFilter: boolean
  isSearching: boolean
  isSearchDialogOpen: boolean
  setSearchKeyword: (keyword: string) => void
  executeSearch: () => Promise<void>
  toggleImageFilter: () => void
  clearSearch: () => void
  openSearchDialog: () => void
  closeSearchDialog: () => void
}

export const useSearchStore = create<SearchState>((set, get) => ({
  searchKeyword: '',
  searchResults: null,
  hasImageFilter: false,
  isSearching: false,
  isSearchDialogOpen: false,

  setSearchKeyword: (keyword) => {
    set({ searchKeyword: keyword })
  },

  executeSearch: async () => {
    const { searchKeyword, hasImageFilter } = get()
    set({ isSearching: true })
    try {
      const result = await api.search.query({
        keyword: searchKeyword || undefined,
        hasImage: hasImageFilter || undefined
      })
      set({ searchResults: result.memos })
    } finally {
      set({ isSearching: false })
    }
  },

  toggleImageFilter: () => {
    set((state) => ({ hasImageFilter: !state.hasImageFilter }))
  },

  clearSearch: () => {
    set({ searchKeyword: '', searchResults: null, hasImageFilter: false })
  },

  openSearchDialog: () => {
    set({ isSearchDialogOpen: true })
  },

  closeSearchDialog: () => {
    set({ isSearchDialogOpen: false })
    get().clearSearch()
  }
}))

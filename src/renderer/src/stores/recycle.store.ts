import { create } from 'zustand'
import type { MemoMeta } from '@shared/types'
import { api } from '@renderer/lib/api'
import { useMemoStore } from './memo.store'

interface RecycleState {
  deletedMemos: MemoMeta[]
  isLoading: boolean
  loadDeletedMemos: () => Promise<void>
  restoreMemo: (id: string) => Promise<void>
  purgeMemo: (id: string) => Promise<void>
  emptyRecycleBin: () => Promise<void>
}

export const useRecycleStore = create<RecycleState>((set, get) => ({
  deletedMemos: [],
  isLoading: false,

  loadDeletedMemos: async () => {
    set({ isLoading: true })
    try {
      const deletedMemos = await api.recycle.list()
      set({ deletedMemos })
    } finally {
      set({ isLoading: false })
    }
  },

  restoreMemo: async (id) => {
    await api.recycle.restore(id)
    await get().loadDeletedMemos()
    await useMemoStore.getState().loadMemos()
  },

  purgeMemo: async (id) => {
    await api.recycle.purge(id)
    await get().loadDeletedMemos()
  },

  emptyRecycleBin: async () => {
    await api.recycle.empty()
    set({ deletedMemos: [] })
    await useMemoStore.getState().loadMemos()
  }
}))

import { create } from 'zustand'

interface UIState {
  sidebarWidth: number
  currentView: 'all' | 'tag' | 'recycle' | 'search'
  isHistoryDialogOpen: boolean
  historyMemoId: string | null
  scrollToMemoId: string | null
  setSidebarWidth: (width: number) => void
  setCurrentView: (view: UIState['currentView']) => void
  openHistoryDialog: (memoId: string) => void
  closeHistoryDialog: () => void
  setScrollToMemoId: (id: string | null) => void
}

export const useUIStore = create<UIState>((set) => ({
  sidebarWidth: 260,
  currentView: 'all',
  isHistoryDialogOpen: false,
  historyMemoId: null,
  scrollToMemoId: null,

  setSidebarWidth: (width) => set({ sidebarWidth: width }),
  setCurrentView: (view) => set({ currentView: view }),
  openHistoryDialog: (memoId) => set({ isHistoryDialogOpen: true, historyMemoId: memoId }),
  closeHistoryDialog: () => set({ isHistoryDialogOpen: false, historyMemoId: null }),
  setScrollToMemoId: (id) => set({ scrollToMemoId: id })
}))

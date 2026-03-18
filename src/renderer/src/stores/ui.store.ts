import { create } from 'zustand'

export type SettingId = 'import' | 'export' | 'openclaw' | 'reset' | 'about'

interface UIState {
  sidebarWidth: number
  noteListWidth: number
  currentView: 'all' | 'tag' | 'recycle' | 'search' | 'settings'
  selectedMemoId: string | null
  selectedSettingId: SettingId
  isHistoryDialogOpen: boolean
  historyMemoId: string | null
  scrollToMemoId: string | null
  setSidebarWidth: (width: number) => void
  setNoteListWidth: (width: number) => void
  setCurrentView: (view: UIState['currentView']) => void
  setSelectedMemoId: (id: string | null) => void
  setSelectedSettingId: (id: SettingId) => void
  openHistoryDialog: (memoId: string) => void
  closeHistoryDialog: () => void
  setScrollToMemoId: (id: string | null) => void
}

export const useUIStore = create<UIState>((set) => ({
  sidebarWidth: 220,
  noteListWidth: 280,
  currentView: 'all',
  selectedMemoId: null,
  selectedSettingId: 'import',
  isHistoryDialogOpen: false,
  historyMemoId: null,
  scrollToMemoId: null,

  setSidebarWidth: (width) => set({ sidebarWidth: width }),
  setNoteListWidth: (width) => set({ noteListWidth: width }),
  setCurrentView: (view) => set({ currentView: view }),
  setSelectedMemoId: (id) => set({ selectedMemoId: id }),
  setSelectedSettingId: (id) => set({ selectedSettingId: id }),
  openHistoryDialog: (memoId) => set({ isHistoryDialogOpen: true, historyMemoId: memoId }),
  closeHistoryDialog: () => set({ isHistoryDialogOpen: false, historyMemoId: null }),
  setScrollToMemoId: (id) => set({ scrollToMemoId: id })
}))

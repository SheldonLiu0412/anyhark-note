import { useEffect, useCallback } from 'react'
import { AppLayout } from './components/layout/AppLayout'
import { MemoHistory } from './components/memo/MemoHistory'
import { useMemoStore } from './stores/memo.store'
import { useTagStore } from './stores/tag.store'
import { useSearchStore } from './stores/search.store'
import { useUIStore } from './stores/ui.store'
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts'
import { api } from './lib/api'

function App(): React.JSX.Element {
  const loadMemos = useMemoStore((s) => s.loadMemos)
  const memos = useMemoStore((s) => s.memos)
  const loadTags = useTagStore((s) => s.loadTags)
  const isSearchDialogOpen = useSearchStore((s) => s.isSearchDialogOpen)
  const openSearchDialog = useSearchStore((s) => s.openSearchDialog)
  const closeSearchDialog = useSearchStore((s) => s.closeSearchDialog)
  const setScrollToMemoId = useUIStore((s) => s.setScrollToMemoId)
  const selectedMemoId = useUIStore((s) => s.selectedMemoId)
  const setSelectedMemoId = useUIStore((s) => s.setSelectedMemoId)

  useEffect(() => {
    loadMemos()
    loadTags()
  }, [loadMemos, loadTags])

  // Auto-select the first memo when none is selected
  useEffect(() => {
    if (!selectedMemoId && memos.length > 0) {
      setSelectedMemoId(memos[0].id)
    }
  }, [selectedMemoId, memos, setSelectedMemoId])

  useEffect(() => {
    return api.onDataChanged(() => {
      loadMemos()
      loadTags()
    })
  }, [loadMemos, loadTags])

  useEffect(() => {
    const handler = (e: Event): void => {
      const detail = (e as CustomEvent).detail
      if (detail?.memoId) {
        setScrollToMemoId(detail.memoId)
        setSelectedMemoId(detail.memoId)
      }
    }
    window.addEventListener('anyhark:scroll-to-memo', handler)
    return () => window.removeEventListener('anyhark:scroll-to-memo', handler)
  }, [setScrollToMemoId, setSelectedMemoId])

  const handleNewMemo = useCallback(async () => {
    const memo = await useMemoStore.getState().createMemo({
      content: { type: 'doc', content: [{ type: 'paragraph' }] },
      plainText: '',
      tags: [],
      images: []
    })
    setSelectedMemoId(memo.id)
  }, [setSelectedMemoId])

  const handleToggleSearch = useCallback(() => {
    if (isSearchDialogOpen) closeSearchDialog()
    else openSearchDialog()
  }, [isSearchDialogOpen, openSearchDialog, closeSearchDialog])

  useKeyboardShortcuts({
    onNewMemo: handleNewMemo,
    onSearch: handleToggleSearch
  })

  return (
    <>
      <AppLayout />
      <MemoHistory />
    </>
  )
}

export default App

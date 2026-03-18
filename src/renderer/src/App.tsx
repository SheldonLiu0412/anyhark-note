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
  const loadTags = useTagStore((s) => s.loadTags)
  const isSearchDialogOpen = useSearchStore((s) => s.isSearchDialogOpen)
  const openSearchDialog = useSearchStore((s) => s.openSearchDialog)
  const closeSearchDialog = useSearchStore((s) => s.closeSearchDialog)
  const setScrollToMemoId = useUIStore((s) => s.setScrollToMemoId)

  useEffect(() => {
    loadMemos()
    loadTags()
  }, [loadMemos, loadTags])

  useEffect(() => {
    return api.onDataChanged(() => {
      loadMemos()
      loadTags()
    })
  }, [loadMemos, loadTags])

  useEffect(() => {
    const handler = (e: Event): void => {
      const detail = (e as CustomEvent).detail
      if (detail?.memoId) setScrollToMemoId(detail.memoId)
    }
    window.addEventListener('anyhark:scroll-to-memo', handler)
    return () => window.removeEventListener('anyhark:scroll-to-memo', handler)
  }, [setScrollToMemoId])

  const handleNewMemo = useCallback(() => {
    const editor = document.querySelector('.tiptap-editor .ProseMirror') as HTMLElement
    editor?.focus()
  }, [])

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

import { useEffect, useCallback } from 'react'
import { AppLayout } from './components/layout/AppLayout'
import { MemoHistory } from './components/memo/MemoHistory'
import { useMemoStore } from './stores/memo.store'
import { useTagStore } from './stores/tag.store'
import { useSearchStore } from './stores/search.store'
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts'

function App(): React.JSX.Element {
  const loadMemos = useMemoStore((s) => s.loadMemos)
  const loadTags = useTagStore((s) => s.loadTags)
  const openSearchDialog = useSearchStore((s) => s.openSearchDialog)

  useEffect(() => {
    loadMemos()
    loadTags()
  }, [loadMemos, loadTags])

  const handleNewMemo = useCallback(() => {
    const editor = document.querySelector('.tiptap-editor .ProseMirror') as HTMLElement
    editor?.focus()
  }, [])

  useKeyboardShortcuts({
    onNewMemo: handleNewMemo,
    onSearch: openSearchDialog
  })

  return (
    <>
      <AppLayout />
      <MemoHistory />
    </>
  )
}

export default App

import { useEffect } from 'react'

interface ShortcutHandlers {
  onNewMemo?: () => void
  onSearch?: () => void
  onSaveMemo?: () => void
}

export function useKeyboardShortcuts(handlers: ShortcutHandlers): void {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent): void => {
      const isMod = e.metaKey || e.ctrlKey

      // Cmd+N: New memo (focus editor)
      if (isMod && e.key === 'n') {
        e.preventDefault()
        handlers.onNewMemo?.()
      }

      // Cmd+K: Open search
      if (isMod && e.key === 'k') {
        e.preventDefault()
        handlers.onSearch?.()
      }

      // Cmd+Enter: Save memo
      if (isMod && e.key === 'Enter') {
        e.preventDefault()
        handlers.onSaveMemo?.()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [handlers])
}

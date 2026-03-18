import { useEffect, useRef, useCallback } from 'react'
import { Search, X } from 'lucide-react'
import { useSearchStore } from '@renderer/stores/search.store'
import { useUIStore } from '@renderer/stores/ui.store'
import { formatDistanceToNow } from 'date-fns'
import { zhCN } from 'date-fns/locale'

export function SearchDialog(): React.JSX.Element {
  const inputRef = useRef<HTMLInputElement>(null)
  const searchKeyword = useSearchStore((s) => s.searchKeyword)
  const setSearchKeyword = useSearchStore((s) => s.setSearchKeyword)
  const executeSearch = useSearchStore((s) => s.executeSearch)
  const searchResults = useSearchStore((s) => s.searchResults)
  const isSearching = useSearchStore((s) => s.isSearching)
  const closeSearchDialog = useSearchStore((s) => s.closeSearchDialog)
  const setCurrentView = useUIStore((s) => s.setCurrentView)
  const setSelectedMemoId = useUIStore((s) => s.setSelectedMemoId)
  const setScrollToMemoId = useUIStore((s) => s.setScrollToMemoId)

  const debounceRef = useRef<ReturnType<typeof setTimeout>>()

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') closeSearchDialog()
    }
    window.addEventListener('keydown', handleEscape)
    return () => window.removeEventListener('keydown', handleEscape)
  }, [closeSearchDialog])

  const handleInputChange = useCallback(
    (value: string) => {
      setSearchKeyword(value)
      clearTimeout(debounceRef.current)
      if (value.trim()) {
        debounceRef.current = setTimeout(() => executeSearch(), 300)
      }
    },
    [setSearchKeyword, executeSearch]
  )

  const handleResultClick = (memoId: string): void => {
    closeSearchDialog()
    setCurrentView('all')
    setSelectedMemoId(memoId)
    setScrollToMemoId(memoId)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-[15vh]">
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/30 backdrop-blur-sm" onClick={closeSearchDialog} />

      {/* Dialog */}
      <div className="relative w-full max-w-lg bg-popover border border-border rounded-xl shadow-2xl overflow-hidden">
        {/* Search input */}
        <div className="flex items-center gap-3 px-4 h-12 border-b border-border/60">
          <Search size={16} className="text-muted-foreground/50 flex-shrink-0" />
          <input
            ref={inputRef}
            type="text"
            placeholder="搜索笔记..."
            value={searchKeyword}
            onChange={(e) => handleInputChange(e.target.value)}
            className="flex-1 bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground/40"
          />
          {searchKeyword && (
            <button
              onClick={() => { setSearchKeyword(''); }}
              className="text-muted-foreground/40 hover:text-muted-foreground transition-colors"
            >
              <X size={14} />
            </button>
          )}
          <kbd className="text-[10px] text-muted-foreground/30 bg-muted/50 px-1.5 py-0.5 rounded border border-border/50">
            ⌘K
          </kbd>
          <kbd className="text-[10px] text-muted-foreground/30 bg-muted/50 px-1.5 py-0.5 rounded border border-border/50">
            ESC
          </kbd>
        </div>

        {/* Results */}
        <div className="max-h-[50vh] overflow-y-auto">
          {isSearching && (
            <div className="px-4 py-6 text-center text-sm text-muted-foreground/50">搜索中...</div>
          )}

          {!isSearching && searchResults && searchResults.length === 0 && searchKeyword && (
            <div className="px-4 py-6 text-center text-sm text-muted-foreground/40">
              未找到相关笔记
            </div>
          )}

          {!isSearching && searchResults && searchResults.length > 0 && (
            <div className="py-1">
              {searchResults.map((memo) => (
                <button
                  key={memo.id}
                  onClick={() => handleResultClick(memo.id)}
                  className="w-full text-left px-4 py-2.5 hover:bg-accent/50 transition-colors"
                >
                  <p className="text-sm text-foreground/80 line-clamp-2 leading-relaxed">
                    {memo.plainTextPreview || '（空白笔记）'}
                  </p>
                  <div className="flex items-center gap-2 mt-1">
                    {memo.tags.slice(0, 3).map((tag) => (
                      <span key={tag} className="text-[11px] text-primary/50">
                        #{tag}
                      </span>
                    ))}
                    <span className="text-[11px] text-muted-foreground/30 ml-auto tabular-nums">
                      {formatDistanceToNow(new Date(memo.createdAt), {
                        addSuffix: true,
                        locale: zhCN
                      })}
                    </span>
                  </div>
                </button>
              ))}
            </div>
          )}

          {!searchKeyword && (
            <div className="px-4 py-6 text-center text-sm text-muted-foreground/30">
              输入关键词搜索笔记
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

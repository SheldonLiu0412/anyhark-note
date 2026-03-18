import { useCallback, useRef, useState } from 'react'
import { Search } from 'lucide-react'
import { useUIStore } from '@renderer/stores/ui.store'
import { useSearchStore } from '@renderer/stores/search.store'
import { useTagStore } from '@renderer/stores/tag.store'
import { MemoEditor } from '@renderer/components/memo/MemoEditor'
import { MemoList } from '@renderer/components/memo/MemoList'
import { RecycleBin } from '@renderer/components/recycle/RecycleBin'
import { SearchDialog } from '@renderer/components/search/SearchDialog'

function getViewTitle(
  currentView: string,
  selectedTag: string | null
): string {
  switch (currentView) {
    case 'all':
      return '全部笔记'
    case 'tag':
      return selectedTag ? `#${selectedTag}` : '全部笔记'
    case 'recycle':
      return '回收站'
    case 'search':
      return '搜索结果'
    default:
      return '全部笔记'
  }
}

const SCROLL_THRESHOLD = 200

export function MainContent(): React.JSX.Element {
  const currentView = useUIStore((s) => s.currentView)
  const selectedTag = useTagStore((s) => s.selectedTag)
  const openSearchDialog = useSearchStore((s) => s.openSearchDialog)
  const isSearchDialogOpen = useSearchStore((s) => s.isSearchDialogOpen)

  const scrollRef = useRef<HTMLDivElement>(null)
  const [showScrollTop, setShowScrollTop] = useState(false)

  const handleScroll = useCallback(() => {
    const el = scrollRef.current
    if (el) setShowScrollTop(el.scrollTop > SCROLL_THRESHOLD)
  }, [])

  const scrollToTop = useCallback(() => {
    scrollRef.current?.scrollTo({ top: 0, behavior: 'smooth' })
  }, [])

  const title = getViewTitle(currentView, selectedTag)
  const showEditor = currentView === 'all' || currentView === 'tag'
  const showRecycle = currentView === 'recycle'

  return (
    <div className="flex flex-col h-full relative">
      {/* Header */}
      <header className="flex items-center justify-between px-6 h-12 flex-shrink-0 border-b border-border/50 app-drag-region">
        <h2 className="text-[15px] font-medium text-foreground/80 app-no-drag">{title}</h2>
        <button
          className="app-no-drag p-1.5 rounded-md text-muted-foreground/60 hover:text-foreground/80 hover:bg-accent transition-colors"
          onClick={openSearchDialog}
          title="搜索 (⌘K)"
        >
          <Search size={16} />
        </button>
      </header>

      {/* Content */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto" onScroll={handleScroll}>
        <div className="max-w-2xl mx-auto px-6 py-5">
          {showEditor && (
            <div className="mb-6">
              <MemoEditor />
            </div>
          )}

          {showRecycle ? <RecycleBin /> : <MemoList />}
        </div>
      </div>

      {/* Scroll-to-top indicator */}
      <button
        onClick={scrollToTop}
        className="absolute bottom-5 right-5 flex flex-col items-center cursor-pointer group transition-all duration-300 hover:scale-110"
        style={{
          opacity: showScrollTop ? 1 : 0,
          transform: showScrollTop ? 'translateY(0)' : 'translateY(8px)',
          pointerEvents: showScrollTop ? 'auto' : 'none'
        }}
        title="回到顶部"
      >
        <svg width="18" height="36" viewBox="0 0 18 36" fill="none">
          <defs>
            <linearGradient id="scrollTopGrad" x1="0" y1="1" x2="0" y2="0">
              <stop offset="0%" stopColor="#93c5fd" />
              <stop offset="100%" stopColor="#1e3a5f" />
            </linearGradient>
          </defs>
          <polyline points="3,14 9,8 15,14" stroke="url(#scrollTopGrad)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none" />
          <polyline points="3,22 9,16 15,22" stroke="url(#scrollTopGrad)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none" />
          <polyline points="3,30 9,24 15,30" stroke="url(#scrollTopGrad)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none" />
        </svg>
      </button>

      {/* Search dialog */}
      {isSearchDialogOpen && <SearchDialog />}
    </div>
  )
}

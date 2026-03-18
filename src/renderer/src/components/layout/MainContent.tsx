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

export function MainContent(): React.JSX.Element {
  const currentView = useUIStore((s) => s.currentView)
  const selectedTag = useTagStore((s) => s.selectedTag)
  const openSearchDialog = useSearchStore((s) => s.openSearchDialog)
  const isSearchDialogOpen = useSearchStore((s) => s.isSearchDialogOpen)

  const title = getViewTitle(currentView, selectedTag)
  const showEditor = currentView === 'all' || currentView === 'tag'
  const showRecycle = currentView === 'recycle'

  return (
    <div className="flex flex-col h-full">
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
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-2xl mx-auto px-6 py-5">
          {showEditor && (
            <div className="mb-6">
              <MemoEditor />
            </div>
          )}

          {showRecycle ? <RecycleBin /> : <MemoList />}
        </div>
      </div>

      {/* Search dialog */}
      {isSearchDialogOpen && <SearchDialog />}
    </div>
  )
}

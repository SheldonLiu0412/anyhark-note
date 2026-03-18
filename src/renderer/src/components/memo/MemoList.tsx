import { useMemo } from 'react'
import { MemoCard } from './MemoCard'
import { useMemoStore } from '@renderer/stores/memo.store'
import { useTagStore } from '@renderer/stores/tag.store'
import { useSearchStore } from '@renderer/stores/search.store'
import { useUIStore } from '@renderer/stores/ui.store'
import { FileText } from 'lucide-react'

export function MemoList(): React.JSX.Element {
  const memos = useMemoStore((s) => s.memos)
  const isLoading = useMemoStore((s) => s.isLoading)
  const selectedTag = useTagStore((s) => s.selectedTag)
  const searchResults = useSearchStore((s) => s.searchResults)
  const currentView = useUIStore((s) => s.currentView)

  const filteredMemos = useMemo(() => {
    // If search results exist, use them
    if (searchResults) return searchResults

    // Filter by selected tag
    if (selectedTag && currentView === 'tag') {
      return memos.filter((m) =>
        m.tags.some((t) => t === selectedTag || t.startsWith(selectedTag + '/'))
      )
    }

    return memos
  }, [memos, selectedTag, currentView, searchResults])

  if (isLoading) {
    return (
      <div className="space-y-4 animate-pulse">
        {[1, 2, 3].map((i) => (
          <div key={i} className="py-4 border-b border-border/30">
            <div className="h-4 bg-muted rounded w-3/4 mb-2" />
            <div className="h-4 bg-muted rounded w-1/2 mb-3" />
            <div className="h-3 bg-muted/50 rounded w-20" />
          </div>
        ))}
      </div>
    )
  }

  if (filteredMemos.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-muted-foreground/40">
        <FileText size={40} strokeWidth={1} className="mb-3" />
        <p className="text-sm">
          {selectedTag ? `#${selectedTag} 下暂无笔记` : '还没有笔记，开始记录吧'}
        </p>
      </div>
    )
  }

  return (
    <div>
      {filteredMemos.map((memo) => (
        <MemoCard key={memo.id} memo={memo} />
      ))}
    </div>
  )
}

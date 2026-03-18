import { useMemo, useRef, useEffect, useCallback } from 'react'
import { cn } from '@renderer/lib/utils'
import { format } from 'date-fns'
import { zhCN } from 'date-fns/locale'
import { FileText, Search, Upload, Download, RotateCcw, Info } from 'lucide-react'
import { useMemoStore } from '@renderer/stores/memo.store'
import { useTagStore } from '@renderer/stores/tag.store'
import { useSearchStore } from '@renderer/stores/search.store'
import { useUIStore, type SettingId } from '@renderer/stores/ui.store'
import { useRecycleStore } from '@renderer/stores/recycle.store'
import { RecycleBin } from '@renderer/components/recycle/RecycleBin'
import type { MemoMeta } from '@shared/types'
import type { LucideIcon } from 'lucide-react'

function getViewTitle(currentView: string, selectedTag: string | null): string {
  switch (currentView) {
    case 'all':
      return '全部笔记'
    case 'tag':
      return selectedTag ? `#${selectedTag}` : '全部笔记'
    case 'recycle':
      return '回收站'
    case 'search':
      return '搜索结果'
    case 'settings':
      return '设置'
    default:
      return '全部笔记'
  }
}

interface SettingMenuItem {
  id: SettingId
  label: string
  icon: LucideIcon
  iconEmoji?: string
}

const SETTING_ITEMS: SettingMenuItem[] = [
  { id: 'import', label: '导入笔记', icon: Upload },
  { id: 'export', label: '导出笔记', icon: Download },
  { id: 'openclaw', label: 'Openclaw', icon: Upload, iconEmoji: '🦞' },
  { id: 'reset', label: '重置数据', icon: RotateCcw },
  { id: 'about', label: '关于', icon: Info }
]

function NoteListItem({
  memo,
  isSelected,
  onSelect
}: {
  memo: MemoMeta
  isSelected: boolean
  onSelect: () => void
}): React.JSX.Element {
  const ref = useRef<HTMLButtonElement>(null)
  const scrollToMemoId = useUIStore((s) => s.scrollToMemoId)
  const setScrollToMemoId = useUIStore((s) => s.setScrollToMemoId)
  const timeDisplay = useMemo(
    () => format(new Date(memo.createdAt), 'yyyy/MM/dd', { locale: zhCN }),
    [memo.createdAt]
  )

  const { title, preview } = useMemo(() => {
    const text = memo.plainTextPreview || ''
    const firstLine = text.split('\n')[0] || ''
    const rest = text.slice(firstLine.length).trim()
    return {
      title: firstLine.slice(0, 40) || '空白笔记',
      preview: rest.slice(0, 60)
    }
  }, [memo.plainTextPreview])

  useEffect(() => {
    if (isSelected && ref.current) {
      ref.current.scrollIntoView({ block: 'nearest' })
    }
  }, [isSelected])

  useEffect(() => {
    if (scrollToMemoId === memo.id && ref.current) {
      setTimeout(() => {
        ref.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
        setScrollToMemoId(null)
      }, 50)
    }
  }, [scrollToMemoId, memo.id, setScrollToMemoId])

  return (
    <button
      ref={ref}
      onClick={onSelect}
      className={cn(
        'w-full text-left px-3.5 py-2.5 border-b border-border/30 transition-colors',
        isSelected
          ? 'bg-primary/10'
          : 'hover:bg-accent/50'
      )}
    >
      <p className="text-[13px] font-medium text-foreground/90 truncate leading-snug">{title}</p>
      <div className="flex items-center gap-2 mt-1">
        <span className="text-[11px] text-muted-foreground/50 tabular-nums flex-shrink-0">
          {timeDisplay}
        </span>
        {preview && (
          <span className="text-[11px] text-muted-foreground/40 truncate">{preview}</span>
        )}
      </div>
    </button>
  )
}

export function NoteListPanel(): React.JSX.Element {
  const memos = useMemoStore((s) => s.memos)
  const isLoading = useMemoStore((s) => s.isLoading)
  const selectedTag = useTagStore((s) => s.selectedTag)
  const searchResults = useSearchStore((s) => s.searchResults)
  const currentView = useUIStore((s) => s.currentView)
  const selectedMemoId = useUIStore((s) => s.selectedMemoId)
  const setSelectedMemoId = useUIStore((s) => s.setSelectedMemoId)
  const selectedSettingId = useUIStore((s) => s.selectedSettingId)
  const setSelectedSettingId = useUIStore((s) => s.setSelectedSettingId)
  const openSearchDialog = useSearchStore((s) => s.openSearchDialog)

  const title = getViewTitle(currentView, selectedTag)
  const showRecycle = currentView === 'recycle'
  const showSettings = currentView === 'settings'

  const filteredMemos = useMemo(() => {
    if (showSettings) return []
    if (searchResults) return searchResults
    if (selectedTag && currentView === 'tag') {
      return memos.filter((m) =>
        m.tags.some((t) => t === selectedTag || t.startsWith(selectedTag + '/'))
      )
    }
    return memos
  }, [memos, selectedTag, currentView, searchResults, showSettings])

  const handleSelect = useCallback(
    (id: string) => {
      setSelectedMemoId(id)
    },
    [setSelectedMemoId]
  )

  // When filtered list changes and current selection is not in it, select the first item
  useEffect(() => {
    if (showRecycle || showSettings) return
    if (filteredMemos.length > 0 && !filteredMemos.some((m) => m.id === selectedMemoId)) {
      setSelectedMemoId(filteredMemos[0].id)
    }
  }, [filteredMemos, selectedMemoId, setSelectedMemoId, showRecycle, showSettings])

  return (
    <div className="flex flex-col h-full border-r border-border/50">
      {/* Header */}
      <header className="flex items-center justify-between px-4 h-12 flex-shrink-0 border-b border-border/50 app-drag-region">
        <h2 className="text-[14px] font-medium text-foreground/80 truncate app-no-drag">{title}</h2>
        {!showSettings && (
          <button
            className="app-no-drag p-1.5 rounded-md text-muted-foreground/60 hover:text-foreground/80 hover:bg-accent transition-colors"
            onClick={openSearchDialog}
            title="搜索 (⌘K)"
          >
            <Search size={15} />
          </button>
        )}
      </header>

      {/* List */}
      <div className="flex-1 overflow-y-auto">
        {showSettings ? (
          <div className="py-1">
            {SETTING_ITEMS.map((item) => {
              const isActive = selectedSettingId === item.id
              return (
                <button
                  key={item.id}
                  onClick={() => setSelectedSettingId(item.id)}
                  className={cn(
                    'w-full flex items-center gap-2.5 px-4 py-2.5 text-[13px] transition-colors border-b border-border/20',
                    isActive ? 'bg-primary/10' : 'hover:bg-accent/50'
                  )}
                >
                  {item.iconEmoji ? (
                    <span className="text-[15px] w-4 text-center leading-none">{item.iconEmoji}</span>
                  ) : (
                    <item.icon size={15} className="text-muted-foreground/60" />
                  )}
                  <span className="text-foreground/80">{item.label}</span>
                </button>
              )
            })}
          </div>
        ) : showRecycle ? (
          <div className="px-3 py-3">
            <RecycleBin />
          </div>
        ) : isLoading ? (
          <div className="space-y-0 animate-pulse">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="px-3.5 py-3 border-b border-border/30">
                <div className="h-3.5 bg-muted rounded w-3/4 mb-2" />
                <div className="h-2.5 bg-muted/50 rounded w-1/2" />
              </div>
            ))}
          </div>
        ) : filteredMemos.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-muted-foreground/40">
            <FileText size={32} strokeWidth={1} className="mb-2" />
            <p className="text-[12px]">
              {selectedTag ? `#${selectedTag} 下暂无笔记` : '还没有笔记'}
            </p>
          </div>
        ) : (
          filteredMemos.map((memo) => (
            <NoteListItem
              key={memo.id}
              memo={memo}
              isSelected={selectedMemoId === memo.id}
              onSelect={() => handleSelect(memo.id)}
            />
          ))
        )}
      </div>
    </div>
  )
}

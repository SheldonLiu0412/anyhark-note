import { useRecycleStore } from '@renderer/stores/recycle.store'
import { Trash2, RotateCcw, AlertTriangle } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import { zhCN } from 'date-fns/locale'
import { useState } from 'react'

export function RecycleBin(): React.JSX.Element {
  const deletedMemos = useRecycleStore((s) => s.deletedMemos)
  const isLoading = useRecycleStore((s) => s.isLoading)
  const restoreMemo = useRecycleStore((s) => s.restoreMemo)
  const purgeMemo = useRecycleStore((s) => s.purgeMemo)
  const emptyRecycleBin = useRecycleStore((s) => s.emptyRecycleBin)
  const [confirmEmpty, setConfirmEmpty] = useState(false)

  if (isLoading) {
    return (
      <div className="space-y-4 animate-pulse">
        {[1, 2].map((i) => (
          <div key={i} className="py-4 border-b border-border/30">
            <div className="h-4 bg-muted rounded w-3/4 mb-2" />
            <div className="h-3 bg-muted/50 rounded w-20" />
          </div>
        ))}
      </div>
    )
  }

  if (deletedMemos.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-muted-foreground/40">
        <Trash2 size={40} strokeWidth={1} className="mb-3" />
        <p className="text-sm">回收站是空的</p>
      </div>
    )
  }

  return (
    <div>
      {/* Empty all button */}
      <div className="flex justify-end mb-4">
        {confirmEmpty ? (
          <div className="flex items-center gap-2 text-[13px]">
            <AlertTriangle size={14} className="text-destructive" />
            <span className="text-destructive">确认清空？</span>
            <button
              onClick={() => { emptyRecycleBin(); setConfirmEmpty(false) }}
              className="px-2 py-0.5 rounded bg-destructive text-destructive-foreground hover:bg-destructive/90 transition-colors"
            >
              确认
            </button>
            <button
              onClick={() => setConfirmEmpty(false)}
              className="px-2 py-0.5 rounded text-muted-foreground hover:bg-accent transition-colors"
            >
              取消
            </button>
          </div>
        ) : (
          <button
            onClick={() => setConfirmEmpty(true)}
            className="text-[13px] text-muted-foreground/60 hover:text-destructive transition-colors"
          >
            清空回收站
          </button>
        )}
      </div>

      {deletedMemos.map((memo) => (
        <div key={memo.id} className="group py-4 border-b border-border/40 last:border-0">
          <p className="text-sm text-foreground/60 leading-relaxed line-clamp-3">
            {memo.plainTextPreview || '（空白笔记）'}
          </p>
          {memo.tags.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-2">
              {memo.tags.map((tag) => (
                <span
                  key={tag}
                  className="text-[12px] text-muted-foreground/40 bg-muted/50 rounded px-1.5 py-0.5"
                >
                  #{tag}
                </span>
              ))}
            </div>
          )}
          <div className="flex items-center justify-between mt-2.5">
            <span className="text-[11px] text-muted-foreground/40 tabular-nums">
              删除于 {formatDistanceToNow(new Date(memo.deletedAt!), { addSuffix: true, locale: zhCN })}
            </span>
            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
              <button
                onClick={() => restoreMemo(memo.id)}
                className="flex items-center gap-1 px-2 py-1 text-[12px] rounded text-foreground/70 hover:bg-accent transition-colors"
              >
                <RotateCcw size={12} /> 还原
              </button>
              <button
                onClick={() => purgeMemo(memo.id)}
                className="flex items-center gap-1 px-2 py-1 text-[12px] rounded text-destructive/70 hover:bg-destructive/10 transition-colors"
              >
                <Trash2 size={12} /> 永久删除
              </button>
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}

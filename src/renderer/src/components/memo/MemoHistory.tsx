import { useEffect, useState } from 'react'
import { X, RotateCcw, Trash2 } from 'lucide-react'
import { useUIStore } from '@renderer/stores/ui.store'
import { useMemoStore } from '@renderer/stores/memo.store'
import { api } from '@renderer/lib/api'
import { format } from 'date-fns'
import { zhCN } from 'date-fns/locale'
import type { MemoVersion } from '@shared/types'

export function MemoHistory(): React.JSX.Element | null {
  const isOpen = useUIStore((s) => s.isHistoryDialogOpen)
  const memoId = useUIStore((s) => s.historyMemoId)
  const closeHistoryDialog = useUIStore((s) => s.closeHistoryDialog)
  const refreshMemo = useMemoStore((s) => s.refreshMemo)
  const [versions, setVersions] = useState<MemoVersion[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (isOpen && memoId) {
      setLoading(true)
      api.memo
        .getVersions(memoId)
        .then(setVersions)
        .finally(() => setLoading(false))
    }
  }, [isOpen, memoId])

  if (!isOpen || !memoId) return null

  const handleRestore = async (versionId: string): Promise<void> => {
    await api.memo.restoreVersion(memoId, versionId)
    await refreshMemo(memoId)
    closeHistoryDialog()
  }

  const handleDelete = async (versionId: string): Promise<void> => {
    await api.memo.deleteVersion(memoId, versionId)
    setVersions((prev) => prev.filter((v) => v.versionId !== versionId))
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-[10vh]">
      <div className="fixed inset-0 bg-black/30 backdrop-blur-sm" onClick={closeHistoryDialog} />
      <div className="relative w-full max-w-md bg-popover border border-border rounded-xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-4 h-11 border-b border-border/60">
          <h3 className="text-[14px] font-medium">
            历史版本
            {versions.length > 0 && (
              <span className="ml-1.5 text-[12px] text-muted-foreground/40 font-normal">
                ({versions.length}/10)
              </span>
            )}
          </h3>
          <button
            onClick={closeHistoryDialog}
            className="p-1 rounded hover:bg-accent transition-colors"
          >
            <X size={14} className="text-muted-foreground" />
          </button>
        </div>

        {/* Content */}
        <div className="max-h-[60vh] overflow-y-auto">
          {loading && (
            <div className="px-4 py-8 text-center text-sm text-muted-foreground/50">加载中...</div>
          )}

          {!loading && versions.length === 0 && (
            <div className="px-4 py-8 text-center text-sm text-muted-foreground/40">
              暂无历史版本
            </div>
          )}

          {!loading &&
            versions.map((version) => (
              <div
                key={version.versionId}
                className="group px-4 py-3 border-b border-border/30 last:border-0 hover:bg-accent/30 transition-colors"
              >
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-[12px] text-muted-foreground/60 tabular-nums">
                    {format(new Date(version.savedAt), 'yyyy-MM-dd HH:mm:ss', { locale: zhCN })}
                  </span>
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-all">
                    <button
                      onClick={() => handleRestore(version.versionId)}
                      className="flex items-center gap-1 px-2 py-0.5 text-[12px] rounded text-primary/70 hover:bg-primary/10"
                    >
                      <RotateCcw size={11} /> 还原
                    </button>
                    <button
                      onClick={() => handleDelete(version.versionId)}
                      className="flex items-center gap-1 px-2 py-0.5 text-[12px] rounded text-destructive/70 hover:bg-destructive/10"
                    >
                      <Trash2 size={11} /> 删除
                    </button>
                  </div>
                </div>
                <p className="text-[13px] text-foreground/60 line-clamp-3 leading-relaxed">
                  {version.plainText || '（空白）'}
                </p>
                {version.tags.length > 0 && (
                  <div className="flex gap-1 mt-1.5">
                    {version.tags.map((tag) => (
                      <span key={tag} className="text-[11px] text-muted-foreground/40">
                        #{tag}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            ))}
        </div>
      </div>
    </div>
  )
}

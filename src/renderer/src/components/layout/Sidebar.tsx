import { FileText, Trash2, Hash, ChevronRight, Upload, Download, RotateCcw, X, AlertTriangle, ExternalLink, FileSpreadsheet, FileJson, ArrowLeft, Copy, Check } from 'lucide-react'
import { cn } from '@renderer/lib/utils'
import { useUIStore } from '@renderer/stores/ui.store'
import { useMemoStore } from '@renderer/stores/memo.store'
import { useTagStore } from '@renderer/stores/tag.store'
import { useRecycleStore } from '@renderer/stores/recycle.store'
import { useMemo, useState, useCallback } from 'react'
import { api } from '@renderer/lib/api'
import logoImg from '@renderer/assets/logo.png'
import flomoGuideImg from '@renderer/assets/flomo-import-guide.png'

interface TagTreeNode {
  name: string
  fullPath: string
  count: number
  children: TagTreeNode[]
}

function buildTagTree(tagIndex: Record<string, string[]>): TagTreeNode[] {
  const root: TagTreeNode[] = []
  const nodeMap = new Map<string, TagTreeNode>()

  const allPaths = Object.keys(tagIndex).sort()
  for (const path of allPaths) {
    const parts = path.split('/')
    let currentPath = ''
    let parentList = root

    for (let i = 0; i < parts.length; i++) {
      currentPath = i === 0 ? parts[i] : `${currentPath}/${parts[i]}`
      let node = nodeMap.get(currentPath)
      if (!node) {
        node = { name: parts[i], fullPath: currentPath, count: 0, children: [] }
        nodeMap.set(currentPath, node)
        parentList.push(node)
      }
      node.count = (tagIndex[currentPath] || []).length
      parentList = node.children
    }
  }

  return root
}

function TagTreeItem({ node, depth = 0 }: { node: TagTreeNode; depth?: number }): React.JSX.Element {
  const selectedTag = useTagStore((s) => s.selectedTag)
  const expandedTags = useTagStore((s) => s.expandedTags)
  const selectTag = useTagStore((s) => s.selectTag)
  const toggleTagExpanded = useTagStore((s) => s.toggleTagExpanded)
  const setCurrentView = useUIStore((s) => s.setCurrentView)

  const isSelected = selectedTag === node.fullPath
  const isExpanded = expandedTags.has(node.fullPath)
  const hasChildren = node.children.length > 0

  return (
    <div>
      <button
        className={cn(
          'w-full flex items-center gap-1.5 px-3 py-[5px] text-[13px] rounded-md transition-colors group',
          isSelected
            ? 'bg-[hsl(var(--sidebar-active))] text-[hsl(var(--sidebar-fg-bright))]'
            : 'text-[hsl(var(--sidebar-fg))] hover:bg-[hsl(var(--sidebar-hover))] hover:text-[hsl(var(--sidebar-fg-bright))]'
        )}
        style={{ paddingLeft: `${12 + depth * 14}px` }}
        onClick={() => {
          selectTag(node.fullPath)
          setCurrentView('tag')
          if (hasChildren) toggleTagExpanded(node.fullPath)
        }}
      >
        {hasChildren ? (
          <ChevronRight
            size={12}
            className={cn(
              'flex-shrink-0 transition-transform opacity-50',
              isExpanded && 'rotate-90'
            )}
          />
        ) : (
          <span className="w-3 flex-shrink-0" />
        )}
        <Hash size={13} className="flex-shrink-0 opacity-40" />
        <span className="truncate">{node.name}</span>
        {node.count > 0 && (
          <span className="ml-auto text-[11px] opacity-30 group-hover:opacity-50 tabular-nums">
            {node.count}
          </span>
        )}
      </button>
      {hasChildren && isExpanded && (
        <div>
          {node.children.map((child) => (
            <TagTreeItem key={child.fullPath} node={child} depth={depth + 1} />
          ))}
        </div>
      )}
    </div>
  )
}

function ResetConfirmDialog({
  open,
  onClose,
  onConfirm
}: {
  open: boolean
  onClose: () => void
  onConfirm: () => void
}): React.JSX.Element | null {
  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="fixed inset-0 bg-black/30 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-sm mx-4 bg-popover border border-border rounded-xl shadow-2xl overflow-hidden">
        <div className="px-5 pt-5 pb-4">
          <div className="flex items-start gap-3">
            <div className="flex-shrink-0 w-9 h-9 rounded-full bg-destructive/10 flex items-center justify-center">
              <AlertTriangle size={18} className="text-destructive" />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="text-[14px] font-semibold text-foreground">重置所有数据</h3>
              <p className="mt-1.5 text-[13px] text-muted-foreground leading-relaxed">
                此操作将清空所有笔记、标签和历史版本，且不可恢复。
              </p>
              <div className="mt-3 px-3 py-2 rounded-lg bg-muted/50 border border-border/50">
                <p className="text-[11px] text-muted-foreground/70 leading-relaxed">
                  开发阶段临时功能 — 后续版本将增加二次验证、数据备份等安全措施。
                </p>
              </div>
            </div>
          </div>
        </div>
        <div className="flex items-center justify-end gap-2 px-5 py-3 border-t border-border/50 bg-muted/20">
          <button
            onClick={onClose}
            className="px-3.5 py-1.5 text-[13px] text-muted-foreground hover:text-foreground rounded-lg transition-colors"
          >
            取消
          </button>
          <button
            onClick={onConfirm}
            className="px-3.5 py-1.5 text-[13px] font-medium rounded-lg bg-destructive text-destructive-foreground hover:bg-destructive/90 transition-colors"
          >
            确认重置
          </button>
        </div>
      </div>
    </div>
  )
}

function ImportGuideDialog({
  open,
  onClose,
  onSelectFlomoFolder,
  onSelectAnyharkFolder
}: {
  open: boolean
  onClose: () => void
  onSelectFlomoFolder: () => void
  onSelectAnyharkFolder: () => void
}): React.JSX.Element | null {
  const [view, setView] = useState<'select' | 'flomo' | 'anyhark'>('select')

  const handleClose = useCallback(() => {
    onClose()
    setTimeout(() => setView('select'), 200)
  }, [onClose])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-[8vh]">
      <div className="fixed inset-0 bg-black/30 backdrop-blur-sm" onClick={handleClose} />
      <div className="relative w-full max-w-md mx-4 bg-popover border border-border rounded-xl shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between px-5 h-12 border-b border-border/50">
          <div className="flex items-center gap-2">
            {view !== 'select' && (
              <button onClick={() => setView('select')} className="p-0.5 rounded hover:bg-accent transition-colors">
                <ArrowLeft size={14} className="text-muted-foreground" />
              </button>
            )}
            <h3 className="text-[14px] font-semibold text-foreground">
              {view === 'select' ? '导入笔记' : view === 'flomo' ? '从 Flomo 导入' : '从 Anyhark 导入'}
            </h3>
          </div>
          <button onClick={handleClose} className="p-1 rounded hover:bg-accent transition-colors">
            <X size={14} className="text-muted-foreground" />
          </button>
        </div>

        {view === 'select' && (
          <>
            <div className="px-5 py-4 space-y-3 max-h-[70vh] overflow-y-auto">
              <button
                onClick={() => setView('flomo')}
                className="w-full text-left p-3.5 rounded-lg border border-border/60 hover:border-primary/40 hover:bg-primary/5 transition-colors group"
              >
                <div className="flex items-center gap-2.5 mb-1.5">
                  <ExternalLink size={16} className="text-muted-foreground group-hover:text-primary transition-colors" />
                  <span className="text-[13px] font-medium text-foreground">从 Flomo 导入</span>
                </div>
                <p className="text-[12px] text-muted-foreground leading-relaxed pl-[26px]">
                  从 Flomo 导出的 HTML 数据中导入笔记和图片。
                </p>
              </button>
              <button
                onClick={() => setView('anyhark')}
                className="w-full text-left p-3.5 rounded-lg border border-border/60 hover:border-primary/40 hover:bg-primary/5 transition-colors group"
              >
                <div className="flex items-center gap-2.5 mb-1.5">
                  <FileJson size={16} className="text-muted-foreground group-hover:text-primary transition-colors" />
                  <span className="text-[13px] font-medium text-foreground">从 Anyhark 导入</span>
                </div>
                <p className="text-[12px] text-muted-foreground leading-relaxed pl-[26px]">
                  从 Anyhark JSON 导出的备份中恢复完整笔记数据。
                </p>
              </button>
            </div>
            <div className="flex items-center justify-end px-5 py-3 border-t border-border/50 bg-muted/20">
              <button
                onClick={handleClose}
                className="px-3.5 py-1.5 text-[13px] text-muted-foreground hover:text-foreground rounded-lg transition-colors"
              >
                取消
              </button>
            </div>
          </>
        )}

        {view === 'flomo' && (
          <>
            <div className="px-5 py-4 space-y-4 max-h-[70vh] overflow-y-auto">
              <div className="space-y-2.5">
                <div className="flex items-start gap-2.5">
                  <span className="flex-shrink-0 w-5 h-5 rounded-full bg-primary/10 text-primary text-[11px] font-semibold flex items-center justify-center mt-0.5">1</span>
                  <p className="text-[13px] text-foreground/80 leading-relaxed">
                    打开 Flomo 网页版{' '}
                    <a
                      href="https://v.flomoapp.com/mine"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-0.5 text-primary hover:underline"
                    >
                      v.flomoapp.com
                      <ExternalLink size={11} />
                    </a>
                    ，点击左上角昵称 → <span className="font-medium">账号详情</span> → <span className="font-medium">导入/导出</span>，导出你的数据。
                  </p>
                </div>
                <div className="flex items-start gap-2.5">
                  <span className="flex-shrink-0 w-5 h-5 rounded-full bg-primary/10 text-primary text-[11px] font-semibold flex items-center justify-center mt-0.5">2</span>
                  <p className="text-[13px] text-foreground/80 leading-relaxed">
                    解压下载的文件，点击下方按钮选择解压后的文件夹即可完成导入。
                  </p>
                </div>
              </div>
              <div className="rounded-lg border border-border/60 overflow-hidden">
                <img src={flomoGuideImg} alt="Flomo 导入指引" className="w-full" />
              </div>
            </div>
            <div className="flex items-center justify-end gap-2 px-5 py-3 border-t border-border/50 bg-muted/20">
              <button
                onClick={handleClose}
                className="px-3.5 py-1.5 text-[13px] text-muted-foreground hover:text-foreground rounded-lg transition-colors"
              >
                取消
              </button>
              <button
                onClick={onSelectFlomoFolder}
                className="px-4 py-1.5 text-[13px] font-medium rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
              >
                选择文件夹
              </button>
            </div>
          </>
        )}

        {view === 'anyhark' && (
          <>
            <div className="px-5 py-4 space-y-4 max-h-[70vh] overflow-y-auto">
              <div className="space-y-2.5">
                <div className="flex items-start gap-2.5">
                  <span className="flex-shrink-0 w-5 h-5 rounded-full bg-primary/10 text-primary text-[11px] font-semibold flex items-center justify-center mt-0.5">1</span>
                  <p className="text-[13px] text-foreground/80 leading-relaxed">
                    使用 Anyhark 的 <span className="font-medium">JSON 导出</span> 功能导出备份压缩包。
                  </p>
                </div>
                <div className="flex items-start gap-2.5">
                  <span className="flex-shrink-0 w-5 h-5 rounded-full bg-primary/10 text-primary text-[11px] font-semibold flex items-center justify-center mt-0.5">2</span>
                  <p className="text-[13px] text-foreground/80 leading-relaxed">
                    解压下载的 ZIP 文件，点击下方按钮选择解压后的文件夹即可完成导入。文件夹内应包含 <span className="font-medium">memos</span> 和 <span className="font-medium">images</span> 子目录。
                  </p>
                </div>
              </div>
            </div>
            <div className="flex items-center justify-end gap-2 px-5 py-3 border-t border-border/50 bg-muted/20">
              <button
                onClick={handleClose}
                className="px-3.5 py-1.5 text-[13px] text-muted-foreground hover:text-foreground rounded-lg transition-colors"
              >
                取消
              </button>
              <button
                onClick={onSelectAnyharkFolder}
                className="px-4 py-1.5 text-[13px] font-medium rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
              >
                选择文件夹
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

const OPENCLAW_PROMPT = `请帮我安装 Anyhark 笔记应用的 Agent Skill。

仓库地址：https://github.com/SheldonLiu0412/anyhark-note
Skill 文件路径：skills/anyhark-note/SKILL.md

安装后你就可以通过 CLI 或 HTTP API 帮我操作 Anyhark 笔记了。`

function OpenclawDialog({
  open,
  onClose
}: {
  open: boolean
  onClose: () => void
}): React.JSX.Element | null {
  const [copied, setCopied] = useState(false)

  const handleCopy = useCallback(async () => {
    await navigator.clipboard.writeText(OPENCLAW_PROMPT)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }, [])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-[8vh]">
      <div className="fixed inset-0 bg-black/30 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-md mx-4 bg-popover border border-border rounded-xl shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between px-5 h-12 border-b border-border/50">
          <h3 className="text-[14px] font-semibold text-foreground flex items-center gap-1.5">
            <span>Openclaw</span>
            <span className="text-[16px]">🦞</span>
          </h3>
          <button onClick={onClose} className="p-1 rounded hover:bg-accent transition-colors">
            <X size={14} className="text-muted-foreground" />
          </button>
        </div>
        <div className="px-5 py-4 space-y-3">
          <p className="text-[13px] text-muted-foreground leading-relaxed">
            复制以下内容发送给你的 AI Agent，即可让它学会操作 Anyhark 笔记。
          </p>
          <div className="relative rounded-lg border border-border/60 bg-muted/30 p-3.5">
            <pre className="text-[12px] text-foreground/80 leading-relaxed whitespace-pre-wrap break-words pr-8">
              {OPENCLAW_PROMPT}
            </pre>
            <button
              onClick={handleCopy}
              className="absolute top-2.5 right-2.5 p-1.5 rounded-md hover:bg-accent transition-colors"
              title="复制"
            >
              {copied ? (
                <Check size={14} className="text-green-500" />
              ) : (
                <Copy size={14} className="text-muted-foreground" />
              )}
            </button>
          </div>
        </div>
        <div className="flex items-center justify-end px-5 py-3 border-t border-border/50 bg-muted/20">
          <button
            onClick={onClose}
            className="px-3.5 py-1.5 text-[13px] text-muted-foreground hover:text-foreground rounded-lg transition-colors"
          >
            关闭
          </button>
        </div>
      </div>
    </div>
  )
}

function ExportGuideDialog({
  open,
  onClose,
  onExportCSV,
  onExportJSON
}: {
  open: boolean
  onClose: () => void
  onExportCSV: () => void
  onExportJSON: () => void
}): React.JSX.Element | null {
  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-[8vh]">
      <div className="fixed inset-0 bg-black/30 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-md mx-4 bg-popover border border-border rounded-xl shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between px-5 h-12 border-b border-border/50">
          <h3 className="text-[14px] font-semibold text-foreground">导出笔记</h3>
          <button onClick={onClose} className="p-1 rounded hover:bg-accent transition-colors">
            <X size={14} className="text-muted-foreground" />
          </button>
        </div>
        <div className="px-5 py-4 space-y-3 max-h-[70vh] overflow-y-auto">
          <button
            onClick={onExportCSV}
            className="w-full text-left p-3.5 rounded-lg border border-border/60 hover:border-primary/40 hover:bg-primary/5 transition-colors group"
          >
            <div className="flex items-center gap-2.5 mb-1.5">
              <FileSpreadsheet size={16} className="text-muted-foreground group-hover:text-primary transition-colors" />
              <span className="text-[13px] font-medium text-foreground">CSV 导出</span>
            </div>
            <p className="text-[12px] text-muted-foreground leading-relaxed pl-[26px]">
              导出为 CSV 表格 + 图片压缩包，适合查看和迁移到其他工具。
            </p>
          </button>
          <button
            onClick={onExportJSON}
            className="w-full text-left p-3.5 rounded-lg border border-border/60 hover:border-primary/40 hover:bg-primary/5 transition-colors group"
          >
            <div className="flex items-center gap-2.5 mb-1.5">
              <FileJson size={16} className="text-muted-foreground group-hover:text-primary transition-colors" />
              <span className="text-[13px] font-medium text-foreground">JSON 导出</span>
            </div>
            <p className="text-[12px] text-muted-foreground leading-relaxed pl-[26px]">
              导出为 Anyhark 原始格式压缩包，完整保留所有内容和图片，可直接导入回 Anyhark。
            </p>
          </button>
        </div>
        <div className="flex items-center justify-end px-5 py-3 border-t border-border/50 bg-muted/20">
          <button
            onClick={onClose}
            className="px-3.5 py-1.5 text-[13px] text-muted-foreground hover:text-foreground rounded-lg transition-colors"
          >
            取消
          </button>
        </div>
      </div>
    </div>
  )
}

export function Sidebar(): React.JSX.Element {
  const currentView = useUIStore((s) => s.currentView)
  const setCurrentView = useUIStore((s) => s.setCurrentView)
  const selectTag = useTagStore((s) => s.selectTag)
  const memos = useMemoStore((s) => s.memos)
  const loadMemos = useMemoStore((s) => s.loadMemos)
  const loadTags = useTagStore((s) => s.loadTags)
  const tagIndex = useTagStore((s) => s.tagIndex)
  const loadDeletedMemos = useRecycleStore((s) => s.loadDeletedMemos)
  const [importing, setImporting] = useState(false)
  const [importResult, setImportResult] = useState<string | null>(null)
  const [showResetDialog, setShowResetDialog] = useState(false)
  const [showImportGuide, setShowImportGuide] = useState(false)
  const [showExportGuide, setShowExportGuide] = useState(false)
  const [showOpenclawDialog, setShowOpenclawDialog] = useState(false)

  const handleResetConfirm = useCallback(async () => {
    setShowResetDialog(false)
    try {
      await api.memo.clearAll()
      await loadMemos()
      await loadTags()
      setImportResult('已重置所有数据')
      setTimeout(() => setImportResult(null), 3000)
    } catch (err) {
      setImportResult('重置失败: ' + (err instanceof Error ? err.message : '未知错误'))
    }
  }, [loadMemos, loadTags])

  const handleExportCSV = useCallback(async () => {
    setShowExportGuide(false)
    setImportResult(null)
    try {
      const result = await api.export.csv()
      if (result) {
        setImportResult(`已导出 ${result.count} 条笔记 (CSV)`)
        setTimeout(() => setImportResult(null), 3000)
      }
    } catch (err) {
      setImportResult('导出失败: ' + (err instanceof Error ? err.message : '未知错误'))
      setTimeout(() => setImportResult(null), 4000)
    }
  }, [])

  const handleExportJSON = useCallback(async () => {
    setShowExportGuide(false)
    setImportResult(null)
    try {
      const result = await api.export.json()
      if (result) {
        setImportResult(`已导出 ${result.count} 条笔记 (JSON)`)
        setTimeout(() => setImportResult(null), 3000)
      }
    } catch (err) {
      setImportResult('导出失败: ' + (err instanceof Error ? err.message : '未知错误'))
      setTimeout(() => setImportResult(null), 4000)
    }
  }, [])

  const handleImportFlomo = useCallback(async () => {
    setShowImportGuide(false)
    const dirPath = await api.import.selectDirectory()
    if (!dirPath) return
    setImporting(true)
    setImportResult(null)
    try {
      const result = await api.import.flomo(dirPath)
      setImportResult(`已导入 ${result.imported} 条笔记，${result.images} 张图片`)
      await loadMemos()
      await loadTags()
    } catch (err) {
      setImportResult('导入失败: ' + (err instanceof Error ? err.message : '未知错误'))
    } finally {
      setImporting(false)
      setTimeout(() => setImportResult(null), 4000)
    }
  }, [loadMemos, loadTags])

  const handleImportAnyhark = useCallback(async () => {
    setShowImportGuide(false)
    const dirPath = await api.import.selectDirectory()
    if (!dirPath) return
    setImporting(true)
    setImportResult(null)
    try {
      const result = await api.import.anyhark(dirPath)
      setImportResult(`已导入 ${result.imported} 条笔记，${result.images} 张图片`)
      await loadMemos()
      await loadTags()
    } catch (err) {
      setImportResult('导入失败: ' + (err instanceof Error ? err.message : '未知错误'))
    } finally {
      setImporting(false)
      setTimeout(() => setImportResult(null), 4000)
    }
  }, [loadMemos, loadTags])

  const tagTree = useMemo(
    () => (tagIndex ? buildTagTree(tagIndex.tags) : []),
    [tagIndex]
  )

  const navItems = [
    {
      id: 'all' as const,
      label: '全部笔记',
      icon: FileText,
      onClick: () => {
        selectTag(null)
        setCurrentView('all')
      }
    },
    {
      id: 'recycle' as const,
      label: '回收站',
      icon: Trash2,
      onClick: () => {
        setCurrentView('recycle')
        loadDeletedMemos()
      }
    }
  ]

  return (
    <div className="flex flex-col h-full select-none">
      {/* Traffic light spacer + drag region */}
      <div className="app-drag-region h-11 flex-shrink-0" />
      {/* App title */}
      <div className="h-10 flex items-center gap-2.5 px-4 flex-shrink-0">
        <img src={logoImg} alt="Anyhark" className="w-6 h-6 rounded app-no-drag" />
        <h1
          className="text-[15px] font-semibold tracking-wide app-no-drag"
          style={{ color: 'hsl(var(--sidebar-fg-bright))' }}
        >
          Anyhark
        </h1>
        <span
          className="text-[10px] app-no-drag ml-auto tabular-nums"
          style={{ color: 'hsl(var(--sidebar-fg) / 0.4)' }}
        >v0.1.0</span>
      </div>

      {/* Nav items */}
      <nav className="px-2 space-y-0.5 flex-shrink-0 mt-1">
        {navItems.map((item) => {
          const isActive = currentView === item.id
          return (
            <button
              key={item.id}
              className={cn(
                'w-full flex items-center gap-2.5 px-3 py-[7px] text-[13px] rounded-md transition-colors',
                isActive
                  ? 'bg-[hsl(var(--sidebar-active))] text-[hsl(var(--sidebar-fg-bright))]'
                  : 'text-[hsl(var(--sidebar-fg))] hover:bg-[hsl(var(--sidebar-hover))] hover:text-[hsl(var(--sidebar-fg-bright))]'
              )}
              onClick={item.onClick}
            >
              <item.icon size={15} className={cn(isActive ? 'opacity-90' : 'opacity-50')} />
              <span>{item.label}</span>
            </button>
          )
        })}
        <button
          className="w-full flex items-center gap-2.5 px-3 py-[7px] text-[13px] rounded-md transition-colors text-[hsl(var(--sidebar-fg))] hover:bg-[hsl(var(--sidebar-hover))] hover:text-[hsl(var(--sidebar-fg-bright))]"
          onClick={() => setShowOpenclawDialog(true)}
        >
          <span className="text-[15px] opacity-50 flex-shrink-0 w-[15px] text-center leading-none">🦞</span>
          <span>Openclaw</span>
        </button>
      </nav>

      {/* Divider */}
      <div
        className="mx-4 my-3 h-px"
        style={{ backgroundColor: 'hsl(var(--sidebar-border))' }}
      />

      {/* Tag label */}
      <div className="px-4 mb-1">
        <span
          className="text-[11px] uppercase tracking-widest font-medium"
          style={{ color: 'hsl(var(--sidebar-fg) / 0.5)' }}
        >
          标签
        </span>
      </div>

      {/* Tag tree */}
      <div className="flex-1 overflow-y-auto px-2 pb-2 sidebar-scroll">
        {tagTree.length === 0 ? (
          <div
            className="px-3 py-4 text-[12px] text-center"
            style={{ color: 'hsl(var(--sidebar-fg) / 0.3)' }}
          >
            使用 #标签 来组织笔记
          </div>
        ) : (
          tagTree.map((node) => <TagTreeItem key={node.fullPath} node={node} />)
        )}
      </div>

      {/* Feedback line */}
      <div
        className="flex-shrink-0 px-4 pt-2 pb-1 text-center"
        style={{ color: 'hsl(var(--sidebar-fg) / 0.25)' }}
      >
        <span className="text-[10px]">反馈可至 snailsshell0412@gmail.com</span>
      </div>

      {/* Bottom bar */}
      <div
        className="flex-shrink-0 px-4 py-2.5 border-t"
        style={{
          borderColor: 'hsl(var(--sidebar-border))',
          color: 'hsl(var(--sidebar-fg) / 0.4)'
        }}
      >
        <div className="flex items-center justify-between">
          <span className="text-[11px] tabular-nums">{memos.length} 条笔记</span>
          <div className="flex items-center gap-1">
            <button
              className={cn(
                'flex items-center gap-1 text-[11px] px-1.5 py-0.5 rounded transition-colors',
                'text-muted-foreground/60 hover:bg-destructive/10 hover:text-destructive'
              )}
              onClick={() => setShowResetDialog(true)}
              title="重置所有数据"
            >
              <RotateCcw size={10} />
              重置
            </button>
            <button
              className={cn(
                'flex items-center gap-1 text-[11px] px-1.5 py-0.5 rounded transition-colors',
                'hover:bg-[hsl(var(--sidebar-hover))] hover:text-[hsl(var(--sidebar-fg-bright))]',
                importing && 'opacity-50 pointer-events-none'
              )}
              onClick={() => setShowImportGuide(true)}
              title="导入笔记"
            >
              <Upload size={11} />
              {importing ? '导入中...' : '导入'}
            </button>
            <button
              className={cn(
                'flex items-center gap-1 text-[11px] px-1.5 py-0.5 rounded transition-colors',
                'hover:bg-[hsl(var(--sidebar-hover))] hover:text-[hsl(var(--sidebar-fg-bright))]'
              )}
              onClick={() => setShowExportGuide(true)}
              title="导出笔记"
            >
              <Download size={11} />
              导出
            </button>
          </div>
        </div>
        {importResult && (
          <div className="mt-1.5 text-[11px] text-[hsl(var(--sidebar-fg-bright))] leading-tight">
            {importResult}
          </div>
        )}
      </div>

      <ResetConfirmDialog
        open={showResetDialog}
        onClose={() => setShowResetDialog(false)}
        onConfirm={handleResetConfirm}
      />
      <ImportGuideDialog
        open={showImportGuide}
        onClose={() => setShowImportGuide(false)}
        onSelectFlomoFolder={handleImportFlomo}
        onSelectAnyharkFolder={handleImportAnyhark}
      />
      <ExportGuideDialog
        open={showExportGuide}
        onClose={() => setShowExportGuide(false)}
        onExportCSV={handleExportCSV}
        onExportJSON={handleExportJSON}
      />
      <OpenclawDialog
        open={showOpenclawDialog}
        onClose={() => setShowOpenclawDialog(false)}
      />
    </div>
  )
}

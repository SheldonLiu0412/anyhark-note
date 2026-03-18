import { FileText, Trash2, Hash, ChevronRight, Upload, XCircle } from 'lucide-react'
import { cn } from '@renderer/lib/utils'
import { useUIStore } from '@renderer/stores/ui.store'
import { useMemoStore } from '@renderer/stores/memo.store'
import { useTagStore } from '@renderer/stores/tag.store'
import { useRecycleStore } from '@renderer/stores/recycle.store'
import { useMemo, useState } from 'react'
import { api } from '@renderer/lib/api'
import logoImg from '@renderer/assets/logo.png'

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
        }}
      >
        {hasChildren ? (
          <ChevronRight
            size={12}
            className={cn(
              'flex-shrink-0 transition-transform opacity-50',
              isExpanded && 'rotate-90'
            )}
            onClick={(e) => {
              e.stopPropagation()
              toggleTagExpanded(node.fullPath)
            }}
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

      {/* Bottom bar */}
      <div
        className="flex-shrink-0 px-4 py-3 border-t"
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
                'text-destructive/60 hover:bg-destructive/10 hover:text-destructive'
              )}
              onClick={async () => {
                if (!confirm('确定清空所有笔记数据？此操作不可恢复！')) return
                try {
                  await api.memo.clearAll()
                  await loadMemos()
                  await loadTags()
                  setImportResult('已清空所有数据')
                  setTimeout(() => setImportResult(null), 3000)
                } catch (err) {
                  setImportResult('清空失败: ' + (err instanceof Error ? err.message : '未知错误'))
                }
              }}
              title="清空所有数据"
            >
              <XCircle size={11} />
              清空
            </button>
            <button
              className={cn(
                'flex items-center gap-1 text-[11px] px-1.5 py-0.5 rounded transition-colors',
                'hover:bg-[hsl(var(--sidebar-hover))] hover:text-[hsl(var(--sidebar-fg-bright))]',
                importing && 'opacity-50 pointer-events-none'
              )}
              onClick={async () => {
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
              }}
              title="从 Flomo 导入"
            >
              <Upload size={11} />
              {importing ? '导入中...' : '导入'}
            </button>
          </div>
        </div>
        {importResult && (
          <div className="mt-1.5 text-[11px] text-[hsl(var(--sidebar-fg-bright))] leading-tight">
            {importResult}
          </div>
        )}
      </div>
    </div>
  )
}

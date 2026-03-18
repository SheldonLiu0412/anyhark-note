import { useEffect, useMemo, useRef, useState } from 'react'
import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import UnderlineExt from '@tiptap/extension-underline'
import HighlightExt from '@tiptap/extension-highlight'
import ImageExt from '@tiptap/extension-image'
import { TagNode } from '@renderer/extensions/tag-node'
import { MentionNoteNode, MentionLinkNode } from '@renderer/extensions/mention-node'
import { MoreHorizontal, Pencil, Trash2, History } from 'lucide-react'
import { cn } from '@renderer/lib/utils'
import { format } from 'date-fns'
import { zhCN } from 'date-fns/locale'
import { useMemoStore } from '@renderer/stores/memo.store'
import { useUIStore } from '@renderer/stores/ui.store'
import { MemoEditor } from './MemoEditor'
import { ImageGallery } from './ImageGallery'
import type { MemoMeta, TipTapDocument, TipTapNode } from '@shared/types'

const readonlyExtensions = [
  StarterKit.configure({ heading: false }),
  UnderlineExt,
  HighlightExt.configure({ multicolor: false }),
  ImageExt.configure({ inline: false, allowBase64: false }),
  TagNode,
  MentionNoteNode,
  MentionLinkNode
]

/** Extract all anyhark-image:// URLs from a TipTap document */
function extractImageSrcs(doc: TipTapDocument): string[] {
  const srcs: string[] = []
  function walk(node: TipTapNode): void {
    if (node.type === 'image' && node.attrs?.src) {
      const src = String(node.attrs.src)
      if (src.startsWith('anyhark-image://')) srcs.push(src)
    }
    if (node.content) node.content.forEach(walk)
  }
  doc.content.forEach(walk)
  return srcs
}

/** Deep-clone a TipTap document with all image nodes removed */
function stripImages(doc: TipTapDocument): TipTapDocument {
  function filterNodes(nodes: TipTapNode[]): TipTapNode[] {
    return nodes
      .filter((n) => n.type !== 'image')
      .map((n) => (n.content ? { ...n, content: filterNodes(n.content) } : n))
  }
  return { type: 'doc', content: filterNodes(doc.content) }
}

function MemoCardContent({ content }: { content: TipTapDocument }): React.JSX.Element {
  const textContent = useMemo(() => stripImages(content), [content])
  const imageSrcs = useMemo(() => extractImageSrcs(content), [content])

  const editor = useEditor(
    {
      extensions: readonlyExtensions,
      content: textContent,
      editable: false
    },
    [textContent]
  )
  return (
    <div className="memo-card">
      <EditorContent editor={editor} />
      {imageSrcs.length > 0 && <ImageGallery images={imageSrcs} />}
    </div>
  )
}

interface MemoCardProps {
  memo: MemoMeta
}

export function MemoCard({ memo }: MemoCardProps): React.JSX.Element {
  const [showMenu, setShowMenu] = useState(false)
  const [fullMemo, setFullMemo] = useState<{ content: TipTapDocument } | null>(null)
  const cardRef = useRef<HTMLDivElement>(null)

  const editingMemoId = useMemoStore((s) => s.editingMemoId)
  const setEditingMemo = useMemoStore((s) => s.setEditingMemo)
  const deleteMemo = useMemoStore((s) => s.deleteMemo)
  const loadFullMemo = useMemoStore((s) => s.loadFullMemo)
  const openHistoryDialog = useUIStore((s) => s.openHistoryDialog)
  const scrollToMemoId = useUIStore((s) => s.scrollToMemoId)
  const setScrollToMemoId = useUIStore((s) => s.setScrollToMemoId)

  const isEditing = editingMemoId === memo.id

  const timeDisplay = useMemo(
    () => format(new Date(memo.createdAt), 'yyyy-MM-dd HH:mm', { locale: zhCN }),
    [memo.createdAt]
  )

  // Load full content — re-load when updatedAt changes (after edit or restore)
  useEffect(() => {
    loadFullMemo(memo.id).then((full) => {
      setFullMemo({ content: full.content })
    })
  }, [memo.id, memo.updatedAt, loadFullMemo])

  // Scroll into view when navigated from search (delay lets layout settle after view switch)
  useEffect(() => {
    if (scrollToMemoId === memo.id && cardRef.current) {
      const scrollTimer = setTimeout(() => {
        cardRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
        cardRef.current?.classList.add('bg-primary/5')
        const highlightTimer = setTimeout(() => {
          cardRef.current?.classList.remove('bg-primary/5')
          setScrollToMemoId(null)
        }, 1500)
        return () => clearTimeout(highlightTimer)
      }, 200)
      return () => clearTimeout(scrollTimer)
    }
  }, [scrollToMemoId, memo.id, setScrollToMemoId])

  const handleEdit = async (): Promise<void> => {
    setShowMenu(false)
    const full = await loadFullMemo(memo.id)
    setFullMemo({ content: full.content })
    setEditingMemo(memo.id)
  }

  const handleEditDone = async (): Promise<void> => {
    setEditingMemo(null)
    // Force re-read from cache (updated by store's updateMemo)
    const full = await loadFullMemo(memo.id)
    setFullMemo({ content: full.content })
  }

  const handleDelete = async (): Promise<void> => {
    setShowMenu(false)
    await deleteMemo(memo.id)
  }

  const handleHistory = (): void => {
    setShowMenu(false)
    openHistoryDialog(memo.id)
  }

  if (isEditing && fullMemo) {
    return (
      <div className="py-2">
        <MemoEditor
          memoId={memo.id}
          initialContent={fullMemo.content}
          onCancel={handleEditDone}
        />
      </div>
    )
  }

  return (
    <div ref={cardRef} className="group relative py-4 border-b border-border/40 last:border-0 transition-colors duration-500">
      {/* Content */}
      <div className="pr-8">
        {fullMemo ? (
          <MemoCardContent content={fullMemo.content} />
        ) : (
          <p className="text-sm text-foreground/80 leading-relaxed">{memo.plainTextPreview}</p>
        )}
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between mt-2.5">
        <span className="text-[11px] text-muted-foreground/50 tabular-nums">{timeDisplay}</span>
        {memo.wordCount > 0 && (
          <span className="text-[11px] text-muted-foreground/30 tabular-nums">
            {memo.wordCount} 字
          </span>
        )}
      </div>

      {/* Action menu */}
      <div className="absolute top-4 right-0">
        <button
          onClick={() => setShowMenu(!showMenu)}
          className={cn(
            'p-1 rounded transition-all',
            showMenu
              ? 'opacity-100 bg-accent'
              : 'opacity-0 group-hover:opacity-100 hover:bg-accent'
          )}
        >
          <MoreHorizontal size={15} className="text-muted-foreground" />
        </button>

        {showMenu && (
          <>
            <div className="fixed inset-0 z-10" onClick={() => setShowMenu(false)} />
            <div className="absolute right-0 top-8 z-20 w-32 bg-popover border border-border rounded-lg shadow-lg py-1">
              <button
                onClick={handleEdit}
                className="w-full flex items-center gap-2 px-3 py-1.5 text-[13px] text-foreground/80 hover:bg-accent transition-colors"
              >
                <Pencil size={13} />
                编辑
              </button>
              <button
                onClick={handleHistory}
                className="w-full flex items-center gap-2 px-3 py-1.5 text-[13px] text-foreground/80 hover:bg-accent transition-colors"
              >
                <History size={13} />
                历史版本
              </button>
              <div className="h-px bg-border/60 my-1" />
              <button
                onClick={handleDelete}
                className="w-full flex items-center gap-2 px-3 py-1.5 text-[13px] text-destructive hover:bg-destructive/10 transition-colors"
              >
                <Trash2 size={13} />
                删除
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

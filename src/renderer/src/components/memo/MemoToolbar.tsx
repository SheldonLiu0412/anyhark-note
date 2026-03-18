import { useEffect, useState } from 'react'
import { Bold, Highlighter, Underline, List, ListOrdered, ImagePlus } from 'lucide-react'
import { cn } from '@renderer/lib/utils'
import type { Editor } from '@tiptap/react'

interface MemoToolbarProps {
  editor: Editor | null
  onImageUpload?: () => void
  imagesFull?: boolean
}

export function MemoToolbar({ editor, onImageUpload, imagesFull }: MemoToolbarProps): React.JSX.Element | null {
  const [, setTick] = useState(0)

  useEffect(() => {
    if (!editor) return
    const handler = (): void => setTick((n) => n + 1)
    editor.on('transaction', handler)
    return () => {
      editor.off('transaction', handler)
    }
  }, [editor])

  if (!editor) return null

  const hasSelection = !editor.state.selection.empty

  const tools = [
    {
      icon: Bold,
      label: '加粗',
      action: () => {
        if (!hasSelection) return
        editor.chain().focus().toggleBold().run()
      },
      isActive: editor.isActive('bold')
    },
    {
      icon: Highlighter,
      label: '高亮',
      action: () => {
        if (!hasSelection) return
        editor.chain().focus().toggleHighlight().run()
      },
      isActive: editor.isActive('highlight')
    },
    {
      icon: Underline,
      label: '下划线',
      action: () => {
        if (!hasSelection) return
        editor.chain().focus().toggleUnderline().run()
      },
      isActive: editor.isActive('underline')
    },
    { type: 'divider' as const },
    {
      icon: List,
      label: '无序列表',
      action: () => editor.chain().focus().toggleBulletList().run(),
      isActive: editor.isActive('bulletList')
    },
    {
      icon: ListOrdered,
      label: '有序列表',
      action: () => editor.chain().focus().toggleOrderedList().run(),
      isActive: editor.isActive('orderedList')
    },
    { type: 'divider' as const },
    {
      icon: ImagePlus,
      label: '插入图片',
      action: () => onImageUpload?.(),
      isActive: false,
      dimmed: imagesFull
    }
  ]

  return (
    <div className="flex items-center gap-0.5 py-1.5">
      {tools.map((tool, i) => {
        if ('type' in tool && tool.type === 'divider') {
          return (
            <div key={`d-${i}`} className="w-px h-4 bg-border/60 mx-1" />
          )
        }
        const t = tool as { icon: typeof Bold; label: string; action: () => void; isActive: boolean; dimmed?: boolean }
        return (
          <button
            key={t.label}
            title={t.label}
            onClick={(e) => {
              e.preventDefault()
              t.action()
            }}
            className={cn(
              'p-1.5 rounded transition-colors',
              t.isActive
                ? 'bg-accent text-foreground'
                : t.dimmed
                  ? 'text-muted-foreground/25 cursor-default'
                  : 'text-muted-foreground/50 hover:text-foreground/70 hover:bg-accent/50'
            )}
          >
            <t.icon size={15} strokeWidth={t.isActive ? 2.5 : 2} />
          </button>
        )
      })}
    </div>
  )
}

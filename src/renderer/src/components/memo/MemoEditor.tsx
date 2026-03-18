import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import UnderlineExt from '@tiptap/extension-underline'
import HighlightExt from '@tiptap/extension-highlight'
import ImageExt from '@tiptap/extension-image'
import Placeholder from '@tiptap/extension-placeholder'
import { TagNode } from '@renderer/extensions/tag-node'
import { MentionNoteMark, MentionLinkMark } from '@renderer/extensions/mention-node'
import { MemoToolbar } from './MemoToolbar'
import { EditableImageGallery } from './ImageGallery'
import type { ImageItem } from './ImageGallery'
import { useMemoStore } from '@renderer/stores/memo.store'
import { Search, FileText, Link, X } from 'lucide-react'
import type { TipTapDocument, TipTapMark, TipTapNode, MemoMeta } from '@shared/types'
import '@renderer/styles/editor.css'

const MAX_IMAGES = 9

function extractPlainText(doc: TipTapDocument): string {
  const parts: string[] = []
  function walk(node: TipTapNode): void {
    if (node.text) parts.push(node.text)
    if (node.type === 'tag' && node.attrs?.label) parts.push(String(node.attrs.label))
    if (node.content) node.content.forEach(walk)
  }
  doc.content.forEach(walk)
  return parts.join('').trim()
}

function extractTags(doc: TipTapDocument): string[] {
  const tags = new Set<string>()
  function walk(node: TipTapNode): void {
    // From tag nodes
    if (node.type === 'tag' && node.attrs?.path) tags.add(String(node.attrs.path))
    // From plain text: match #word patterns
    if (node.text) {
      const regex = /#([^\s#]+)/g
      let match
      while ((match = regex.exec(node.text)) !== null) {
        tags.add(match[1])
      }
    }
    if (node.content) node.content.forEach(walk)
  }
  doc.content.forEach(walk)
  return [...tags]
}

/** Extract image items from a TipTap document */
function extractImageItems(doc: TipTapDocument): ImageItem[] {
  const items: ImageItem[] = []
  function walk(node: TipTapNode): void {
    if (node.type === 'image' && node.attrs?.src) {
      const src = String(node.attrs.src)
      const match = src.match(/anyhark-image:\/\/(.+)/)
      if (match) items.push({ filename: match[1], src })
    }
    if (node.content) node.content.forEach(walk)
  }
  doc.content.forEach(walk)
  return items
}

/** Convert remaining #tag text patterns to tag nodes so they render as styled tags */
function ensureTagNodes(doc: TipTapDocument): TipTapDocument {
  return { type: 'doc', content: processContent(doc.content) }
}

function processContent(nodes: TipTapNode[]): TipTapNode[] {
  const result: TipTapNode[] = []
  for (const node of nodes) {
    if (node.type === 'text' && node.text && /#[^\s#]+/.test(node.text)) {
      result.push(...splitTextWithTags(node.text, node.marks))
    } else if (node.content) {
      result.push({ ...node, content: processContent(node.content) })
    } else {
      result.push(node)
    }
  }
  return result
}

function splitTextWithTags(text: string, marks?: TipTapMark[]): TipTapNode[] {
  const regex = /#([^\s#]+)/g
  const result: TipTapNode[] = []
  let lastIndex = 0
  let match
  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      const seg = text.slice(lastIndex, match.index)
      result.push(marks ? { type: 'text', text: seg, marks } : { type: 'text', text: seg })
    }
    result.push({ type: 'tag', attrs: { path: match[1], label: `#${match[1]}` } })
    lastIndex = regex.lastIndex
  }
  if (lastIndex < text.length) {
    const seg = text.slice(lastIndex)
    result.push(marks ? { type: 'text', text: seg, marks } : { type: 'text', text: seg })
  }
  return result
}

/** Remove all image nodes from a TipTap document */
function stripImages(doc: TipTapDocument): TipTapDocument {
  function filterNodes(nodes: TipTapNode[]): TipTapNode[] {
    return nodes
      .filter((n) => n.type !== 'image')
      .map((n) => (n.content ? { ...n, content: filterNodes(n.content) } : n))
  }
  return { type: 'doc', content: filterNodes(doc.content) }
}

interface MentionCoords {
  left: number
  top: number
}

function MentionOptionsPopup({
  coords,
  onSelectNote,
  onSelectLink,
  onClose
}: {
  coords: MentionCoords
  onSelectNote: () => void
  onSelectLink: () => void
  onClose: () => void
}): React.JSX.Element {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handler = (e: MouseEvent): void => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose()
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [onClose])

  return (
    <div ref={ref} className="mention-popup" style={{ position: 'fixed', left: coords.left, top: coords.top, zIndex: 50 }}>
      <button className="mention-popup-item" onClick={onSelectNote}>
        <FileText size={14} className="text-blue-500 opacity-70" />
        <span>笔记</span>
      </button>
      <button className="mention-popup-item" onClick={onSelectLink}>
        <Link size={14} className="text-blue-500 opacity-70" />
        <span>网址</span>
      </button>
    </div>
  )
}

function NoteSearchPopup({
  coords,
  memos,
  onSelect,
  onClose
}: {
  coords: MentionCoords
  memos: MemoMeta[]
  onSelect: (memo: MemoMeta) => void
  onClose: () => void
}): React.JSX.Element {
  const [query, setQuery] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => { inputRef.current?.focus() }, [])

  useEffect(() => {
    const handler = (e: MouseEvent): void => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose()
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [onClose])

  const filtered = useMemo(() => {
    if (!query.trim()) return memos.slice(0, 8)
    const kw = query.toLowerCase()
    return memos.filter((m) => m.plainTextPreview.toLowerCase().includes(kw)).slice(0, 8)
  }, [query, memos])

  return (
    <div
      ref={ref}
      className="bg-popover border border-border rounded-xl shadow-2xl overflow-hidden"
      style={{ position: 'fixed', left: coords.left, top: coords.top, zIndex: 50, width: 320 }}
    >
      <div className="flex items-center gap-2 px-3 h-9 border-b border-border/60">
        <Search size={13} className="text-muted-foreground/40" />
        <input
          ref={inputRef}
          type="text"
          placeholder="搜索笔记..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="flex-1 bg-transparent text-[13px] outline-none placeholder:text-muted-foreground/40"
        />
        <button onClick={onClose} className="text-muted-foreground/40 hover:text-muted-foreground">
          <X size={12} />
        </button>
      </div>
      <div className="max-h-[200px] overflow-y-auto py-1">
        {filtered.length === 0 ? (
          <div className="px-3 py-4 text-center text-[12px] text-muted-foreground/40">无匹配笔记</div>
        ) : (
          filtered.map((m) => (
            <button
              key={m.id}
              onClick={() => onSelect(m)}
              className="w-full text-left px-3 py-1.5 text-[13px] text-foreground/80 hover:bg-accent/50 transition-colors truncate"
            >
              {m.plainTextPreview || '（空白笔记）'}
            </button>
          ))
        )}
      </div>
    </div>
  )
}

function LinkFormPopup({
  coords,
  onSubmit,
  onClose
}: {
  coords: MentionCoords
  onSubmit: (url: string, label: string) => void
  onClose: () => void
}): React.JSX.Element {
  const [url, setUrl] = useState('')
  const [label, setLabel] = useState('')
  const urlRef = useRef<HTMLInputElement>(null)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => { urlRef.current?.focus() }, [])

  useEffect(() => {
    const handler = (e: MouseEvent): void => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose()
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [onClose])

  const handleSubmit = (): void => {
    if (!url.trim()) return
    onSubmit(url.trim(), label.trim().slice(0, 20) || url.trim().slice(0, 20))
  }

  return (
    <div
      ref={ref}
      className="bg-popover border border-border rounded-xl shadow-2xl overflow-hidden"
      style={{ position: 'fixed', left: coords.left, top: coords.top, zIndex: 50, width: 300 }}
    >
      <div className="px-3 pt-3 pb-2 space-y-2">
        <input
          ref={urlRef}
          type="text"
          placeholder="输入网址链接"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
          className="w-full bg-muted/50 border border-border/60 rounded-lg px-2.5 py-1.5 text-[13px] outline-none focus:border-primary/50 transition-colors"
        />
        <input
          type="text"
          placeholder="显示名称（最多20字）"
          value={label}
          maxLength={20}
          onChange={(e) => setLabel(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
          className="w-full bg-muted/50 border border-border/60 rounded-lg px-2.5 py-1.5 text-[13px] outline-none focus:border-primary/50 transition-colors"
        />
      </div>
      <div className="flex justify-end gap-2 px-3 pb-2.5">
        <button onClick={onClose} className="px-2.5 py-1 text-[12px] text-muted-foreground hover:text-foreground rounded-md transition-colors">
          取消
        </button>
        <button
          onClick={handleSubmit}
          className="px-3 py-1 text-[12px] font-medium rounded-md bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
        >
          插入
        </button>
      </div>
    </div>
  )
}

interface MemoEditorProps {
  memoId?: string
  initialContent?: TipTapDocument
  onCancel?: () => void
}

export function MemoEditor({ memoId, initialContent, onCancel }: MemoEditorProps): React.JSX.Element {
  const createMemo = useMemoStore((s) => s.createMemo)
  const updateMemo = useMemoStore((s) => s.updateMemo)
  const deleteMemo = useMemoStore((s) => s.deleteMemo)
  const allMemos = useMemoStore((s) => s.memos)
  const isSubmitting = useRef(false)
  const isEditMode = !!memoId

  type MentionState =
    | { type: 'options'; pos: number; coords: MentionCoords }
    | { type: 'note-search'; pos: number; coords: MentionCoords }
    | { type: 'link-form'; pos: number; coords: MentionCoords }
    | null
  const [mentionState, setMentionState] = useState<MentionState>(null)
  const mentionHandlerRef = useRef<(from: number, coords: MentionCoords) => void>()
  mentionHandlerRef.current = (from, coords) => {
    setMentionState({ type: 'options', pos: from, coords })
  }

  // Separate images from editor content
  const { textContent, initialImages } = useMemo(() => {
    if (!initialContent) return { textContent: undefined, initialImages: [] }
    return {
      textContent: stripImages(initialContent),
      initialImages: extractImageItems(initialContent)
    }
  }, [initialContent])

  const [images, setImages] = useState<ImageItem[]>(initialImages)

  const editor = useEditor({
    extensions: [
      StarterKit.configure({ heading: false }),
      UnderlineExt,
      HighlightExt.configure({ multicolor: false }),
      ImageExt.configure({ inline: false, allowBase64: false }),
      TagNode,
      MentionNoteMark,
      MentionLinkMark,
      Placeholder.configure({
        placeholder: '听见此刻的想法...',
        emptyEditorClass: 'is-editor-empty'
      })
    ],
    content: textContent || undefined,
    editorProps: {
      attributes: {
        class: 'outline-none min-h-[60px]'
      },
      handleTextInput: (view, from, _to, text) => {
        if (text === '@') {
          setTimeout(() => {
            const coords = view.coordsAtPos(from + 1)
            mentionHandlerRef.current?.(from, { left: coords.left, top: coords.bottom + 4 })
          }, 0)
        }
        return false
      }
    }
  })

  useEffect(() => {
    if (!editor) return
    const handler = (): void => {
      setMentionState((prev) => {
        if (!prev || prev.type !== 'options') return prev
        const { from } = editor.state.selection
        const textBefore = editor.state.doc.textBetween(Math.max(0, from - 1), from)
        if (textBefore !== '@') return null
        return prev
      })
    }
    editor.on('transaction', handler)
    return () => { editor.off('transaction', handler) }
  }, [editor])

  const handleImageUpload = useCallback(() => {
    if (images.length >= MAX_IMAGES) return
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = 'image/*'
    input.onchange = async () => {
      const file = input.files?.[0]
      if (!file) return
      const reader = new FileReader()
      reader.onload = async () => {
        const base64 = (reader.result as string).split(',')[1]
        try {
          const { filename } = await window.api.image.save({
            data: base64,
            filename: file.name,
            mimeType: file.type
          })
          setImages((prev) => {
            if (prev.length >= MAX_IMAGES) return prev
            return [...prev, { filename, src: `anyhark-image://${filename}` }]
          })
        } catch (err) {
          console.error('Failed to save image:', err)
        }
      }
      reader.readAsDataURL(file)
    }
    input.click()
  }, [images.length])

  const handleImageDelete = useCallback((filename: string) => {
    setImages((prev) => prev.filter((img) => img.filename !== filename))
  }, [])

  const handleSubmit = useCallback(async () => {
    if (!editor || isSubmitting.current) return
    const json = editor.getJSON() as TipTapDocument
    const plainText = extractPlainText(json)
    const hasContent = plainText.trim().length > 0 || images.length > 0

    if (!hasContent) {
      if (isEditMode && memoId) {
        await deleteMemo(memoId)
        onCancel?.()
      }
      return
    }

    isSubmitting.current = true
    try {
      const normalized = ensureTagNodes(json)
      const tags = extractTags(normalized)
      const imageFilenames = images.map((img) => img.filename)

      const imageNodes: TipTapNode[] = images.map((img) => ({
        type: 'image',
        attrs: { src: img.src }
      }))
      const fullContent: TipTapDocument = {
        type: 'doc',
        content: [...normalized.content, ...imageNodes]
      }

      if (isEditMode && memoId) {
        await updateMemo({ id: memoId, content: fullContent, plainText, tags, images: imageFilenames })
        onCancel?.()
      } else {
        await createMemo({ content: fullContent, plainText, tags, images: imageFilenames })
        editor.commands.clearContent()
        setImages([])
      }
    } finally {
      isSubmitting.current = false
    }
  }, [editor, memoId, isEditMode, images, createMemo, updateMemo, deleteMemo, onCancel])

  const closeMention = useCallback(() => setMentionState(null), [])

  const handleMentionFromToolbar = useCallback(() => {
    if (!editor) return
    const { from } = editor.state.selection
    const coords = editor.view.coordsAtPos(from)
    setMentionState({ type: 'options', pos: from, coords: { left: coords.left, top: coords.bottom + 4 } })
  }, [editor])

  const deleteMentionAtChar = useCallback(() => {
    if (!editor || !mentionState) return
    const { from, to } = editor.state.selection
    const textBefore = editor.state.doc.textBetween(Math.max(0, from - 1), from)
    if (textBefore === '@') {
      editor.chain().focus().deleteRange({ from: from - 1, to }).run()
    }
  }, [editor, mentionState])

  const handleMentionNote = useCallback(() => {
    if (!mentionState) return
    setMentionState({ ...mentionState, type: 'note-search' })
  }, [mentionState])

  const handleMentionLink = useCallback(() => {
    if (!mentionState) return
    setMentionState({ ...mentionState, type: 'link-form' })
  }, [mentionState])

  const handleNoteSelect = useCallback(
    (memo: MemoMeta) => {
      if (!editor) return
      deleteMentionAtChar()
      editor
        .chain()
        .focus()
        .insertContent({
          type: 'text',
          text: '@Note',
          marks: [{ type: 'mention-note', attrs: { memoId: memo.id } }]
        })
        .insertContent(' ')
        .run()
      setMentionState(null)
    },
    [editor, deleteMentionAtChar]
  )

  const handleLinkSubmit = useCallback(
    (url: string, displayLabel: string) => {
      if (!editor) return
      deleteMentionAtChar()
      editor
        .chain()
        .focus()
        .insertContent({
          type: 'text',
          text: `🔗 ${displayLabel}`,
          marks: [{ type: 'mention-link', attrs: { url } }]
        })
        .insertContent(' ')
        .run()
      setMentionState(null)
    },
    [editor, deleteMentionAtChar]
  )

  return (
    <div className="rounded-xl border border-border/70 bg-card shadow-sm overflow-hidden transition-shadow focus-within:shadow-md focus-within:border-border">
      <div className="tiptap-editor px-4 pt-3 pb-1">
        <EditorContent editor={editor} />
      </div>
      {images.length > 0 && (
        <div className="px-4 pb-2">
          <EditableImageGallery images={images} onDelete={handleImageDelete} />
        </div>
      )}
      <div className="flex items-center justify-between px-3 pb-2">
        <MemoToolbar
          editor={editor}
          onImageUpload={handleImageUpload}
          onMention={handleMentionFromToolbar}
          imagesFull={images.length >= MAX_IMAGES}
        />
        <div className="flex items-center gap-2">
          {isEditMode && (
            <button
              onClick={onCancel}
              className="px-3 py-1 text-[13px] text-muted-foreground hover:text-foreground rounded-md transition-colors"
            >
              取消
            </button>
          )}
          <button
            onClick={handleSubmit}
            className="px-4 py-1.5 text-[13px] font-medium rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
          >
            {isEditMode ? '保存' : '记录'}
          </button>
        </div>
      </div>

      {mentionState?.type === 'options' && (
        <MentionOptionsPopup
          coords={mentionState.coords}
          onSelectNote={handleMentionNote}
          onSelectLink={handleMentionLink}
          onClose={closeMention}
        />
      )}
      {mentionState?.type === 'note-search' && (
        <NoteSearchPopup
          coords={mentionState.coords}
          memos={allMemos}
          onSelect={handleNoteSelect}
          onClose={closeMention}
        />
      )}
      {mentionState?.type === 'link-form' && (
        <LinkFormPopup
          coords={mentionState.coords}
          onSubmit={handleLinkSubmit}
          onClose={closeMention}
        />
      )}
    </div>
  )
}

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useEditor, EditorContent } from '@tiptap/react'
import { TextSelection } from '@tiptap/pm/state'
import StarterKit from '@tiptap/starter-kit'
import UnderlineExt from '@tiptap/extension-underline'
import HighlightExt from '@tiptap/extension-highlight'
import { CustomImage } from '@renderer/extensions/image-node'
import Placeholder from '@tiptap/extension-placeholder'
import { TagNode } from '@renderer/extensions/tag-node'
import { MentionNoteMark, MentionLinkMark, migrateMentionNodes } from '@renderer/extensions/mention-node'
import { useMemoStore } from '@renderer/stores/memo.store'
import { useUIStore } from '@renderer/stores/ui.store'
import { useSearchStore } from '@renderer/stores/search.store'
import { useTagStore } from '@renderer/stores/tag.store'
import { SearchDialog } from '@renderer/components/search/SearchDialog'
import {
  Bold,
  Highlighter,
  Underline,
  List,
  ListOrdered,
  ImagePlus,
  AtSign,
  Plus,
  Trash2,
  History,
  FileText,
  Link
} from 'lucide-react'
import { cn } from '@renderer/lib/utils'
import { format } from 'date-fns'
import { zhCN } from 'date-fns/locale'
import type {
  TipTapDocument,
  TipTapMark,
  TipTapNode,
  Memo,
  MemoMeta
} from '@shared/types'
import '@renderer/styles/editor.css'

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
    if (node.type === 'tag' && node.attrs?.path) tags.add(String(node.attrs.path))
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

function extractImageFilenames(doc: TipTapDocument): string[] {
  const filenames: string[] = []
  function walk(node: TipTapNode): void {
    if (node.type === 'image' && node.attrs?.src) {
      const src = String(node.attrs.src)
      const match = src.match(/anyhark-image:\/\/(.+)/)
      if (match) filenames.push(match[1])
    }
    if (node.content) node.content.forEach(walk)
  }
  doc.content.forEach(walk)
  return filenames
}

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

async function saveImageFromFile(file: File): Promise<string | null> {
  return new Promise((resolve) => {
    const reader = new FileReader()
    reader.onload = async () => {
      const base64 = (reader.result as string).split(',')[1]
      try {
        const { filename } = await window.api.image.save({
          data: base64,
          filename: file.name,
          mimeType: file.type
        })
        resolve(filename)
      } catch {
        resolve(null)
      }
    }
    reader.readAsDataURL(file)
  })
}

interface MentionCoords {
  left: number
  top: number
}

function MentionAutocomplete({
  editor,
  atPos,
  coords,
  memos,
  onSelectNote,
  onSelectLink,
  onClose
}: {
  editor: ReturnType<typeof useEditor>
  atPos: number
  coords: MentionCoords
  memos: MemoMeta[]
  onSelectNote: (memo: MemoMeta) => void
  onSelectLink: () => void
  onClose: () => void
}): React.JSX.Element {
  const [query, setQuery] = useState('')
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!editor) return
    const update = (): void => {
      try {
        const cursorPos = editor.state.selection.from
        if (cursorPos <= atPos) {
          onClose()
          return
        }
        const text = editor.state.doc.textBetween(atPos + 1, cursorPos)
        setQuery(text)
      } catch {
        onClose()
      }
    }
    editor.on('selectionUpdate', update)
    editor.on('update', update)
    update()
    return () => {
      editor.off('selectionUpdate', update)
      editor.off('update', update)
    }
  }, [editor, atPos, onClose])

  useEffect(() => {
    const handler = (e: MouseEvent): void => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose()
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [onClose])

  const filtered = useMemo(() => {
    if (!query.trim()) return memos.slice(0, 6)
    const kw = query.toLowerCase()
    return memos
      .filter(
        (m) =>
          m.plainTextPreview.toLowerCase().includes(kw) ||
          m.tags.some((t) => t.toLowerCase().includes(kw))
      )
      .slice(0, 6)
  }, [query, memos])

  return (
    <div
      ref={ref}
      className="bg-popover border border-border rounded-xl shadow-2xl overflow-hidden"
      style={{ position: 'fixed', left: coords.left, top: coords.top, zIndex: 50, width: 280 }}
    >
      <div className="max-h-[200px] overflow-y-auto py-1">
        {filtered.map((m) => (
          <button
            key={m.id}
            onMouseDown={(e) => {
              e.preventDefault()
              onSelectNote(m)
            }}
            className="w-full text-left px-3 py-1.5 text-[13px] text-foreground/80 hover:bg-accent/50 transition-colors truncate"
          >
            {m.plainTextPreview || '（空白笔记）'}
          </button>
        ))}
        {query && filtered.length === 0 && (
          <div className="px-3 py-3 text-center text-[12px] text-muted-foreground/40">无匹配笔记</div>
        )}
      </div>
      <div className="border-t border-border/40 p-1">
        <button
          onMouseDown={(e) => {
            e.preventDefault()
            onSelectLink()
          }}
          className="w-full flex items-center gap-2 px-3 py-1.5 text-[13px] text-muted-foreground hover:bg-accent/50 rounded-md transition-colors"
        >
          <Link size={13} />
          <span>插入网址</span>
        </button>
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
          onKeyDown={(e) => { if (e.key === 'Enter' && !e.nativeEvent.isComposing) handleSubmit() }}
          className="w-full bg-muted/50 border border-border/60 rounded-lg px-2.5 py-1.5 text-[13px] outline-none focus:border-primary/50 transition-colors"
        />
        <input
          type="text"
          placeholder="显示名称（最多20字）"
          value={label}
          maxLength={20}
          onChange={(e) => setLabel(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter' && !e.nativeEvent.isComposing) handleSubmit() }}
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

const AUTOSAVE_DELAY = 1500

export function NoteDetailPanel(): React.JSX.Element {
  const selectedMemoId = useUIStore((s) => s.selectedMemoId)
  const setSelectedMemoId = useUIStore((s) => s.setSelectedMemoId)
  const openHistoryDialog = useUIStore((s) => s.openHistoryDialog)
  const updateMemo = useMemoStore((s) => s.updateMemo)
  const deleteMemo = useMemoStore((s) => s.deleteMemo)
  const createMemo = useMemoStore((s) => s.createMemo)
  const loadFullMemo = useMemoStore((s) => s.loadFullMemo)
  const selectTag = useTagStore((s) => s.selectTag)
  const allMemos = useMemoStore((s) => s.memos)
  const isSearchDialogOpen = useSearchStore((s) => s.isSearchDialogOpen)

  const [fullMemo, setFullMemo] = useState<Memo | null>(null)
  const saveTimerRef = useRef<ReturnType<typeof setTimeout>>(undefined)
  const pendingSaveRef = useRef<{ id: string; json: TipTapDocument } | null>(null)
  const currentMemoIdRef = useRef<string | null>(null)
  const skipNextUpdateRef = useRef(false)
  const lastKnownUpdatedAtRef = useRef<string>('')

  type MentionState =
    | { type: 'autocomplete'; pos: number; coords: MentionCoords }
    | { type: 'link-form'; pos: number; coords: MentionCoords }
    | null
  const [mentionState, setMentionState] = useState<MentionState>(null)
  const mentionStateRef = useRef<MentionState>(null)
  mentionStateRef.current = mentionState
  const mentionHandlerRef = useRef<(from: number, coords: MentionCoords) => void>(undefined)

  const editor = useEditor({
    extensions: [
      StarterKit.configure({ heading: false }),
      UnderlineExt,
      HighlightExt.configure({ multicolor: false }),
      CustomImage.configure({ inline: false, allowBase64: false }),
      TagNode,
      MentionNoteMark,
      MentionLinkMark,
      Placeholder.configure({
        placeholder: '开始写点什么...',
        emptyEditorClass: 'is-editor-empty'
      })
    ],
    editorProps: {
      attributes: {
        class: 'outline-none min-h-[200px]'
      },
      handleTextInput: (view, from, _to, text) => {
        if (text === '@') {
          setTimeout(() => {
            const coords = view.coordsAtPos(from + 1)
            mentionHandlerRef.current?.(from, { left: coords.left, top: coords.bottom + 4 })
          }, 0)
        }
        return false
      },
      handleKeyDown: (_view, event) => {
        if (mentionStateRef.current?.type === 'autocomplete' && event.key === 'Escape') {
          setMentionState(null)
          return true
        }
        return false
      },
      handlePaste: (view, event) => {
        const items = event.clipboardData?.items
        if (!items) return false
        for (const item of items) {
          if (item.type.startsWith('image/')) {
            event.preventDefault()
            const file = item.getAsFile()
            if (!file) return true
            saveImageFromFile(file).then((filename) => {
              if (filename) {
                view.dispatch(
                  view.state.tr.replaceSelectionWith(
                    view.state.schema.nodes.image.create({
                      src: `anyhark-image://${filename}`
                    })
                  )
                )
              }
            })
            return true
          }
        }
        return false
      },
      handleDrop: (view, event) => {
        const files = event.dataTransfer?.files
        if (!files || files.length === 0) return false
        const imageFiles = Array.from(files).filter((f) => f.type.startsWith('image/'))
        if (imageFiles.length === 0) return false
        event.preventDefault()
        const pos = view.posAtCoords({ left: event.clientX, top: event.clientY })
        for (const file of imageFiles) {
          saveImageFromFile(file).then((filename) => {
            if (filename) {
              const insertPos = pos?.pos ?? view.state.doc.content.size
              view.dispatch(
                view.state.tr.insert(
                  insertPos,
                  view.state.schema.nodes.image.create({
                    src: `anyhark-image://${filename}`
                  })
                )
              )
            }
          })
        }
        return true
      }
    }
  })

  mentionHandlerRef.current = (from, coords) => {
    setMentionState({ type: 'autocomplete', pos: from, coords })
  }

  useEffect(() => {
    if (!mentionState || !editor) return
    const scrollEl = editor.view.dom.closest('.overflow-y-auto')
    if (!scrollEl) return
    const onScroll = (): void => {
      try {
        const pos = Math.min(mentionState.pos + 1, editor.state.doc.content.size)
        const coords = editor.view.coordsAtPos(pos)
        setMentionState((prev) =>
          prev ? { ...prev, coords: { left: coords.left, top: coords.bottom + 4 } } : null
        )
      } catch {
        /* position may be invalid after edits */
      }
    }
    scrollEl.addEventListener('scroll', onScroll, { passive: true })
    return () => scrollEl.removeEventListener('scroll', onScroll)
  }, [mentionState?.pos, mentionState?.type, editor])

  // Flush pending save
  const flushSave = useCallback(async () => {
    clearTimeout(saveTimerRef.current)
    const pending = pendingSaveRef.current
    if (!pending) return
    const normalized = ensureTagNodes(pending.json)
    const plainText = extractPlainText(normalized)
    const tags = extractTags(normalized)
    const images = extractImageFilenames(normalized)
    const updated = await updateMemo({
      id: pending.id,
      content: normalized,
      plainText,
      tags,
      images
    })
    lastKnownUpdatedAtRef.current = updated.updatedAt
    pendingSaveRef.current = null
  }, [updateMemo])

  // Schedule auto-save
  const scheduleSave = useCallback(
    (id: string, json: TipTapDocument) => {
      pendingSaveRef.current = { id, json }
      clearTimeout(saveTimerRef.current)
      saveTimerRef.current = setTimeout(() => {
        flushSave()
      }, AUTOSAVE_DELAY)
    },
    [flushSave]
  )

  // Editor update handler for auto-save
  useEffect(() => {
    if (!editor) return
    const handler = (): void => {
      if (skipNextUpdateRef.current) {
        skipNextUpdateRef.current = false
        return
      }
      const id = currentMemoIdRef.current
      if (!id) return
      const json = editor.getJSON() as TipTapDocument
      scheduleSave(id, json)
    }
    editor.on('update', handler)
    return () => { editor.off('update', handler) }
  }, [editor, scheduleSave])

  // Handle @ mention dismiss
  useEffect(() => {
    if (!editor) return
    const handler = (): void => {
      setMentionState((prev) => {
        if (!prev || prev.type !== 'autocomplete') return prev
        const { from } = editor.state.selection
        if (from <= prev.pos) return null
        return prev
      })
    }
    editor.on('transaction', handler)
    return () => { editor.off('transaction', handler) }
  }, [editor])

  // Detect external updates (e.g. history restore) for the currently selected memo
  const selectedMemoMeta = useMemo(
    () => allMemos.find((m) => m.id === selectedMemoId),
    [allMemos, selectedMemoId]
  )
  const metaUpdatedAt = selectedMemoMeta?.updatedAt ?? 0

  // Load memo when selection changes or external update detected
  useEffect(() => {
    if (!selectedMemoId || !editor) return

    const isSwitch = currentMemoIdRef.current !== selectedMemoId
    const isExternalUpdate =
      !isSwitch &&
      currentMemoIdRef.current === selectedMemoId &&
      metaUpdatedAt > lastKnownUpdatedAtRef.current &&
      !pendingSaveRef.current

    if (!isSwitch && !isExternalUpdate) return

    const loadMemo = async (): Promise<void> => {
      if (isSwitch) await flushSave()
      currentMemoIdRef.current = selectedMemoId
      try {
        const memo = await loadFullMemo(selectedMemoId)
        setFullMemo(memo)
        lastKnownUpdatedAtRef.current = memo.updatedAt
        skipNextUpdateRef.current = true
        editor.commands.setContent(migrateMentionNodes(memo.content))
        if (isSwitch) editor.commands.focus('end')
      } catch {
        setFullMemo(null)
        currentMemoIdRef.current = null
      }
    }
    loadMemo()
  }, [selectedMemoId, editor, loadFullMemo, flushSave, metaUpdatedAt])

  // Flush save on unmount
  useEffect(() => {
    return () => {
      clearTimeout(saveTimerRef.current)
      const pending = pendingSaveRef.current
      if (pending) {
        pendingSaveRef.current = null
        const normalized = ensureTagNodes(pending.json)
        const plainText = extractPlainText(normalized)
        const tags = extractTags(normalized)
        const images = extractImageFilenames(normalized)
        useMemoStore.getState().updateMemo({
          id: pending.id,
          content: normalized,
          plainText,
          tags,
          images
        })
      }
    }
  }, [])

  const handleNewMemo = useCallback(async () => {
    await flushSave()
    selectTag(null)
    const memo = await createMemo({
      content: { type: 'doc', content: [{ type: 'paragraph' }] },
      plainText: '',
      tags: [],
      images: []
    })
    setSelectedMemoId(memo.id)
  }, [flushSave, createMemo, setSelectedMemoId, selectTag])

  const handleDelete = useCallback(async () => {
    if (!selectedMemoId) return
    clearTimeout(saveTimerRef.current)
    pendingSaveRef.current = null
    await deleteMemo(selectedMemoId)
    currentMemoIdRef.current = null
    setFullMemo(null)
    const remaining = useMemoStore.getState().memos
    if (remaining.length > 0) {
      setSelectedMemoId(remaining[0].id)
    } else {
      setSelectedMemoId(null)
    }
  }, [selectedMemoId, deleteMemo, setSelectedMemoId])

  const handleHistory = useCallback(() => {
    if (!selectedMemoId) return
    openHistoryDialog(selectedMemoId)
  }, [selectedMemoId, openHistoryDialog])

  const handleImageUpload = useCallback(() => {
    if (!editor) return
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = 'image/*'
    input.multiple = true
    input.onchange = async () => {
      const files = input.files
      if (!files) return
      for (const file of Array.from(files)) {
        const filename = await saveImageFromFile(file)
        if (filename) {
          editor.chain().focus().setImage({ src: `anyhark-image://${filename}` }).run()
        }
      }
    }
    input.click()
  }, [editor])

  const handleMentionFromToolbar = useCallback(() => {
    if (!editor) return
    const { from } = editor.state.selection
    editor.chain().focus().insertContent('@').run()
    setTimeout(() => {
      const coords = editor.view.coordsAtPos(from + 1)
      setMentionState({ type: 'autocomplete', pos: from, coords: { left: coords.left, top: coords.bottom + 4 } })
    }, 0)
  }, [editor])

  const closeMention = useCallback(() => setMentionState(null), [])

  const handleMentionLink = useCallback(() => {
    if (!mentionState || !editor) return
    const { pos, coords } = mentionState
    setMentionState(null)
    setTimeout(() => {
      setMentionState({ type: 'link-form', pos, coords })
    }, 0)
  }, [editor, mentionState])

  const handleNoteSelect = useCallback(
    (memo: MemoMeta) => {
      if (!editor || !mentionState) return
      const atPos = mentionState.pos
      const cursorPos = editor.state.selection.from
      const deleteEnd = Math.max(atPos + 1, cursorPos)

      const raw = (memo.plainTextPreview || '').trim()
      const tagPart = memo.tags?.length
        ? memo.tags[0].replace(/^#/, '')
        : ''
      const textOnly = raw.replace(/[#@]\S*/g, '').replace(/\s+/g, '').slice(0, 10)
      let mentionLabel: string
      if (tagPart) {
        mentionLabel = textOnly ? `@Note-${tagPart}-${textOnly}` : `@Note-${tagPart}`
      } else {
        mentionLabel = `@Note-${textOnly || '未命名'}`
      }
      editor
        .chain()
        .focus()
        .deleteRange({ from: atPos, to: deleteEnd })
        .insertContent({
          type: 'text',
          text: mentionLabel,
          marks: [{ type: 'mention-note', attrs: { memoId: memo.id } }]
        })
        .insertContent(' ')
        .run()
      setMentionState(null)
    },
    [editor, mentionState]
  )

  const handleLinkSubmit = useCallback(
    (url: string, displayLabel: string) => {
      if (!editor || !mentionState) return
      const atPos = mentionState.pos
      const cursorPos = editor.state.selection.from
      const deleteEnd = Math.max(atPos + 1, cursorPos)
      editor
        .chain()
        .focus()
        .deleteRange({ from: atPos, to: deleteEnd })
        .insertContent({
          type: 'text',
          text: `🔗 ${displayLabel}`,
          marks: [{ type: 'mention-link', attrs: { url } }]
        })
        .insertContent(' ')
        .run()
      setMentionState(null)
    },
    [editor, mentionState]
  )

  const timeDisplay = useMemo(() => {
    if (!fullMemo) return ''
    return format(new Date(fullMemo.updatedAt || fullMemo.createdAt), 'yyyy-MM-dd HH:mm', { locale: zhCN })
  }, [fullMemo])

  // Toolbar state tracking
  const [, setTick] = useState(0)
  useEffect(() => {
    if (!editor) return
    const handler = (): void => setTick((n) => n + 1)
    editor.on('transaction', handler)
    return () => { editor.off('transaction', handler) }
  }, [editor])

  const hasSelection = editor ? !editor.state.selection.empty : false

  // Empty state
  if (!selectedMemoId) {
    return (
      <div className="flex flex-col h-full items-center justify-center text-muted-foreground/30">
        <FileText size={48} strokeWidth={1} className="mb-3" />
        <p className="text-sm">选择一条笔记开始编辑</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full">
      {/* Toolbar */}
      <header className="flex items-center justify-between px-4 h-12 flex-shrink-0 border-b border-border/50 app-drag-region">
        <div className="flex items-center gap-0.5 app-no-drag">
          {editor && (
            <>
              <button
                title="加粗"
                onClick={() => hasSelection && editor.chain().focus().toggleBold().run()}
                className={cn(
                  'p-1.5 rounded transition-colors',
                  editor.isActive('bold')
                    ? 'bg-accent text-foreground'
                    : 'text-muted-foreground/50 hover:text-foreground/70 hover:bg-accent/50'
                )}
              >
                <Bold size={15} strokeWidth={editor.isActive('bold') ? 2.5 : 2} />
              </button>
              <button
                title="高亮"
                onClick={() => hasSelection && editor.chain().focus().toggleHighlight().run()}
                className={cn(
                  'p-1.5 rounded transition-colors',
                  editor.isActive('highlight')
                    ? 'bg-accent text-foreground'
                    : 'text-muted-foreground/50 hover:text-foreground/70 hover:bg-accent/50'
                )}
              >
                <Highlighter size={15} strokeWidth={editor.isActive('highlight') ? 2.5 : 2} />
              </button>
              <button
                title="下划线"
                onClick={() => hasSelection && editor.chain().focus().toggleUnderline().run()}
                className={cn(
                  'p-1.5 rounded transition-colors',
                  editor.isActive('underline')
                    ? 'bg-accent text-foreground'
                    : 'text-muted-foreground/50 hover:text-foreground/70 hover:bg-accent/50'
                )}
              >
                <Underline size={15} strokeWidth={editor.isActive('underline') ? 2.5 : 2} />
              </button>
              <div className="w-px h-4 bg-border/60 mx-1" />
              <button
                title="无序列表"
                onClick={() => editor.chain().focus().toggleBulletList().run()}
                className={cn(
                  'p-1.5 rounded transition-colors',
                  editor.isActive('bulletList')
                    ? 'bg-accent text-foreground'
                    : 'text-muted-foreground/50 hover:text-foreground/70 hover:bg-accent/50'
                )}
              >
                <List size={15} strokeWidth={editor.isActive('bulletList') ? 2.5 : 2} />
              </button>
              <button
                title="有序列表"
                onClick={() => editor.chain().focus().toggleOrderedList().run()}
                className={cn(
                  'p-1.5 rounded transition-colors',
                  editor.isActive('orderedList')
                    ? 'bg-accent text-foreground'
                    : 'text-muted-foreground/50 hover:text-foreground/70 hover:bg-accent/50'
                )}
              >
                <ListOrdered size={15} strokeWidth={editor.isActive('orderedList') ? 2.5 : 2} />
              </button>
              <div className="w-px h-4 bg-border/60 mx-1" />
              <button
                title="插入图片"
                onClick={handleImageUpload}
                className="p-1.5 rounded transition-colors text-muted-foreground/50 hover:text-foreground/70 hover:bg-accent/50"
              >
                <ImagePlus size={15} />
              </button>
              <button
                title="引用笔记或网址"
                onClick={handleMentionFromToolbar}
                className="p-1.5 rounded transition-colors text-muted-foreground/50 hover:text-foreground/70 hover:bg-accent/50"
              >
                <AtSign size={15} />
              </button>
            </>
          )}
        </div>
        <div className="flex items-center gap-1 app-no-drag">
          <button
            title="新建笔记 (⌘N)"
            onClick={handleNewMemo}
            className="p-1.5 rounded-md text-muted-foreground/60 hover:text-foreground/80 hover:bg-accent transition-colors"
          >
            <Plus size={16} />
          </button>
          <button
            title="历史版本"
            onClick={handleHistory}
            className="p-1.5 rounded-md text-muted-foreground/60 hover:text-foreground/80 hover:bg-accent transition-colors"
          >
            <History size={15} />
          </button>
          <button
            title="删除"
            onClick={handleDelete}
            className="p-1.5 rounded-md text-muted-foreground/60 hover:text-destructive hover:bg-destructive/10 transition-colors"
          >
            <Trash2 size={15} />
          </button>
        </div>
      </header>

      {/* Editor */}
      <div
        className="flex-1 overflow-y-auto"
        onMouseDown={(e) => {
          (e.currentTarget as HTMLElement).dataset.mdX = String(e.clientX)
          ;(e.currentTarget as HTMLElement).dataset.mdY = String(e.clientY)
        }}
        onClick={(e) => {
          if (!editor) return
          // Ignore drag-select: only handle real clicks (mousedown ≈ mouseup position)
          const mdX = parseFloat((e.currentTarget as HTMLElement).dataset.mdX || '0')
          const mdY = parseFloat((e.currentTarget as HTMLElement).dataset.mdY || '0')
          if (Math.abs(e.clientX - mdX) > 5 || Math.abs(e.clientY - mdY) > 5) return
          // Don't override an existing range selection
          if (!editor.state.selection.empty) return

          const target = e.target as HTMLElement
          const isContentClick = editor.view.dom.contains(target) && target !== editor.view.dom
          if (isContentClick) return

          const proseMirror = editor.view.dom
          const lastChild = proseMirror.lastElementChild
          if (!lastChild) {
            editor.commands.focus('end')
            return
          }

          const clickY = e.clientY
          const lastChildRect = lastChild.getBoundingClientRect()

          if (clickY <= lastChildRect.bottom) {
            editor.commands.focus('end')
            return
          }

          const allParas = proseMirror.querySelectorAll('p')
          let refLineHeight = 28
          if (allParas.length > 0) {
            const lastPara = allParas[allParas.length - 1]
            const paraStyle = getComputedStyle(lastPara)
            refLineHeight =
              lastPara.getBoundingClientRect().height +
              parseFloat(paraStyle.marginTop) +
              parseFloat(paraStyle.marginBottom)
          }

          const linesNeeded = Math.max(
            1,
            Math.round((clickY - lastChildRect.bottom) / refLineHeight)
          )

          const { schema } = editor.state
          const tr = editor.state.tr
          for (let i = 0; i < linesNeeded; i++) {
            tr.insert(tr.doc.content.size, schema.nodes.paragraph.create())
          }
          const cursorPos = tr.doc.content.size - 1
          tr.setSelection(TextSelection.create(tr.doc, cursorPos))
          editor.view.dispatch(tr)
          editor.view.focus()
        }}
      >
        <div className="max-w-2xl mx-auto px-6 py-5">
          <div className="tiptap-editor">
            <EditorContent editor={editor} />
          </div>
        </div>
      </div>

      {/* Status bar */}
      {fullMemo && (
        <div className="flex items-center justify-between px-6 h-8 flex-shrink-0 border-t border-border/30 text-[11px] text-muted-foreground/40 tabular-nums">
          <span>最近更新：{timeDisplay}</span>
          <span>{fullMemo.plainText.replace(/\s+/g, '').length} 字</span>
        </div>
      )}

      {/* Mention popups */}
      {mentionState?.type === 'autocomplete' && editor && (
        <MentionAutocomplete
          editor={editor}
          atPos={mentionState.pos}
          coords={mentionState.coords}
          memos={allMemos.filter((m) => m.id !== selectedMemoId)}
          onSelectNote={handleNoteSelect}
          onSelectLink={handleMentionLink}
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

      {/* Search dialog */}
      {isSearchDialogOpen && <SearchDialog />}
    </div>
  )
}

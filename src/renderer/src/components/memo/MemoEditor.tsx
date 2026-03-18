import { useCallback, useMemo, useRef, useState } from 'react'
import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import UnderlineExt from '@tiptap/extension-underline'
import HighlightExt from '@tiptap/extension-highlight'
import ImageExt from '@tiptap/extension-image'
import Placeholder from '@tiptap/extension-placeholder'
import { TagNode } from '@renderer/extensions/tag-node'
import { MemoToolbar } from './MemoToolbar'
import { EditableImageGallery } from './ImageGallery'
import type { ImageItem } from './ImageGallery'
import { useMemoStore } from '@renderer/stores/memo.store'
import type { TipTapDocument, TipTapNode } from '@shared/types'
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

/** Remove all image nodes from a TipTap document */
function stripImages(doc: TipTapDocument): TipTapDocument {
  function filterNodes(nodes: TipTapNode[]): TipTapNode[] {
    return nodes
      .filter((n) => n.type !== 'image')
      .map((n) => (n.content ? { ...n, content: filterNodes(n.content) } : n))
  }
  return { type: 'doc', content: filterNodes(doc.content) }
}

interface MemoEditorProps {
  memoId?: string
  initialContent?: TipTapDocument
  onCancel?: () => void
}

export function MemoEditor({ memoId, initialContent, onCancel }: MemoEditorProps): React.JSX.Element {
  const createMemo = useMemoStore((s) => s.createMemo)
  const updateMemo = useMemoStore((s) => s.updateMemo)
  const isSubmitting = useRef(false)
  const isEditMode = !!memoId

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
      Placeholder.configure({
        placeholder: '记录想法...',
        emptyEditorClass: 'is-editor-empty'
      })
    ],
    content: textContent || undefined,
    editorProps: {
      attributes: {
        class: 'outline-none min-h-[60px]'
      }
    }
  })

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
    if (!plainText.trim() && !json.content?.length && images.length === 0) return

    isSubmitting.current = true
    try {
      const tags = extractTags(json)
      const imageFilenames = images.map((img) => img.filename)

      // Append image nodes to the document for storage compatibility
      const imageNodes: TipTapNode[] = images.map((img) => ({
        type: 'image',
        attrs: { src: img.src }
      }))
      const fullContent: TipTapDocument = {
        type: 'doc',
        content: [...json.content, ...imageNodes]
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
  }, [editor, memoId, isEditMode, images, createMemo, updateMemo, onCancel])

  return (
    <div className="rounded-xl border border-border/70 bg-card shadow-sm overflow-hidden transition-shadow focus-within:shadow-md focus-within:border-border">
      <div className="tiptap-editor px-4 pt-3 pb-1">
        <EditorContent editor={editor} />
      </div>
      {/* Image gallery area */}
      {images.length > 0 && (
        <div className="px-4 pb-2">
          <EditableImageGallery images={images} onDelete={handleImageDelete} />
        </div>
      )}
      <div className="flex items-center justify-between px-3 pb-2">
        <MemoToolbar
          editor={editor}
          onImageUpload={handleImageUpload}
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
    </div>
  )
}

import { Mark, mergeAttributes } from '@tiptap/react'
import { Plugin } from '@tiptap/pm/state'
import type { TipTapDocument, TipTapNode } from '@shared/types'

export function migrateMentionNodes(doc: TipTapDocument): TipTapDocument {
  function walkNode(node: TipTapNode): TipTapNode | TipTapNode[] {
    if (node.type === 'mention-note') {
      return {
        type: 'text',
        text: String(node.attrs?.label || '@Note'),
        marks: [{ type: 'mention-note', attrs: { memoId: node.attrs?.memoId || '' } }]
      }
    }
    if (node.type === 'mention-link') {
      return {
        type: 'text',
        text: `🔗 ${node.attrs?.label || node.attrs?.url || ''}`,
        marks: [{ type: 'mention-link', attrs: { url: node.attrs?.url || '' } }]
      }
    }
    if (node.content) {
      return { ...node, content: node.content.flatMap(walkNode) }
    }
    return node
  }
  return { ...doc, content: doc.content.flatMap((n) => [walkNode(n)].flat()) as TipTapNode[] }
}

export const MentionNoteMark = Mark.create({
  name: 'mention-note',
  inclusive: false,
  excludes: '_',

  addAttributes() {
    return {
      memoId: {
        default: '',
        parseHTML: (el) => (el as HTMLElement).getAttribute('data-mention-note'),
        renderHTML: (attrs) => ({ 'data-mention-note': attrs.memoId })
      }
    }
  },

  parseHTML() {
    return [{ tag: 'span[data-mention-note]' }]
  },

  renderHTML({ HTMLAttributes }) {
    return [
      'span',
      mergeAttributes(HTMLAttributes, { class: 'mention-note-node' }),
      0
    ]
  },

  addProseMirrorPlugins() {
    return [
      new Plugin({
        props: {
          handleClick(_view, _pos, event) {
            const target = event.target as HTMLElement
            const el = target.closest('[data-mention-note]') as HTMLElement
            if (!el) return false
            const memoId = el.getAttribute('data-mention-note')
            if (memoId) {
              window.dispatchEvent(
                new CustomEvent('anyhark:scroll-to-memo', { detail: { memoId } })
              )
            }
            return false
          }
        }
      })
    ]
  }
})

export const MentionLinkMark = Mark.create({
  name: 'mention-link',
  inclusive: false,
  excludes: '_',

  addAttributes() {
    return {
      url: {
        default: '',
        parseHTML: (el) => (el as HTMLElement).getAttribute('data-mention-link'),
        renderHTML: (attrs) => ({ 'data-mention-link': attrs.url })
      }
    }
  },

  parseHTML() {
    return [{ tag: 'span[data-mention-link]' }]
  },

  renderHTML({ HTMLAttributes }) {
    return [
      'span',
      mergeAttributes(HTMLAttributes, { class: 'mention-link-node' }),
      0
    ]
  },

  addProseMirrorPlugins() {
    return [
      new Plugin({
        props: {
          handleClick(_view, _pos, event) {
            const target = event.target as HTMLElement
            const el = target.closest('[data-mention-link]') as HTMLElement
            if (!el) return false
            const url = el.getAttribute('data-mention-link')
            if (url) {
              navigator.clipboard.writeText(url)
              const toast = document.createElement('div')
              toast.className = 'mention-link-toast'
              toast.textContent = '链接已复制'
              document.body.appendChild(toast)
              setTimeout(() => toast.remove(), 2000)
            }
            return false
          }
        }
      })
    ]
  }
})

import { Node, mergeAttributes } from '@tiptap/react'
import { Plugin } from '@tiptap/pm/state'

export const MentionNoteNode = Node.create({
  name: 'mention-note',
  group: 'inline',
  inline: true,
  atom: true,

  addAttributes() {
    return {
      memoId: { default: '' },
      label: { default: '@Note' }
    }
  },

  parseHTML() {
    return [
      {
        tag: 'span[data-mention-note]',
        getAttrs: (el) => {
          const element = el as HTMLElement
          return {
            memoId: element.getAttribute('data-mention-note'),
            label: element.textContent
          }
        }
      }
    ]
  },

  renderHTML({ node, HTMLAttributes }) {
    return [
      'span',
      mergeAttributes(HTMLAttributes, {
        'data-mention-note': node.attrs.memoId,
        class: 'mention-note-node'
      }),
      node.attrs.label || '@Note'
    ]
  },

  addProseMirrorPlugins() {
    const nodeType = this.type
    return [
      new Plugin({
        props: {
          handleClickOn(view, _pos, node, _nodePos, _event, direct) {
            if (node.type !== nodeType || !direct) return false
            if (!view.editable) {
              window.dispatchEvent(
                new CustomEvent('anyhark:scroll-to-memo', {
                  detail: { memoId: node.attrs.memoId }
                })
              )
            }
            return true
          }
        }
      })
    ]
  }
})

export const MentionLinkNode = Node.create({
  name: 'mention-link',
  group: 'inline',
  inline: true,
  atom: true,

  addAttributes() {
    return {
      url: { default: '' },
      label: { default: '' }
    }
  },

  parseHTML() {
    return [
      {
        tag: 'span[data-mention-link]',
        getAttrs: (el) => {
          const element = el as HTMLElement
          return {
            url: element.getAttribute('data-mention-link'),
            label: element.textContent
          }
        }
      }
    ]
  },

  renderHTML({ node, HTMLAttributes }) {
    return [
      'span',
      mergeAttributes(HTMLAttributes, {
        'data-mention-link': node.attrs.url,
        class: 'mention-link-node'
      }),
      node.attrs.label || node.attrs.url
    ]
  },

  addProseMirrorPlugins() {
    const nodeType = this.type
    return [
      new Plugin({
        props: {
          handleClickOn(view, _pos, node, _nodePos, _event, direct) {
            if (node.type !== nodeType || !direct) return false
            navigator.clipboard.writeText(node.attrs.url)
            const el = view.dom.closest('.memo-card') || view.dom
            const toast = document.createElement('div')
            toast.className = 'mention-link-toast'
            toast.textContent = '链接已复制'
            el.appendChild(toast)
            setTimeout(() => toast.remove(), 1500)
            return true
          }
        }
      })
    ]
  }
})

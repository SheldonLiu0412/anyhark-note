import { Node, mergeAttributes, InputRule } from '@tiptap/react'
import { Fragment } from '@tiptap/pm/model'

export const TagNode = Node.create({
  name: 'tag',
  group: 'inline',
  inline: true,
  atom: true,

  addAttributes() {
    return {
      path: {
        default: ''
      },
      label: {
        default: ''
      }
    }
  },

  parseHTML() {
    return [
      {
        tag: 'span[data-tag]',
        getAttrs: (el) => {
          const element = el as HTMLElement
          return {
            path: element.getAttribute('data-tag'),
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
        'data-tag': node.attrs.path,
        class: 'tag-node'
      }),
      node.attrs.label || `#${node.attrs.path}`
    ]
  },

  addInputRules() {
    return [
      new InputRule({
        find: /#([^\s#]+)\s$/,
        handler: ({ state, range }) => {
          const fullMatch = state.doc.textBetween(range.from, range.to)
          const tagMatch = fullMatch.match(/^#([^\s#]+)\s$/)
          if (!tagMatch) return

          const tagPath = tagMatch[1]
          const tagNode = this.type.create({
            path: tagPath,
            label: `#${tagPath}`
          })
          const spaceText = state.schema.text(' ')
          state.tr.replaceWith(range.from, range.to, Fragment.from([tagNode, spaceText]))
        }
      })
    ]
  },

  addKeyboardShortcuts() {
    return {
      Backspace: () =>
        this.editor.commands.command(({ tr, state }) => {
          const { selection } = state
          const { empty, anchor } = selection

          if (!empty) return false

          const $pos = state.doc.resolve(anchor)
          const nodeBefore = $pos.nodeBefore
          if (nodeBefore?.type.name === this.name) {
            tr.delete(anchor - nodeBefore.nodeSize, anchor)
            return true
          }
          return false
        })
    }
  },

  addNodeView() {
    return ({ node: initialNode, getPos, editor }) => {
      let currentNode = initialNode
      let editing = false
      let cancelled = false

      const wrapper = document.createElement('span')
      wrapper.className = 'tag-node'
      wrapper.setAttribute('data-tag', currentNode.attrs.path)
      wrapper.textContent = currentNode.attrs.label || `#${currentNode.attrs.path}`

      wrapper.addEventListener('click', (e) => {
        if (!editor.isEditable || editing) return
        e.preventDefault()
        e.stopPropagation()
        editing = true
        wrapper.classList.add('tag-node-editing')

        const input = document.createElement('input')
        input.type = 'text'
        input.className = 'tag-node-input'
        const label = currentNode.attrs.label || `#${currentNode.attrs.path}`
        input.value = label
        input.style.width = `${label.length + 1}ch`

        wrapper.textContent = ''
        wrapper.appendChild(input)
        input.focus()
        input.select()

        const finishEditing = (): void => {
          if (!editing) return
          editing = false
          wrapper.classList.remove('tag-node-editing')

          if (cancelled) {
            cancelled = false
            wrapper.textContent = currentNode.attrs.label || `#${currentNode.attrs.path}`
            return
          }

          const raw = input.value.trim()
          if (typeof getPos !== 'function') return
          const pos = getPos()
          if (pos == null) return

          if (!raw) {
            const tr = editor.view.state.tr.delete(pos, pos + currentNode.nodeSize)
            editor.view.dispatch(tr)
            return
          }

          const newPath = raw.startsWith('#') ? raw.slice(1) : raw
          if (!newPath) {
            const tr = editor.view.state.tr.delete(pos, pos + currentNode.nodeSize)
            editor.view.dispatch(tr)
            return
          }

          const tr = editor.view.state.tr.setNodeMarkup(pos, undefined, {
            path: newPath,
            label: `#${newPath}`
          })
          editor.view.dispatch(tr)
        }

        input.addEventListener('blur', finishEditing)

        input.addEventListener('keydown', (ke) => {
          if (ke.key === 'Enter') {
            ke.preventDefault()
            input.blur()
          } else if (ke.key === 'Escape') {
            ke.preventDefault()
            cancelled = true
            input.blur()
          }
          ke.stopPropagation()
        })

        input.addEventListener('input', () => {
          input.style.width = `${input.value.length + 1}ch`
        })
      })

      return {
        dom: wrapper,
        update(updatedNode) {
          if (updatedNode.type.name !== 'tag') return false
          currentNode = updatedNode
          wrapper.setAttribute('data-tag', updatedNode.attrs.path)
          if (!editing) {
            wrapper.textContent = updatedNode.attrs.label || `#${updatedNode.attrs.path}`
          }
          return true
        },
        ignoreMutation() {
          return true
        },
        stopEvent() {
          return editing
        },
        destroy() {}
      }
    }
  }
})

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
        // Match #tagpath followed by a space, anywhere in text
        // Tag path can contain: letters, numbers, Chinese chars, underscores, slashes
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
          let isTag = false
          const { selection } = state
          const { empty, anchor } = selection

          if (!empty) return false

          state.doc.nodesBefore(anchor, (node, pos) => {
            if (node.type.name === this.name) {
              isTag = true
              tr.delete(pos, pos + node.nodeSize)
              return false
            }
            return undefined
          })

          return isTag
        })
    }
  }
})

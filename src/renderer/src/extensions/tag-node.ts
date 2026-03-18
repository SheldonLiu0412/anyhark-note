import { Node, mergeAttributes, InputRule } from '@tiptap/react'
import { Fragment } from '@tiptap/pm/model'
import { Plugin } from '@tiptap/pm/state'
import { TextSelection } from '@tiptap/pm/state'

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
  },

  addProseMirrorPlugins() {
    const tagType = this.type
    return [
      new Plugin({
        props: {
          handleClickOn(view, _pos, node, nodePos, _event, direct) {
            if (!view.editable || !direct) return false
            if (node.type !== tagType) return false
            const text = node.attrs.label || `#${node.attrs.path}`
            const tr = view.state.tr.replaceWith(
              nodePos,
              nodePos + node.nodeSize,
              view.state.schema.text(text)
            )
            tr.setSelection(TextSelection.create(tr.doc, nodePos + text.length))
            view.dispatch(tr)
            return true
          }
        }
      })
    ]
  }
})

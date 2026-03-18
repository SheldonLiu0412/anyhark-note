import Image from '@tiptap/extension-image'
import { Plugin } from '@tiptap/pm/state'

export const CustomImage = Image.extend({
  atom: true,
  selectable: true,
  draggable: true,

  addNodeView() {
    return ({ node }) => {
      const dom = document.createElement('div')
      dom.className = 'image-node-view'
      dom.contentEditable = 'false'

      const img = document.createElement('img')
      img.src = node.attrs.src || ''
      img.alt = node.attrs.alt || ''
      if (node.attrs.title) img.title = node.attrs.title
      if (node.attrs.width) img.setAttribute('width', String(node.attrs.width))
      if (node.attrs.height) img.setAttribute('height', String(node.attrs.height))
      img.draggable = false
      img.addEventListener('dragstart', (e) => e.preventDefault())

      dom.appendChild(img)

      return {
        dom,
        selectNode() {
          dom.classList.add('ProseMirror-selectednode')
        },
        deselectNode() {
          dom.classList.remove('ProseMirror-selectednode')
        },
        update(updatedNode) {
          if (updatedNode.type.name !== 'image') return false
          img.src = updatedNode.attrs.src || ''
          img.alt = updatedNode.attrs.alt || ''
          if (updatedNode.attrs.title) img.title = updatedNode.attrs.title
          else img.removeAttribute('title')
          return true
        },
        ignoreMutation() {
          return true
        }
      }
    }
  },

  addProseMirrorPlugins() {
    const imageType = this.type
    return [
      new Plugin({
        view() {
          return {
            update(view, prevState) {
              if (prevState.selection.eq(view.state.selection)) return
              view.dom.querySelectorAll('.image-node-view.image-in-selection').forEach((el) => {
                el.classList.remove('image-in-selection')
              })
              const { selection } = view.state
              if (!selection.empty) {
                view.state.doc.nodesBetween(selection.from, selection.to, (node, pos) => {
                  if (node.type === imageType) {
                    const domNode = view.nodeDOM(pos)
                    if (domNode instanceof HTMLElement) {
                      domNode.classList.add('image-in-selection')
                    }
                  }
                })
              }
            }
          }
        }
      })
    ]
  }
})

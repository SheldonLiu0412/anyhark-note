import { ReactRenderer } from '@tiptap/react'
import type { SuggestionOptions } from '@tiptap/suggestion'

interface TagSuggestionItem {
  path: string
  label: string
}

interface TagSuggestionListProps {
  items: TagSuggestionItem[]
  command: (item: TagSuggestionItem) => void
}

export function TagSuggestionList({ items, command }: TagSuggestionListProps): React.JSX.Element {
  return (
    <div className="tag-suggestion">
      {items.length === 0 ? (
        <div className="px-3 py-2 text-sm text-muted-foreground">输入新标签名称，按回车或空格创建</div>
      ) : (
        items.map((item) => (
          <button
            key={item.path}
            className="tag-suggestion-item w-full text-left"
            onClick={() => command(item)}
          >
            <span className="text-muted-foreground mr-1">#</span>
            {item.label}
          </button>
        ))
      )}
    </div>
  )
}

export function createTagSuggestionOptions(
  getTagPaths: () => string[]
): Omit<SuggestionOptions<TagSuggestionItem>, 'editor'> {
  return {
    char: '#',
    allowSpaces: false,

    items: ({ query }) => {
      const allTags = getTagPaths()
      if (!query) return allTags.slice(0, 10).map((p) => ({ path: p, label: p }))
      const lower = query.toLowerCase()
      const matched = allTags
        .filter((t) => t.toLowerCase().includes(lower))
        .slice(0, 10)
        .map((p) => ({ path: p, label: p }))
      return matched
    },

    render: () => {
      let component: ReactRenderer<{ items: TagSuggestionItem[]; command: (item: TagSuggestionItem) => void }> | null = null
      let popup: HTMLElement | null = null
      let currentQuery = ''
      let currentCommand: ((item: TagSuggestionItem) => void) | null = null

      return {
        onStart: (props) => {
          currentQuery = props.query
          currentCommand = (item: TagSuggestionItem) => props.command(item)

          component = new ReactRenderer(TagSuggestionList, {
            props: {
              items: props.items,
              command: (item: TagSuggestionItem) => {
                props.command(item)
              }
            },
            editor: props.editor
          })

          popup = document.createElement('div')
          popup.style.position = 'absolute'
          popup.style.zIndex = '50'

          if (props.clientRect) {
            const rect = props.clientRect()
            if (rect) {
              popup.style.left = `${rect.left}px`
              popup.style.top = `${rect.bottom + 4}px`
            }
          }

          popup.appendChild(component.element)
          document.body.appendChild(popup)
        },

        onUpdate: (props) => {
          currentQuery = props.query
          currentCommand = (item: TagSuggestionItem) => props.command(item)

          component?.updateProps({
            items: props.items,
            command: (item: TagSuggestionItem) => {
              props.command(item)
            }
          })

          if (popup && props.clientRect) {
            const rect = props.clientRect()
            if (rect) {
              popup.style.left = `${rect.left}px`
              popup.style.top = `${rect.bottom + 4}px`
            }
          }
        },

        onKeyDown: (props) => {
          if (props.event.key === 'Escape') {
            popup?.remove()
            component?.destroy()
            popup = null
            component = null
            return true
          }

          // Space key: create tag from current query
          if (props.event.key === ' ' && currentQuery.trim() && currentCommand) {
            const tagPath = currentQuery.trim()
            currentCommand({ path: tagPath, label: tagPath })
            return true
          }

          return false
        },

        onExit: () => {
          popup?.remove()
          component?.destroy()
          popup = null
          component = null
          currentQuery = ''
          currentCommand = null
        }
      }
    },

    command: ({ editor, range, props }) => {
      const item = props as unknown as TagSuggestionItem
      editor
        .chain()
        .focus()
        .insertContentAt(range, [
          {
            type: 'tag',
            attrs: { path: item.path, label: `#${item.path}` }
          },
          { type: 'text', text: ' ' }
        ])
        .run()
    }
  }
}

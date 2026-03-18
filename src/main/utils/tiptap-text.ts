import type { TipTapDocument, TipTapNode } from '@shared/types'

/**
 * Recursively walk TipTap JSON nodes and collect all text content.
 * For tag nodes, collects the tag label from attrs.
 */
export function extractPlainText(doc: TipTapDocument): string {
  const parts: string[] = []
  walkNodes(doc.content, (node) => {
    if (node.text) {
      parts.push(node.text)
    } else if (node.type === 'tag' && node.attrs?.label) {
      parts.push(String(node.attrs.label))
    }
  })
  return parts.join(' ').replace(/\s+/g, ' ').trim()
}

/**
 * Extract tag paths from both tag nodes and #tag patterns in text.
 */
export function extractTags(doc: TipTapDocument): string[] {
  const tags = new Set<string>()

  walkNodes(doc.content, (node) => {
    // From tag nodes (inline atomic)
    if (node.type === 'tag' && node.attrs?.path) {
      tags.add(String(node.attrs.path))
    }
    // From plain text: match #word patterns
    if (node.text) {
      const regex = /#([^\s#]+)/g
      let match
      while ((match = regex.exec(node.text)) !== null) {
        tags.add(match[1])
      }
    }
  })

  return [...tags]
}

/**
 * Extract image filenames from image nodes.
 */
export function extractImageFilenames(doc: TipTapDocument): string[] {
  const images: string[] = []
  walkNodes(doc.content, (node) => {
    if (node.type === 'image' && node.attrs?.src) {
      const src = String(node.attrs.src)
      if (!images.includes(src)) {
        images.push(src)
      }
    }
  })
  return images
}

function walkNodes(nodes: TipTapNode[] | undefined, visitor: (node: TipTapNode) => void): void {
  if (!nodes) return
  for (const node of nodes) {
    visitor(node)
    if (node.content) {
      walkNodes(node.content, visitor)
    }
  }
}

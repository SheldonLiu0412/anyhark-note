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
 * Count characters excluding tag nodes and #tag patterns in text.
 */
export function countWordsExcludingTags(doc: TipTapDocument): number {
  const parts: string[] = []
  walkNodes(doc.content, (node) => {
    if (node.type === 'tag') return
    if (node.text) {
      parts.push(node.text.replace(/#[^\s#]+/g, ''))
    }
  })
  return parts.join('').replace(/\s+/g, '').length
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

/**
 * Extract full content as plain text for CSV export.
 * Preserves paragraph breaks, tag text, and mention labels.
 */
export function extractFullContentForExport(doc: TipTapDocument): string {
  const paragraphs: string[] = []
  for (const node of doc.content) {
    if (node.type === 'image') continue
    const parts: string[] = []
    collectInlineText(node.content, parts)
    paragraphs.push(parts.join(''))
  }
  return paragraphs.join('\n').trim()
}

function collectInlineText(nodes: TipTapNode[] | undefined, parts: string[]): void {
  if (!nodes) return
  for (const node of nodes) {
    if (node.text) parts.push(node.text)
    else if (node.type === 'tag') parts.push(node.attrs?.label || `#${node.attrs?.path}`)
    else if (node.type === 'mention-note') parts.push('@Note')
    else if (node.type === 'mention-link') parts.push(node.attrs?.label || node.attrs?.url || '')
    else if (node.type === 'hardBreak') parts.push('\n')
    if (node.content) collectInlineText(node.content, parts)
  }
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

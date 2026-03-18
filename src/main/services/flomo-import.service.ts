import path from 'path'
import fs from 'fs/promises'
import { parse as parseHTML } from 'node-html-parser'
import { ulid } from 'ulid'
import type { Memo, MemoMeta, TipTapDocument, TipTapNode } from '@shared/types'
import { getMemosDir, getImagesDir } from '../utils/paths'
import { writeJSON } from './storage.service'
import { buildMemoMeta } from './memo.service'

export interface FlomoImportResult {
  total: number
  imported: number
  skipped: number
  images: number
}

/**
 * Import memos from a Flomo export directory.
 * Expects a directory containing an HTML file and a `file/` subdirectory for images.
 */
export async function importFromFlomo(dirPath: string): Promise<FlomoImportResult> {
  // Find the HTML file
  const entries = await fs.readdir(dirPath)
  const htmlFile = entries.find((e) => e.endsWith('.html'))
  if (!htmlFile) {
    throw new Error('未找到 Flomo 导出的 HTML 文件')
  }

  const htmlContent = await fs.readFile(path.join(dirPath, htmlFile), 'utf-8')
  const root = parseHTML(htmlContent)

  const memoElements = root.querySelectorAll('.memo')
  const memosDir = getMemosDir()

  let imported = 0
  let skipped = 0
  let imagesCopied = 0

  for (const el of memoElements) {
    try {
      // Extract timestamp
      const timeEl = el.querySelector('.time')
      const timeStr = timeEl?.textContent?.trim()
      if (!timeStr) {
        skipped++
        continue
      }

      const createdAt = parseFlomoTime(timeStr)

      // Extract content HTML
      const contentEl = el.querySelector('.content')
      if (!contentEl) {
        skipped++
        continue
      }

      // Extract image sources
      const filesEl = el.querySelector('.files')
      const imgSrcs: string[] = []
      if (filesEl) {
        const imgs = filesEl.querySelectorAll('img')
        for (const img of imgs) {
          const src = img.getAttribute('src')
          if (src) imgSrcs.push(src)
        }
      }

      // Parse HTML content to TipTap JSON and extract tags
      const { document: tiptapDoc, tags, plainText } = htmlToTipTap(contentEl.innerHTML)

      // Copy images and get new filenames
      const imageFilenames: string[] = []
      for (const src of imgSrcs) {
        const srcPath = path.join(dirPath, src)
        try {
          await fs.access(srcPath)
          const ext = path.extname(src).slice(1) || 'jpg'
          const newFilename = `img_${ulid()}.${ext}`

          // Organize by date from createdAt
          const date = new Date(createdAt)
          const year = date.getFullYear().toString()
          const month = (date.getMonth() + 1).toString().padStart(2, '0')
          const destDir = path.join(getImagesDir(), year, month)
          await fs.mkdir(destDir, { recursive: true })

          await fs.copyFile(srcPath, path.join(destDir, newFilename))
          imageFilenames.push(newFilename)
          imagesCopied++
        } catch {
          // Image file not found, skip
        }
      }

      // Add image nodes to document
      if (imageFilenames.length > 0) {
        for (const filename of imageFilenames) {
          tiptapDoc.content.push({
            type: 'image',
            attrs: { src: `anyhark-image://${filename}` }
          })
        }
      }

      // Create memo
      const id = ulid()
      const memo: Memo = {
        id,
        content: tiptapDoc,
        plainText,
        tags,
        images: imageFilenames,
        createdAt,
        updatedAt: createdAt,
        deletedAt: null,
        versions: []
      }

      await writeJSON(path.join(memosDir, `${id}.json`), memo)
      imported++
    } catch {
      skipped++
    }
  }

  return {
    total: memoElements.length,
    imported,
    skipped,
    images: imagesCopied
  }
}

/**
 * Parse Flomo time string "2026-03-09 23:57:11" to ISO 8601.
 */
function parseFlomoTime(timeStr: string): string {
  // Flomo exports as "YYYY-MM-DD HH:mm:ss"
  return new Date(timeStr.replace(' ', 'T') + '+08:00').toISOString()
}

/**
 * Convert Flomo HTML content to TipTap JSON document.
 * Handles paragraphs, lists, bold, and inline #tags.
 */
function htmlToTipTap(html: string): {
  document: TipTapDocument
  tags: string[]
  plainText: string
} {
  const root = parseHTML(html)
  const content: TipTapNode[] = []
  const tags: string[] = []
  const textParts: string[] = []

  for (const child of root.childNodes) {
    const el = child as ReturnType<typeof parseHTML>
    const tagName = el.tagName?.toLowerCase()

    if (tagName === 'p') {
      const { nodes, extractedTags, text } = parseInlineContent(el.innerHTML)
      tags.push(...extractedTags)
      textParts.push(text)
      content.push({ type: 'paragraph', content: nodes.length > 0 ? nodes : undefined })
    } else if (tagName === 'ul') {
      const items = el.querySelectorAll('li')
      const listContent: TipTapNode[] = []
      for (const li of items) {
        const { nodes, extractedTags, text } = parseInlineContent(li.innerHTML)
        tags.push(...extractedTags)
        textParts.push(text)
        listContent.push({
          type: 'listItem',
          content: [{ type: 'paragraph', content: nodes.length > 0 ? nodes : undefined }]
        })
      }
      content.push({ type: 'bulletList', content: listContent })
    } else if (tagName === 'ol') {
      const items = el.querySelectorAll('li')
      const listContent: TipTapNode[] = []
      for (const li of items) {
        const { nodes, extractedTags, text } = parseInlineContent(li.innerHTML)
        tags.push(...extractedTags)
        textParts.push(text)
        listContent.push({
          type: 'listItem',
          content: [{ type: 'paragraph', content: nodes.length > 0 ? nodes : undefined }]
        })
      }
      content.push({ type: 'orderedList', content: listContent })
    } else if (el.textContent?.trim()) {
      // Fallback: treat as paragraph
      const { nodes, extractedTags, text } = parseInlineContent(el.textContent)
      tags.push(...extractedTags)
      textParts.push(text)
      content.push({ type: 'paragraph', content: nodes.length > 0 ? nodes : undefined })
    }
  }

  // Deduplicate tags
  const uniqueTags = [...new Set(tags)]

  return {
    document: { type: 'doc', content: content.length > 0 ? content : [{ type: 'paragraph' }] },
    tags: uniqueTags,
    plainText: textParts.join(' ').replace(/\s+/g, ' ').trim()
  }
}

/**
 * Parse inline HTML content, extracting #tags as tag nodes and text as text nodes.
 * Handles <b>, <strong>, <em>, <u> marks.
 */
function parseInlineContent(html: string): {
  nodes: TipTapNode[]
  extractedTags: string[]
  text: string
} {
  const nodes: TipTapNode[] = []
  const extractedTags: string[] = []
  const textParts: string[] = []

  // Parse HTML to get inline elements
  const root = parseHTML(html)

  for (const child of root.childNodes) {
    const el = child as ReturnType<typeof parseHTML>
    const tagName = el.tagName?.toLowerCase()

    let rawText = ''
    let marks: { type: string }[] | undefined

    if (tagName === 'b' || tagName === 'strong') {
      rawText = el.textContent || ''
      marks = [{ type: 'bold' }]
    } else if (tagName === 'em' || tagName === 'i') {
      rawText = el.textContent || ''
      marks = [{ type: 'italic' }]
    } else if (tagName === 'u') {
      rawText = el.textContent || ''
      marks = [{ type: 'underline' }]
    } else if (tagName === 'a') {
      rawText = el.textContent || ''
      marks = [{ type: 'link', attrs: { href: el.getAttribute('href') || '' } } as { type: string }]
    } else {
      rawText = el.textContent || ''
    }

    if (!rawText) continue

    // Split text by #tag patterns
    const segments = splitByTags(rawText)
    for (const seg of segments) {
      if (seg.isTag) {
        extractedTags.push(seg.tagPath)
        textParts.push(`#${seg.tagPath}`)
        nodes.push({
          type: 'tag',
          attrs: { path: seg.tagPath, label: `#${seg.tagPath}` }
        })
        // Add a space after tag
        nodes.push({ type: 'text', text: ' ' })
      } else if (seg.text) {
        textParts.push(seg.text)
        const textNode: TipTapNode = { type: 'text', text: seg.text }
        if (marks) textNode.marks = marks
        nodes.push(textNode)
      }
    }
  }

  return {
    nodes,
    extractedTags,
    text: textParts.join('')
  }
}

interface TextSegment {
  isTag: boolean
  text: string
  tagPath: string
}

/**
 * Split text into regular text and #tag segments.
 * Handles multi-level tags like #diary/子标签
 */
function splitByTags(text: string): TextSegment[] {
  const segments: TextSegment[] = []
  // Match #tag where tag can contain letters, numbers, CJK chars, and /
  const tagRegex = /#([\w\u4e00-\u9fff\u3400-\u4dbf""/]+(?:\/[\w\u4e00-\u9fff\u3400-\u4dbf""/]+)*)/g

  let lastIndex = 0
  let match: RegExpExecArray | null

  while ((match = tagRegex.exec(text)) !== null) {
    // Add text before tag
    if (match.index > lastIndex) {
      segments.push({ isTag: false, text: text.slice(lastIndex, match.index), tagPath: '' })
    }
    // Add tag
    segments.push({ isTag: true, text: '', tagPath: match[1] })
    lastIndex = match.index + match[0].length
  }

  // Add remaining text
  if (lastIndex < text.length) {
    segments.push({ isTag: false, text: text.slice(lastIndex), tagPath: '' })
  }

  return segments
}

/**
 * Get all MemoMeta from newly imported memos (for index rebuild).
 */
export function buildImportedMetas(memos: Memo[]): MemoMeta[] {
  return memos.map(buildMemoMeta)
}

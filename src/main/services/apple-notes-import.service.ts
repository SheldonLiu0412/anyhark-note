import path from 'path'
import fs from 'fs/promises'
import os from 'os'
import { exec } from 'child_process'
import { promisify } from 'util'
import { parse as parseHTML } from 'node-html-parser'
import { ulid } from 'ulid'
import type { Memo, TipTapDocument, TipTapNode, TipTapMark } from '@shared/types'
import type { AppleNotesImportResult } from '@shared/types'
import { getMemosDir, getImagesDir } from '../utils/paths'
import { writeJSON } from './storage.service'

const execAsync = promisify(exec)

interface AppleNote {
  name: string
  body: string
  createdAt: string
  modifiedAt: string
  folder: string
}

const SKIP_FOLDERS = ['Recently Deleted', '最近删除', 'All iCloud', '所有 iCloud']

export async function importFromAppleNotes(): Promise<AppleNotesImportResult> {
  if (process.platform !== 'darwin') {
    throw new Error('苹果备忘录导入仅支持 macOS 系统')
  }

  const notes = await readAppleNotes()

  if (notes.length === 0) {
    throw new Error('未找到任何备忘录笔记，请确认备忘录应用中有笔记内容')
  }

  const memosDir = getMemosDir()
  let imported = 0
  let skipped = 0
  let imagesCopied = 0
  let hashConverted = 0

  for (const note of notes) {
    if (SKIP_FOLDERS.includes(note.folder)) {
      skipped++
      continue
    }

    try {
      const { cleanedHtml, imageFilenames, imageCount } = await extractImages(
        note.body,
        note.createdAt
      )
      imagesCopied += imageCount

      const textBeforeConvert = parseHTML(cleanedHtml).textContent || ''
      hashConverted += (textBeforeConvert.match(/#/g) || []).length

      const { document: tiptapDoc, plainText } = htmlToTipTap(cleanedHtml)

      // Tag: #Apple Notes/文件夹名称/笔记前5字
      const prefix = plainText.replace(/\s+/g, '').slice(0, 5) || '未命名'
      const appleNotesTag = `Apple Notes/${note.folder}/${prefix}`

      if (tiptapDoc.content.length > 0) {
        const first = tiptapDoc.content[0]
        if (first.type === 'paragraph' || first.type === 'heading') {
          const tagNode: TipTapNode = {
            type: 'tag',
            attrs: { path: appleNotesTag, label: `#${appleNotesTag}` }
          }
          first.content = [tagNode, { type: 'text', text: ' ' }, ...(first.content || [])]
        }
      }

      for (const filename of imageFilenames) {
        tiptapDoc.content.push({
          type: 'image',
          attrs: { src: `anyhark-image://${filename}` }
        })
      }

      const id = ulid()
      const memo: Memo = {
        id,
        content: tiptapDoc,
        plainText: `#${appleNotesTag} ${plainText}`,
        tags: [appleNotesTag],
        images: imageFilenames,
        createdAt: note.createdAt,
        updatedAt: note.modifiedAt,
        deletedAt: null,
        versions: []
      }

      await writeJSON(path.join(memosDir, `${id}.json`), memo)
      imported++
    } catch {
      skipped++
    }
  }

  return { total: notes.length, imported, skipped, images: imagesCopied, hashConverted }
}

/**
 * Read all notes from Apple Notes via JXA (JavaScript for Automation).
 * Uses ObjC bridge to write output to a temp file, avoiding stdout buffer limits.
 */
async function readAppleNotes(): Promise<AppleNote[]> {
  const ts = Date.now()
  const outputPath = path.join(os.tmpdir(), `anyhark-apple-notes-${ts}.json`)
  const scriptPath = path.join(os.tmpdir(), `anyhark-apple-notes-${ts}.js`)

  const script = `(() => {
  ObjC.import('Foundation');
  var Notes = Application('Notes');
  var allNotes = Notes.notes();
  var result = [];
  for (var i = 0; i < allNotes.length; i++) {
    try {
      var note = allNotes[i];
      result.push({
        name: note.name(),
        body: note.body(),
        createdAt: note.creationDate().toISOString(),
        modifiedAt: note.modificationDate().toISOString(),
        folder: note.container().name()
      });
    } catch(e) {}
  }
  var json = JSON.stringify(result);
  var nsStr = $.NSString.alloc.initWithUTF8String(json);
  nsStr.writeToFileAtomicallyEncodingError(
    '${outputPath}', true, $.NSUTF8StringEncoding, null
  );
  return result.length;
})()`

  await fs.writeFile(scriptPath, script, 'utf-8')

  try {
    await execAsync(`osascript -l JavaScript "${scriptPath}"`, { timeout: 300000 })
    const json = await fs.readFile(outputPath, 'utf-8')
    return JSON.parse(json) as AppleNote[]
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    if (msg.includes('not allowed') || msg.includes('permission') || msg.includes('-1743')) {
      throw new Error(
        '需要授权访问备忘录。请在「系统设置 → 隐私与安全性 → 自动化」中允许 Anyhark 控制"备忘录"'
      )
    }
    throw new Error(`读取备忘录失败: ${msg}`)
  } finally {
    await fs.unlink(scriptPath).catch(() => {})
    await fs.unlink(outputPath).catch(() => {})
  }
}

/**
 * Extract base64-encoded images from HTML, save to disk,
 * and return cleaned HTML with <img> tags removed.
 */
async function extractImages(
  html: string,
  createdAt: string
): Promise<{ cleanedHtml: string; imageFilenames: string[]; imageCount: number }> {
  const root = parseHTML(html)
  const imgElements = root.querySelectorAll('img')
  const imageFilenames: string[] = []

  for (const img of imgElements) {
    const src = img.getAttribute('src')
    if (!src?.startsWith('data:')) {
      img.remove()
      continue
    }

    try {
      const match = src.match(/^data:image\/([\w+]+);base64,(.+)$/)
      if (!match) {
        img.remove()
        continue
      }

      let ext = match[1].toLowerCase()
      if (ext === 'jpeg') ext = 'jpg'
      const buffer = Buffer.from(match[2], 'base64')

      const newFilename = `img_${ulid()}.${ext}`
      const date = new Date(createdAt)
      const year = date.getFullYear().toString()
      const month = (date.getMonth() + 1).toString().padStart(2, '0')
      const destDir = path.join(getImagesDir(), year, month)
      await fs.mkdir(destDir, { recursive: true })
      await fs.writeFile(path.join(destDir, newFilename), buffer)

      imageFilenames.push(newFilename)
    } catch {
      // Skip unreadable images
    }

    img.remove()
  }

  return { cleanedHtml: root.toString(), imageFilenames, imageCount: imageFilenames.length }
}

// ---- HTML to TipTap conversion (tailored for Apple Notes HTML) ----

function parseInlineContent(html: string): {
  nodes: TipTapNode[]
  text: string
} {
  const nodes: TipTapNode[] = []
  const textParts: string[] = []

  const root = parseHTML(html)

  for (const child of root.childNodes) {
    const el = child as ReturnType<typeof parseHTML>
    const tagName = el.tagName?.toLowerCase()

    let rawText = ''
    let marks: TipTapMark[] | undefined

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
      marks = [{ type: 'link', attrs: { href: el.getAttribute('href') || '' } }]
    } else if (tagName === 'span') {
      rawText = el.textContent || ''
      const style = el.getAttribute('style') || ''
      if (style.includes('font-weight') && (style.includes('bold') || style.includes('700'))) {
        marks = [{ type: 'bold' }]
      } else if (style.includes('font-style') && style.includes('italic')) {
        marks = [{ type: 'italic' }]
      } else if (style.includes('text-decoration') && style.includes('underline')) {
        marks = [{ type: 'underline' }]
      }
    } else if (tagName === 'br') {
      continue
    } else {
      rawText = el.textContent || ''
    }

    if (!rawText) continue

    // Convert # to + to avoid collision with Anyhark tags
    rawText = rawText.replace(/#/g, '+')

    textParts.push(rawText)
    const textNode: TipTapNode = { type: 'text', text: rawText }
    if (marks) textNode.marks = marks
    nodes.push(textNode)
  }

  return { nodes, text: textParts.join('') }
}

function htmlToTipTap(html: string): {
  document: TipTapDocument
  plainText: string
} {
  const root = parseHTML(html)
  const content: TipTapNode[] = []
  const textParts: string[] = []

  for (const child of root.childNodes) {
    const el = child as ReturnType<typeof parseHTML>
    const tagName = el.tagName?.toLowerCase()

    if (tagName === 'h1' || tagName === 'h2' || tagName === 'h3') {
      const { nodes, text } = parseInlineContent(el.innerHTML)
      textParts.push(text)
      content.push({
        type: 'heading',
        attrs: { level: parseInt(tagName[1]) },
        content: nodes.length > 0 ? nodes : undefined
      })
    } else if (tagName === 'p' || tagName === 'div') {
      const innerHTML = el.innerHTML?.trim()
      if (innerHTML === '<br>' || innerHTML === '' || !innerHTML) {
        content.push({ type: 'paragraph' })
      } else {
        const { nodes, text } = parseInlineContent(el.innerHTML)
        textParts.push(text)
        content.push({ type: 'paragraph', content: nodes.length > 0 ? nodes : undefined })
      }
    } else if (tagName === 'ul') {
      const items = el.querySelectorAll('li')
      const listContent: TipTapNode[] = []
      for (const li of items) {
        const { nodes, text } = parseInlineContent(li.innerHTML)
        textParts.push(text)
        listContent.push({
          type: 'listItem',
          content: [{ type: 'paragraph', content: nodes.length > 0 ? nodes : undefined }]
        })
      }
      if (listContent.length > 0) content.push({ type: 'bulletList', content: listContent })
    } else if (tagName === 'ol') {
      const items = el.querySelectorAll('li')
      const listContent: TipTapNode[] = []
      for (const li of items) {
        const { nodes, text } = parseInlineContent(li.innerHTML)
        textParts.push(text)
        listContent.push({
          type: 'listItem',
          content: [{ type: 'paragraph', content: nodes.length > 0 ? nodes : undefined }]
        })
      }
      if (listContent.length > 0) content.push({ type: 'orderedList', content: listContent })
    } else if (el.textContent?.trim()) {
      const { nodes, text } = parseInlineContent(el.textContent)
      textParts.push(text)
      content.push({ type: 'paragraph', content: nodes.length > 0 ? nodes : undefined })
    }
  }

  return {
    document: { type: 'doc', content: content.length > 0 ? content : [{ type: 'paragraph' }] },
    plainText: textParts.join(' ').replace(/\s+/g, ' ').trim()
  }
}

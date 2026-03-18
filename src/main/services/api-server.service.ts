import http from 'http'
import fs from 'fs'
import path from 'path'
import { app, BrowserWindow } from 'electron'
import { createWriteStream } from 'fs'
import archiver from 'archiver'
import * as memoService from './memo.service'
import * as tagIndexService from './tag-index.service'
import * as searchService from './search.service'
import { getImagePath } from './image.service'
import type { TipTapDocument, TipTapNode, CreateMemoRequest, UpdateMemoRequest } from '@shared/types'

const API_PORT = 17533
let server: http.Server | null = null

function notifyRendererDataChanged(): void {
  for (const win of BrowserWindow.getAllWindows()) {
    win.webContents.send('data-changed')
  }
}

function jsonResponse(res: http.ServerResponse, data: unknown, status = 200): void {
  res.writeHead(status, { 'Content-Type': 'application/json' })
  res.end(JSON.stringify(data))
}

function errorResponse(res: http.ServerResponse, message: string, status = 400): void {
  jsonResponse(res, { error: message }, status)
}

function readBody(req: http.IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = []
    req.on('data', (chunk) => chunks.push(chunk))
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf-8')))
    req.on('error', reject)
  })
}

function parseRoute(url: string): { path: string; query: Record<string, string> } {
  const [pathname, qs] = url.split('?')
  const query: Record<string, string> = {}
  if (qs) {
    for (const pair of qs.split('&')) {
      const [k, v] = pair.split('=')
      if (k) query[decodeURIComponent(k)] = decodeURIComponent(v || '')
    }
  }
  return { path: pathname, query }
}

/**
 * Convert plain text with #tags into a TipTap document.
 */
function textToTipTapDoc(text: string): { doc: TipTapDocument; tags: string[] } {
  const tags = new Set<string>()
  const lines = text.split('\n')
  const content: TipTapNode[] = []

  for (const line of lines) {
    const inlineNodes: TipTapNode[] = []
    const tagRegex = /#([\w\u4e00-\u9fff\u3400-\u4dbf/]+)/g
    let lastIndex = 0
    let match: RegExpExecArray | null

    while ((match = tagRegex.exec(line)) !== null) {
      if (match.index > lastIndex) {
        inlineNodes.push({ type: 'text', text: line.slice(lastIndex, match.index) })
      }
      const tagPath = match[1]
      tags.add(tagPath)
      inlineNodes.push({
        type: 'tag',
        attrs: { path: tagPath, label: `#${tagPath}` }
      })
      inlineNodes.push({ type: 'text', text: ' ' })
      lastIndex = match.index + match[0].length
    }

    if (lastIndex < line.length) {
      inlineNodes.push({ type: 'text', text: line.slice(lastIndex) })
    }

    content.push({
      type: 'paragraph',
      content: inlineNodes.length > 0 ? inlineNodes : undefined
    })
  }

  return {
    doc: { type: 'doc', content: content.length > 0 ? content : [{ type: 'paragraph' }] },
    tags: [...tags]
  }
}

async function handleRequest(req: http.IncomingMessage, res: http.ServerResponse): Promise<void> {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

  if (req.method === 'OPTIONS') {
    res.writeHead(204)
    res.end()
    return
  }

  const { path: urlPath, query } = parseRoute(req.url || '/')
  const method = req.method || 'GET'

  try {
    // GET /api/memos
    if (method === 'GET' && urlPath === '/api/memos') {
      const metas = memoService.listMemoMeta()
      const limit = query.limit ? parseInt(query.limit) : undefined
      const offset = query.offset ? parseInt(query.offset) : 0
      const sliced = limit ? metas.slice(offset, offset + limit) : metas.slice(offset)
      return jsonResponse(res, { memos: sliced, total: metas.length })
    }

    // GET /api/memos/:id
    const memoMatch = urlPath.match(/^\/api\/memos\/([A-Za-z0-9]+)$/)
    if (method === 'GET' && memoMatch) {
      const memo = await memoService.readMemo(memoMatch[1])
      return jsonResponse(res, memo)
    }

    // POST /api/memos
    if (method === 'POST' && urlPath === '/api/memos') {
      const body = JSON.parse(await readBody(req))
      let createReq: CreateMemoRequest

      if (body.content && typeof body.content === 'object' && body.content.type === 'doc') {
        createReq = body as CreateMemoRequest
      } else {
        const text = body.text || body.content || ''
        const { doc, tags } = textToTipTapDoc(text)
        createReq = {
          content: doc,
          plainText: text.replace(/#[\w\u4e00-\u9fff\u3400-\u4dbf/]+/g, '').replace(/\s+/g, ' ').trim(),
          tags,
          images: []
        }
      }

      const memo = await memoService.createMemo(createReq)
      tagIndexService.updateTagsForMemo(memo.id, [], memo.tags)
      await tagIndexService.save()
      notifyRendererDataChanged()
      return jsonResponse(res, memo, 201)
    }

    // PUT /api/memos/:id
    if (method === 'PUT' && memoMatch) {
      const body = JSON.parse(await readBody(req))
      const id = memoMatch[1]
      const oldMemo = await memoService.readMemo(id)
      let updateReq: UpdateMemoRequest

      if (body.content && typeof body.content === 'object' && body.content.type === 'doc') {
        updateReq = { id, ...body } as UpdateMemoRequest
      } else {
        const text = body.text || body.content || ''
        const { doc, tags } = textToTipTapDoc(text)
        updateReq = {
          id,
          content: doc,
          plainText: text.replace(/#[\w\u4e00-\u9fff\u3400-\u4dbf/]+/g, '').replace(/\s+/g, ' ').trim(),
          tags,
          images: oldMemo.images
        }
      }

      const memo = await memoService.updateMemo(updateReq)
      tagIndexService.updateTagsForMemo(memo.id, oldMemo.tags, memo.tags)
      await tagIndexService.save()
      notifyRendererDataChanged()
      return jsonResponse(res, memo)
    }

    // DELETE /api/memos/:id
    if (method === 'DELETE' && memoMatch) {
      const id = memoMatch[1]
      const oldMemo = await memoService.readMemo(id)
      await memoService.softDeleteMemo(id)
      tagIndexService.updateTagsForMemo(id, oldMemo.tags, [])
      await tagIndexService.save()
      notifyRendererDataChanged()
      return jsonResponse(res, { ok: true })
    }

    // GET /api/tags
    if (method === 'GET' && urlPath === '/api/tags') {
      return jsonResponse(res, tagIndexService.getTagIndex())
    }

    // GET /api/search
    if (method === 'GET' && urlPath === '/api/search') {
      const searchReq = {
        keyword: query.keyword || undefined,
        tags: query.tag ? query.tag.split(',') : undefined,
        hasImage: query.hasImage === 'true' ? true : undefined,
        includeDeleted: query.includeDeleted === 'true' ? true : undefined
      }
      const memos = searchReq.includeDeleted
        ? [...memoService.listMemoMeta(), ...memoService.listDeletedMeta()]
        : memoService.listMemoMeta()
      return jsonResponse(res, searchService.search(searchReq, memos))
    }

    // GET /api/stats
    if (method === 'GET' && urlPath === '/api/stats') {
      const active = memoService.listMemoMeta()
      const deleted = memoService.listDeletedMeta()
      const tagIdx = tagIndexService.getTagIndex()
      const totalImages = active.reduce((sum, m) => sum + m.images.length, 0)
      const totalWords = active.reduce((sum, m) => sum + m.wordCount, 0)
      return jsonResponse(res, {
        activeMemos: active.length,
        deletedMemos: deleted.length,
        totalTags: Object.keys(tagIdx.tags).length,
        totalImages,
        totalWords
      })
    }

    // POST /api/export/json
    if (method === 'POST' && urlPath === '/api/export/json') {
      const body = JSON.parse(await readBody(req))
      const outputPath = body.path
      if (!outputPath) return errorResponse(res, 'missing "path" in body')

      const memos = await memoService.getAllMemosForJsonExport()
      if (memos.length === 0) return jsonResponse(res, { count: 0, path: outputPath })

      const allImages = memos.flatMap((m) => m.images || [])

      await new Promise<void>((resolve, reject) => {
        const output = createWriteStream(outputPath)
        const archive = archiver('zip', { zlib: { level: 9 } })
        output.on('close', resolve)
        archive.on('error', reject)
        archive.pipe(output)

        for (const memo of memos) {
          archive.append(JSON.stringify(memo, null, 2), { name: `memos/${memo.id}.json` })
        }

        if (allImages.length > 0) {
          const proms = allImages.map((filename) =>
            getImagePath(filename)
              .then((absPath) => { archive.file(absPath, { name: `images/${filename}` }) })
              .catch(() => {})
          )
          Promise.all(proms).then(() => archive.finalize()).catch(reject)
        } else {
          archive.finalize()
        }
      })

      return jsonResponse(res, { count: memos.length, path: outputPath })
    }

    // GET /api/health
    if (method === 'GET' && urlPath === '/api/health') {
      return jsonResponse(res, { status: 'ok', version: app.getVersion() })
    }

    errorResponse(res, 'Not found', 404)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal server error'
    errorResponse(res, message, 500)
  }
}

export function startApiServer(): void {
  server = http.createServer((req, res) => {
    handleRequest(req, res).catch((err) => {
      console.error('[API] Unhandled error:', err)
      if (!res.headersSent) {
        errorResponse(res, 'Internal server error', 500)
      }
    })
  })

  server.listen(API_PORT, '127.0.0.1', () => {
    const portFile = path.join(app.getPath('userData'), 'api-port')
    fs.writeFileSync(portFile, String(API_PORT), 'utf-8')
    console.log(`[API] Server listening on http://127.0.0.1:${API_PORT}`)
  })

  server.on('error', (err: NodeJS.ErrnoException) => {
    if (err.code === 'EADDRINUSE') {
      console.warn(`[API] Port ${API_PORT} in use, trying next...`)
      const nextPort = API_PORT + 1
      server!.listen(nextPort, '127.0.0.1', () => {
        const portFile = path.join(app.getPath('userData'), 'api-port')
        fs.writeFileSync(portFile, String(nextPort), 'utf-8')
        console.log(`[API] Server listening on http://127.0.0.1:${nextPort}`)
      })
    } else {
      console.error('[API] Server error:', err)
    }
  })
}

export function stopApiServer(): void {
  if (server) {
    server.close()
    server = null
    try {
      const portFile = path.join(app.getPath('userData'), 'api-port')
      fs.unlinkSync(portFile)
    } catch {}
  }
}

#!/usr/bin/env npx tsx
/**
 * Anyhark CLI - Agent-friendly command-line interface.
 * Communicates with the running Anyhark app via its local HTTP API.
 *
 * Usage: npx tsx scripts/anyhark-cli.ts <command> [options]
 */

import fs from 'fs'
import path from 'path'
import os from 'os'
import http from 'http'

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

function getUserDataDir(): string {
  switch (process.platform) {
    case 'darwin':
      return path.join(os.homedir(), 'Library', 'Application Support', 'anyhark')
    case 'win32':
      return path.join(process.env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming'), 'anyhark')
    default:
      return path.join(os.homedir(), '.config', 'anyhark')
  }
}

function getApiPort(): number {
  const portFile = path.join(getUserDataDir(), 'api-port')
  try {
    return parseInt(fs.readFileSync(portFile, 'utf-8').trim())
  } catch {
    throw new Error(
      'Cannot read API port. Is Anyhark running?\n' +
      `Expected port file at: ${portFile}`
    )
  }
}

// ---------------------------------------------------------------------------
// HTTP client
// ---------------------------------------------------------------------------

interface ApiResponse {
  status: number
  data: unknown
}

function request(method: string, urlPath: string, body?: unknown): Promise<ApiResponse> {
  const port = getApiPort()
  const payload = body ? JSON.stringify(body) : undefined

  return new Promise((resolve, reject) => {
    const req = http.request(
      {
        hostname: '127.0.0.1',
        port,
        path: urlPath,
        method,
        headers: {
          'Content-Type': 'application/json',
          ...(payload ? { 'Content-Length': Buffer.byteLength(payload) } : {})
        }
      },
      (res) => {
        const chunks: Buffer[] = []
        res.on('data', (c) => chunks.push(c))
        res.on('end', () => {
          const raw = Buffer.concat(chunks).toString('utf-8')
          try {
            resolve({ status: res.statusCode || 200, data: JSON.parse(raw) })
          } catch {
            resolve({ status: res.statusCode || 200, data: raw })
          }
        })
      }
    )

    req.on('error', (err) => {
      if ((err as NodeJS.ErrnoException).code === 'ECONNREFUSED') {
        reject(new Error('Cannot connect to Anyhark API. Is the app running?'))
      } else {
        reject(err)
      }
    })

    if (payload) req.write(payload)
    req.end()
  })
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function output(data: unknown): void {
  console.log(JSON.stringify(data, null, 2))
}

function die(msg: string): never {
  console.error(JSON.stringify({ error: msg }))
  process.exit(1)
}

function parseArgs(args: string[]): { positional: string[]; flags: Record<string, string> } {
  const positional: string[] = []
  const flags: Record<string, string> = {}

  for (let i = 0; i < args.length; i++) {
    if (args[i].startsWith('--')) {
      const key = args[i].slice(2)
      const next = args[i + 1]
      if (next && !next.startsWith('--')) {
        flags[key] = next
        i++
      } else {
        flags[key] = 'true'
      }
    } else {
      positional.push(args[i])
    }
  }

  return { positional, flags }
}

// ---------------------------------------------------------------------------
// Commands
// ---------------------------------------------------------------------------

async function cmdList(flags: Record<string, string>): Promise<void> {
  const params = new URLSearchParams()
  if (flags.limit) params.set('limit', flags.limit)
  if (flags.offset) params.set('offset', flags.offset)
  const qs = params.toString()
  const res = await request('GET', `/api/memos${qs ? '?' + qs : ''}`)
  output(res.data)
}

async function cmdRead(positional: string[]): Promise<void> {
  const id = positional[0]
  if (!id) die('Usage: read <memo-id>')
  const res = await request('GET', `/api/memos/${id}`)
  if (res.status === 500) die(`Memo not found: ${id}`)
  output(res.data)
}

async function cmdCreate(positional: string[], flags: Record<string, string>): Promise<void> {
  const text = positional.join(' ') || flags.text
  if (!text) die('Usage: create <text> or create --text "content"')
  const res = await request('POST', '/api/memos', { text })
  output(res.data)
}

async function cmdUpdate(positional: string[], flags: Record<string, string>): Promise<void> {
  const id = positional[0]
  const text = positional.slice(1).join(' ') || flags.text
  if (!id || !text) die('Usage: update <memo-id> <text> or update <memo-id> --text "content"')
  const res = await request('PUT', `/api/memos/${id}`, { text })
  if (res.status === 500) die(`Memo not found: ${id}`)
  output(res.data)
}

async function cmdDelete(positional: string[]): Promise<void> {
  const id = positional[0]
  if (!id) die('Usage: delete <memo-id>')
  const res = await request('DELETE', `/api/memos/${id}`)
  if (res.status === 500) die(`Memo not found: ${id}`)
  output(res.data)
}

async function cmdSearch(flags: Record<string, string>): Promise<void> {
  const params = new URLSearchParams()
  if (flags.keyword) params.set('keyword', flags.keyword)
  if (flags.tag) params.set('tag', flags.tag)
  if (flags.hasImage) params.set('hasImage', 'true')
  const qs = params.toString()
  if (!qs) die('Usage: search --keyword <text> [--tag <tag>] [--hasImage]')
  const res = await request('GET', `/api/search?${qs}`)
  output(res.data)
}

async function cmdTags(): Promise<void> {
  const res = await request('GET', '/api/tags')
  output(res.data)
}

async function cmdStats(): Promise<void> {
  const res = await request('GET', '/api/stats')
  output(res.data)
}

async function cmdExportJson(positional: string[]): Promise<void> {
  const outputPath = positional[0]
  if (!outputPath) die('Usage: export-json <output-file-path.zip>')
  const absPath = path.resolve(outputPath)
  const res = await request('POST', '/api/export/json', { path: absPath })
  output(res.data)
}

async function cmdHealth(): Promise<void> {
  const res = await request('GET', '/api/health')
  output(res.data)
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

const HELP = `Anyhark CLI - Agent-friendly command-line interface

Usage: npx tsx scripts/anyhark-cli.ts <command> [options]

Commands:
  list   [--limit N] [--offset N]           List memos (metadata)
  read   <id>                               Read full memo by ID
  create <text>                             Create a memo (supports #tag)
  update <id> <text>                        Update memo content
  delete <id>                               Soft-delete a memo
  search --keyword <kw> [--tag <t>]         Search memos
  tags                                      List all tags with counts
  stats                                     Show statistics
  export-json <output.zip>                  Export all memos as JSON ZIP
  health                                    Check API connection

All output is JSON for easy parsing by agents.
Requires Anyhark app to be running.`

async function main(): Promise<void> {
  const rawArgs = process.argv.slice(2)
  if (rawArgs.length === 0 || rawArgs[0] === '--help' || rawArgs[0] === '-h') {
    console.log(HELP)
    return
  }

  const command = rawArgs[0]
  const { positional, flags } = parseArgs(rawArgs.slice(1))

  switch (command) {
    case 'list':
      return cmdList(flags)
    case 'read':
      return cmdRead(positional)
    case 'create':
      return cmdCreate(positional, flags)
    case 'update':
      return cmdUpdate(positional, flags)
    case 'delete':
      return cmdDelete(positional)
    case 'search':
      return cmdSearch(flags)
    case 'tags':
      return cmdTags()
    case 'stats':
      return cmdStats()
    case 'export-json':
      return cmdExportJson(positional)
    case 'health':
      return cmdHealth()
    default:
      die(`Unknown command: ${command}. Run with --help for usage.`)
  }
}

main().catch((err) => {
  die(err.message || String(err))
})

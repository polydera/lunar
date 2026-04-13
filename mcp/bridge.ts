#!/usr/bin/env node
/**
 * Luna MCP Bridge — Node.js stdio MCP server that relays tool calls
 * to the Luna browser tab via WebSocket.
 *
 * Dev-only. In production, the hosted relay replaces this.
 *
 * Tool schemas are auto-generated: on connect, the bridge requests
 * __list_tools from the browser, which generates schemas from the
 * operator/scene-operator registries. No manual schema maintenance.
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js'
import WebSocket from 'ws'

const WS_URL = process.env.LUNA_WS_URL ?? 'ws://localhost:5174'
const TIMEOUT_MS = 60_000

// ── WebSocket connection to the browser ────────────────────

let ws: WebSocket | null = null
const pending = new Map<string, { resolve: (v: unknown) => void; reject: (e: Error) => void; timer: ReturnType<typeof setTimeout> }>()

// Cached tool schemas — fetched from browser on connect
let cachedTools: any[] | null = null

function connect(): Promise<void> {
  return new Promise((resolve, reject) => {
    ws = new WebSocket(WS_URL)

    ws.on('open', async () => {
      console.error(`[luna-mcp] WS connected to ${WS_URL}`)
      try {
        console.error('[luna-mcp] requesting __list_tools...')
        const tools = await sendToBrowser('__list_tools', {})
        cachedTools = tools as any[]
        console.error(`[luna-mcp] loaded ${cachedTools?.length ?? 0} tool schemas`)
        console.error('[luna-mcp] tool names:', cachedTools?.map((t: any) => t.name))
        resolveToolsReady?.()
      } catch (e) {
        console.error('[luna-mcp] __list_tools FAILED:', e)
        resolveToolsReady?.() // unblock even on failure
      }
      resolve()
    })

    ws.on('message', (data) => {
      try {
        const msg = JSON.parse(data.toString())
        if (msg.id && pending.has(msg.id)) {
          const p = pending.get(msg.id)!
          pending.delete(msg.id)
          clearTimeout(p.timer)
          if (msg.error) {
            p.reject(new Error(msg.error.message ?? 'Unknown error'))
          } else {
            p.resolve(msg.result)
          }
        }
      } catch {
        // Ignore non-JSON
      }
    })

    ws.on('close', () => {
      console.error('[luna-mcp] disconnected, scheduling reconnect...')
      ws = null
      for (const [id, p] of pending) {
        clearTimeout(p.timer)
        p.reject(new Error('WebSocket disconnected'))
        pending.delete(id)
      }
      scheduleReconnect()
    })

    ws.on('error', (err) => {
      if (!ws || ws.readyState !== WebSocket.OPEN) {
        reject(err)
      }
    })
  })
}

function scheduleReconnect() {
  setTimeout(async () => {
    try {
      await connect()
    } catch {
      console.error('[luna-mcp] reconnect failed, retrying in 3s...')
      scheduleReconnect()
    }
  }, 3000)
}

function sendToBrowser(method: string, params: Record<string, unknown>): Promise<unknown> {
  if (!ws || ws.readyState !== WebSocket.OPEN) {
    return Promise.reject(new Error('Not connected to Luna browser tab. Is the dev server running?'))
  }

  const id = crypto.randomUUID()
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      pending.delete(id)
      reject(new Error(`Request timed out after ${TIMEOUT_MS}ms`))
    }, TIMEOUT_MS)

    pending.set(id, { resolve, reject, timer })
    ws!.send(JSON.stringify({ jsonrpc: '2.0', id, method, params }))
  })
}

// ── MCP Server ─────────────────────────────────────────────

const server = new Server(
  { name: 'luna', version: '0.1.0' },
  { capabilities: { tools: {} } },
)

// Tool list is auto-generated from the browser's registries
// Wait for tools to be loaded before responding to ListTools
let toolsReady: Promise<void> | null = null
let resolveToolsReady: (() => void) | null = null
toolsReady = new Promise((r) => { resolveToolsReady = r })

server.setRequestHandler(ListToolsRequestSchema, async () => {
  if (cachedTools === null && toolsReady) {
    console.error('[luna-mcp] ListTools waiting for tools to load...')
    await toolsReady
  }
  console.error(`[luna-mcp] ListTools returning ${cachedTools?.length ?? 0} tools`)
  return { tools: cachedTools ?? [] }
})

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params
  try {
    const result = await sendToBrowser(name, (args as Record<string, unknown>) ?? {})

    // Build content blocks — extract images from results
    const content: Array<{ type: 'text'; text: string } | { type: 'image'; data: string; mimeType: string }> = []

    if (result && typeof result === 'object') {
      const r = result as any

      // Single __image result
      if (r.__image) {
        content.push({ type: 'image' as const, data: r.data, mimeType: r.mimeType })
        return { content }
      }

      // Batch results — separate images from non-images
      if (Array.isArray(r.results)) {
        const nonImages = r.results.filter((item: any) => !item?.__image)
        const images = r.results.filter((item: any) => item?.__image)

        if (nonImages.length > 0) {
          content.push({ type: 'text' as const, text: JSON.stringify({ ...r, results: nonImages }, null, 2) })
        }
        for (const img of images) {
          content.push({ type: 'image' as const, data: img.data, mimeType: img.mimeType })
        }
        if (content.length > 0) return { content }
      }
    }

    // Default: JSON text
    return {
      content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }],
    }
  } catch (e) {
    return {
      content: [{ type: 'text' as const, text: `Error: ${e instanceof Error ? e.message : String(e)}` }],
      isError: true,
    }
  }
})

// ── Start ──────────────────────────────────────────────────

async function main() {
  // Start MCP stdio transport immediately — don't block on WS connection.
  // The bridge will reconnect to the browser in the background.
  const transport = new StdioServerTransport()
  await server.connect(transport)
  console.error('[luna-mcp] MCP server started on stdio')

  // Connect to browser WS (retries automatically)
  try {
    await connect()
  } catch {
    console.error(`[luna-mcp] Initial connection to ${WS_URL} failed, retrying in background...`)
    scheduleReconnect()
  }
}

main()

/**
 * LunaMcpSession — Cloudflare Durable Object that bridges MCP clients
 * (Claude, etc.) with a Luna browser tab via WebSocket.
 *
 * Browser connects:  /mcp/{sessionId}/ws  (WebSocket upgrade)
 * MCP client calls:  POST /mcp/{sessionId} (MCP Streamable HTTP — JSON-RPC)
 * Status check:      GET /mcp/{sessionId}  (JSON status)
 *
 * MCP Streamable HTTP is just JSON-RPC over HTTP with SSE responses.
 * We handle it directly — no SDK needed on the server side.
 */

import { SERVER_INSTRUCTIONS } from '../src/mcp/instructions'

const TIMEOUT_MS = 60_000
const MCP_PROTOCOL_VERSION = '2025-03-26'

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Mcp-Session-Id',
  'Access-Control-Expose-Headers': 'Mcp-Session-Id',
}

interface PendingRequest {
  resolve: (value: unknown) => void
  reject: (reason: Error) => void
  timer: ReturnType<typeof setTimeout>
}

export class LunaMcpSession implements DurableObject {
  private browserWs: WebSocket | null = null
  private pending = new Map<string, PendingRequest>()
  private mcpSessionId = crypto.randomUUID()

  constructor(private state: DurableObjectState, private env: unknown) {}

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url)

    // CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: CORS_HEADERS })
    }

    // Browser WebSocket connection
    if (url.pathname.endsWith('/ws')) {
      if (request.headers.get('Upgrade') !== 'websocket') {
        return new Response('Expected WebSocket', { status: 426 })
      }

      const pair = new WebSocketPair()
      const [client, server] = [pair[0], pair[1]]

      server.accept()

      if (this.browserWs) {
        try { this.browserWs.close(1000, 'Replaced by new connection') } catch {}
      }
      this.browserWs = server

      server.addEventListener('message', (event) => {
        try {
          const msg = JSON.parse(event.data as string)
          if (msg.id && this.pending.has(msg.id)) {
            const p = this.pending.get(msg.id)!
            this.pending.delete(msg.id)
            clearTimeout(p.timer)
            if (msg.error) {
              p.reject(new Error(msg.error.message ?? 'Unknown error'))
            } else {
              p.resolve(msg.result)
            }
          }
        } catch {}
      })

      server.addEventListener('close', () => {
        this.browserWs = null
        for (const [id, p] of this.pending) {
          clearTimeout(p.timer)
          p.reject(new Error('Browser disconnected'))
          this.pending.delete(id)
        }
      })

      return new Response(null, { status: 101, webSocket: client })
    }

    // GET — SSE stream request → 405 (we don't support server-initiated messages)
    // This stops mcp-remote from polling. Plain GET without SSE accept → status JSON.
    if (request.method === 'GET') {
      if (request.headers.get('Accept')?.includes('text/event-stream')) {
        return new Response(null, { status: 405, headers: CORS_HEADERS })
      }
      return Response.json(
        { status: this.browserWs ? 'connected' : 'waiting' },
        { headers: CORS_HEADERS },
      )
    }

    // DELETE — close session
    if (request.method === 'DELETE') {
      if (this.browserWs) {
        try { this.browserWs.close(1000, 'Session closed') } catch {}
        this.browserWs = null
      }
      return new Response(null, { status: 204, headers: CORS_HEADERS })
    }

    // POST — MCP JSON-RPC
    if (request.method === 'POST') {
      return this.handleMcpPost(request)
    }

    return new Response('Method not allowed', { status: 405, headers: CORS_HEADERS })
  }

  private jsonResponse(body: unknown, status = 200, extraHeaders?: Record<string, string>): Response {
    return Response.json(body, {
      status,
      headers: { ...CORS_HEADERS, ...extraHeaders },
    })
  }

  private async handleMcpPost(request: Request): Promise<Response> {
    let body: any
    try {
      body = await request.json()
    } catch {
      return Response.json(
        { jsonrpc: '2.0', error: { code: -32700, message: 'Parse error' } },
        { status: 400 },
      )
    }

    const { method, id, params } = body

    // Notifications (no id field) — acknowledge and return
    if (id === undefined || id === null) {
      return new Response(null, { status: 202, headers: CORS_HEADERS })
    }

    // MCP initialize
    if (method === 'initialize') {
      return this.jsonResponse({
        jsonrpc: '2.0',
        id,
        result: {
          protocolVersion: MCP_PROTOCOL_VERSION,
          serverInfo: { name: 'lunar', version: '0.8.7' },
          capabilities: { tools: {} },
          instructions: SERVER_INSTRUCTIONS,
        },
      }, 200, { 'Mcp-Session-Id': this.mcpSessionId })
    }

    // MCP tools/list — relay to browser (single source of truth for schemas)
    if (method === 'tools/list') {
      if (!this.browserWs) {
        return this.jsonResponse({
          jsonrpc: '2.0',
          id,
          result: {
            content: [{ type: 'text', text: 'Error: Browser not connected. Open Lunar in a browser first.' }],
            isError: true,
          },
        })
      }
      try {
        const tools = await this.sendToBrowser('__list_tools', {})
        return this.jsonResponse({ jsonrpc: '2.0', id, result: { tools } })
      } catch (e) {
        return this.jsonResponse({
          jsonrpc: '2.0',
          id,
          error: { code: -1, message: e instanceof Error ? e.message : String(e) },
        })
      }
    }

    // MCP tools/call
    if (method === 'tools/call') {
      const { name, arguments: rawArgs } = params ?? {}
      // LLMs sometimes stringify complex args — parse any JSON strings back
      const args: Record<string, unknown> = {}
      for (const [k, v] of Object.entries(rawArgs ?? {})) {
        if (k === '_meta') continue
        if (typeof v === 'string') {
          try { args[k] = JSON.parse(v); continue } catch {}
        }
        args[k] = v
      }
      if (!this.browserWs) {
        return this.jsonResponse({
          jsonrpc: '2.0',
          id,
          result: {
            content: [{ type: 'text', text: 'Error: Browser not connected. Open Lunar in a browser first.' }],
            isError: true,
          },
        })
      }

      try {
        const result = await this.sendToBrowser(name, args)
        const content = this.formatResult(result)
        return this.jsonResponse({ jsonrpc: '2.0', id, result: { content } })
      } catch (e) {
        return this.jsonResponse({
          jsonrpc: '2.0',
          id,
          result: {
            content: [{ type: 'text', text: `Error: ${e instanceof Error ? e.message : String(e)}` }],
            isError: true,
          },
        })
      }
    }

    // MCP ping
    if (method === 'ping') {
      return this.jsonResponse({ jsonrpc: '2.0', id, result: {} })
    }

    return this.jsonResponse({
      jsonrpc: '2.0',
      id,
      error: { code: -32601, message: `Unknown method: ${method}` },
    })
  }

  private sendToBrowser(method: string, params: Record<string, unknown>): Promise<unknown> {
    if (!this.browserWs) {
      return Promise.reject(new Error('Browser not connected'))
    }

    const id = crypto.randomUUID()
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id)
        reject(new Error(`Request timed out after ${TIMEOUT_MS}ms`))
      }, TIMEOUT_MS)

      this.pending.set(id, { resolve, reject, timer })
      this.browserWs!.send(JSON.stringify({ jsonrpc: '2.0', id, method, params }))
    })
  }

  private formatResult(result: unknown): Array<{ type: string; text?: string; data?: string; mimeType?: string }> {
    if (!result || typeof result !== 'object') {
      return [{ type: 'text', text: JSON.stringify(result) }]
    }

    const r = result as any

    if (r.__image) {
      return [{ type: 'image', data: r.data, mimeType: r.mimeType }]
    }

    if (Array.isArray(r.results)) {
      const nonImages = r.results.filter((item: any) => !item?.__image)
      const images = r.results.filter((item: any) => item?.__image)

      if (images.length > 0) {
        const content: any[] = []
        if (nonImages.length > 0) {
          content.push({ type: 'text', text: JSON.stringify({ ...r, results: nonImages }, null, 2) })
        }
        for (const img of images) {
          content.push({ type: 'image', data: img.data, mimeType: img.mimeType })
        }
        return content
      }
    }

    return [{ type: 'text', text: JSON.stringify(result, null, 2) }]
  }
}

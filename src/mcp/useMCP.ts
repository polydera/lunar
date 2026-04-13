import { ref } from 'vue'
import { createHandler, type HandlerContext } from './handler'

const SESSION_KEY = 'luna-session'
const ENABLED_KEY = 'luna-mcp-enabled'

function getSessionId(): string {
  let id = localStorage.getItem(SESSION_KEY)
  if (!id) {
    id = crypto.randomUUID().slice(0, 8)
    localStorage.setItem(SESSION_KEY, id)
  }
  return id
}

/**
 * Composable that connects the browser to the MCP relay via WebSocket.
 *
 * In dev: connects to wrangler pages dev (same origin, proxied).
 * In prod: connects to the Cloudflare DO at /mcp/{sessionId}/ws.
 *
 * The DO relays MCP tool calls from AI clients to this browser tab.
 */
export function useMCP(ctx: HandlerContext) {
  const handler = createHandler(ctx)
  const sessionId = ref(getSessionId())
  const connected = ref(false)
  let ws: WebSocket | null = null
  let reconnectTimer: number | null = null

  function getMcpUrl(): string {
    return `${location.origin}/mcp/${sessionId.value}`
  }

  function connect() {
    const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:'
    const url = `${protocol}//${location.host}/mcp/${sessionId.value}/ws`

    try {
      ws = new WebSocket(url)
    } catch {
      scheduleReconnect()
      return
    }

    ws.onopen = () => {
      connected.value = true
    }

    ws.onmessage = async (event) => {
      let req: { jsonrpc?: string; id?: string; method?: string; params?: Record<string, unknown> }
      try {
        req = JSON.parse(event.data)
      } catch {
        return
      }

      if (!req.method || !req.id) return

      let response
      try {
        response = await handler({
          jsonrpc: '2.0',
          id: req.id,
          method: req.method,
          params: req.params ?? {},
        })
      } catch (e) {
        console.error('[mcp] handler error:', e)
        response = {
          jsonrpc: '2.0',
          id: req.id,
          error: { code: -1, message: e instanceof Error ? e.message : String(e) },
        }
      }

      try {
        ws?.send(JSON.stringify(response))
      } catch (e) {
        console.error('[mcp] send error:', e)
      }
    }

    ws.onclose = () => {
      ws = null
      connected.value = false
      scheduleReconnect()
    }

    ws.onerror = () => {
      ws?.close()
    }
  }

  function scheduleReconnect() {
    if (reconnectTimer) return
    reconnectTimer = window.setTimeout(() => {
      reconnectTimer = null
      connect()
    }, 3000)
  }

  function resetSession() {
    dispose()
    const id = crypto.randomUUID().slice(0, 8)
    localStorage.setItem(SESSION_KEY, id)
    sessionId.value = id
    connect()
  }

  // Auto-connect only if previously enabled
  if (localStorage.getItem(ENABLED_KEY) === '1') {
    connect()
  }

  function enable() {
    localStorage.setItem(ENABLED_KEY, '1')
    if (!ws) connect()
  }

  function disable() {
    localStorage.removeItem(ENABLED_KEY)
    if (reconnectTimer) {
      clearTimeout(reconnectTimer)
      reconnectTimer = null
    }
    ws?.close()
    ws = null
    connected.value = false
  }

  function dispose() {
    disable()
  }

  return { sessionId, connected, getMcpUrl, resetSession, connect: enable, dispose: disable }
}

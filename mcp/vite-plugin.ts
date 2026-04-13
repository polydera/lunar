import { WebSocketServer, type WebSocket } from 'ws'
import type { Plugin } from 'vite'

/**
 * Vite plugin that adds a `/ws/mcp` WebSocket relay endpoint.
 *
 * Dev-only — in production this is replaced by a hosted relay.
 * The plugin simply forwards messages between all connected clients
 * (typically: one MCP bridge process + one browser tab).
 *
 * We use a separate WebSocketServer on a different port to avoid
 * conflicting with Vite's HMR WebSocket, which caused page reloads.
 */
export function mcpWebSocket(): Plugin {
  const MCP_PORT = 5174
  let wss: WebSocketServer | null = null

  return {
    name: 'luna-mcp-ws',
    configureServer() {
      const clients = new Set<WebSocket>()
      wss = new WebSocketServer({ port: MCP_PORT })

      wss.on('connection', (ws) => {
        clients.add(ws)
        console.log(`[mcp-ws] client connected on :${MCP_PORT} (${clients.size} total)`)

        ws.on('message', (data) => {
          const msg = data.toString()
          for (const client of clients) {
            if (client !== ws && client.readyState === 1) {
              client.send(msg)
            }
          }
        })

        ws.on('close', () => {
          clients.delete(ws)
          console.log(`[mcp-ws] client disconnected (${clients.size} remaining)`)
        })
      })

      wss.on('listening', () => {
        console.log(`[mcp-ws] relay listening on ws://localhost:${MCP_PORT}`)
      })
    },
    closeBundle() {
      wss?.close()
    },
  }
}

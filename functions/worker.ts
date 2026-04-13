/**
 * Worker entrypoint — routes /mcp/* to Durable Objects.
 * Static assets (SPA) are served automatically by the assets binding
 * when the worker returns undefined/falls through.
 */

export { LunaMcpSession } from './mcp-session'

interface Env {
  MCP_SESSION: DurableObjectNamespace
  ASSETS: { fetch: (req: Request) => Promise<Response> }
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url)

    // Only handle /mcp/* — let assets serve everything else
    if (url.pathname.startsWith('/mcp/')) {
      const match = url.pathname.match(/^\/mcp\/([^/]+)(.*)$/)
      if (match) {
        const sessionId = match[1]!
        const id = env.MCP_SESSION.idFromName(sessionId)
        const stub = env.MCP_SESSION.get(id)
        return stub.fetch(request)
      }
    }

    // Serve static assets with COOP/COEP headers (required for SharedArrayBuffer / WASM threads)
    const response = await env.ASSETS.fetch(request)
    const headers = new Headers(response.headers)
    headers.set('Cross-Origin-Embedder-Policy', 'require-corp')
    headers.set('Cross-Origin-Opener-Policy', 'same-origin')
    return new Response(response.body, { status: response.status, statusText: response.statusText, headers })
  },
}

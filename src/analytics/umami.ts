const UMAMI_SCRIPT_SRC = 'https://cloud.umami.is/script.js'
const UMAMI_WEBSITE_ID = 'f211cf2a-47df-467d-bf7c-fbd008b1bfab'

type OperationSource = 'user' | 'mcp'

declare global {
  interface Window {
    umami?: {
      track: (eventName: string) => void
    }
  }
}

export function initAnalytics() {
  if (typeof document === 'undefined') return
  if (document.querySelector(`script[data-website-id="${UMAMI_WEBSITE_ID}"]`)) return

  const script = document.createElement('script')
  script.defer = true
  script.crossOrigin = 'anonymous'
  script.src = UMAMI_SCRIPT_SRC
  script.dataset.websiteId = UMAMI_WEBSITE_ID
  document.head.appendChild(script)
}

export function trackOperation(source: OperationSource, operatorId: string) {
  if (typeof window === 'undefined') return
  window.umami?.track(`${source}:${operatorId}`)
}

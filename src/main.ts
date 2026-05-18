import './assets/main.css'
import { initAnalytics } from './analytics/umami'

// In dev this resolves to the auto-init entry (top-level `await init()` fires
// on import; wasm comes from local node_modules). In prod the Vite alias
// rewrites this to `@polydera/trueform/manual` — no auto-init — and boot()
// below calls tf.init() explicitly with CDN-backed wasm.
import * as tf from '@polydera/trueform'

async function boot() {
  if (import.meta.env.PROD) initAnalytics()

  if (!import.meta.env.DEV) {
    const base = `https://cdn.jsdelivr.net/npm/@polydera/trueform@${__TF_VERSION__}/dist`
    // toBlobURL wraps cross-origin assets as same-origin blob: URLs.
    // Required: worker.js must be same-origin to be loaded as a Worker.
    await tf.init({
      wasmUrl: await tf.toBlobURL(`${base}/trueform_wasm.wasm`, 'application/wasm'),
      workerUrl: await tf.toBlobURL(`${base}/trueform_wasm.js`, 'text/javascript'),
    })
  }

  // Dynamic import: App.vue and its transitive deps evaluate AFTER init,
  // so any module-level tf calls in those files see a ready engine.
  const { createApp } = await import('vue')
  const { default: App } = await import('./App.vue')
  const { default: ui } = await import('@nuxt/ui/vue-plugin')

  const app = createApp(App)
  app.use(ui)
  app.mount('#app')
}

boot().catch((err) => {
  document.getElementById('boot-splash')?.setAttribute('hidden', '')
  document.getElementById('boot-error')?.removeAttribute('hidden')
  console.error('Failed to load geometry engine:', err)
})

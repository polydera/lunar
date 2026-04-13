import './assets/main.css'

// Workaround for https://github.com/unovue/reka-ui/issues/1280
// Reka UI (Nuxt UI's substrate) uses `hideOthers` from the `aria-hidden` package
// to mark #app as aria-hidden="true" when any overlay (modal, popover, select,
// dropdown) opens. Trigger buttons inside #app retain focus, which Chrome flags
// as a WAI-ARIA violation. The same package exports `suppressOthers`, which
// uses the `inert` attribute instead — inert natively prevents focus, so the
// warning doesn't fire. We swap the export before Reka UI imports it.
// Remove this block once reka-ui switches to suppressOthers upstream.
import * as ariaHidden from 'aria-hidden'
;(ariaHidden as unknown as { hideOthers: typeof ariaHidden.suppressOthers }).hideOthers = ariaHidden.suppressOthers

import { createApp } from 'vue'
import App from './App.vue'

import ui from '@nuxt/ui/vue-plugin'

const app = createApp(App)
app.use(ui)

app.mount('#app')

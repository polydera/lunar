import { ref, computed } from 'vue'

// "Roomy" = device has enough space in BOTH dimensions for the docked desktop
// layout AND a precise primary pointer (mouse/trackpad). Anything else —
// phone landscape, narrow window, OR a touch-primary device like an iPad —
// collapses to the mobile chip layout. iPads paired with Magic Mouse /
// trackpad report `(pointer: fine)` and stay on desktop layout.
//
// Keep the conditions in sync with the `roomy:` Tailwind variant defined
// in `src/assets/main.css`. Single source of truth lives in that CSS file
// via the `@custom-variant` directive; JS mirrors it here.
export const ROOMY_MIN_WIDTH = 768
export const ROOMY_MIN_HEIGHT = 501
const TABLET_MAX = 1023

const width = ref(typeof window !== 'undefined' ? window.innerWidth : 1280)
const height = ref(typeof window !== 'undefined' ? window.innerHeight : 800)
const portraitMq = typeof window !== 'undefined' ? window.matchMedia('(orientation: portrait)') : null
const portrait = ref(portraitMq?.matches ?? false)
const fineMq = typeof window !== 'undefined' ? window.matchMedia('(pointer: fine)') : null
const fine = ref(fineMq?.matches ?? true)

let listenersBound = false
function bindListeners() {
  if (listenersBound || typeof window === 'undefined') return
  listenersBound = true
  window.addEventListener(
    'resize',
    () => {
      width.value = window.innerWidth
      height.value = window.innerHeight
    },
    { passive: true },
  )
  portraitMq?.addEventListener('change', (e) => (portrait.value = e.matches))
  fineMq?.addEventListener('change', (e) => (fine.value = e.matches))
}

const isRoomy = computed(
  () => fine.value && width.value >= ROOMY_MIN_WIDTH && height.value >= ROOMY_MIN_HEIGHT,
)

export function useBreakpoint() {
  bindListeners()
  return {
    width,
    height,
    // Mobile UI applies whenever the device is *not* roomy — phone in either
    // orientation, narrow desktop window, or a short-height window where
    // docked panels would steal too much viewport.
    isMobile: computed(() => !isRoomy.value),
    isTablet: computed(() => isRoomy.value && width.value <= TABLET_MAX),
    isDesktop: computed(() => isRoomy.value && width.value > TABLET_MAX),
    isPortrait: computed(() => portrait.value),
    isLandscape: computed(() => !portrait.value),
  }
}

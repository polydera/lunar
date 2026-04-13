import { reactive, watch } from 'vue'
import type { ColorMapName } from '@/core'

/**
 * Persistent application preferences.
 *
 * Module-level singleton: every consumer imports `prefs` and reads/writes the
 * same reactive object. Changes auto-save to localStorage (debounced 300ms).
 */

export interface Preferences {
  preventRefresh: boolean
  autoFitOnImport: boolean
  defaultColormap: ColorMapName
  defaultObjectColor: string
  defaultCurvesColor: string
  zoomSpeed: number
  skipOnboarding: boolean
}

const STORAGE_KEY = 'lunar.prefs.v1'

export const DEFAULTS: Readonly<Preferences> = {
  preventRefresh: true,
  autoFitOnImport: true,
  defaultColormap: 'polydera',
  defaultObjectColor: '#cccccc',
  defaultCurvesColor: '#00d5be',
  zoomSpeed: 1.0,
  skipOnboarding: false,
}

export const prefs = reactive<Preferences>({ ...DEFAULTS })

try {
  const stored = localStorage.getItem(STORAGE_KEY)
  if (stored) {
    const parsed = JSON.parse(stored) as Partial<Preferences>
    Object.assign(prefs, parsed)
  }
} catch {
  // Corrupt / unavailable storage — keep defaults.
}

let saveTimer: ReturnType<typeof setTimeout> | undefined

watch(
  () => ({ ...prefs }),
  () => {
    clearTimeout(saveTimer)
    saveTimer = setTimeout(() => {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs))
      } catch {
        // Storage full or blocked — silently drop.
      }
    }, 300)
  },
  { deep: true },
)

export function resetPreferences() {
  Object.assign(prefs, DEFAULTS)
}

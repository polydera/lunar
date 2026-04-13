import { reactive } from 'vue'

const state = reactive<Record<string, unknown>>({})

export function useUIState() {
  return state
}

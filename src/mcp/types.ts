import type * as THREE from 'three'
import type { Input } from '@/core'
import type { useScene } from '@/scene/useScene'
import type { useActions } from '@/composables/useActions'
import type { useDispatcher } from '@/composables/useDispatcher'
import type { useViewport } from '@/viewport/useViewport'

type Scene = ReturnType<typeof useScene>
type Actions = ReturnType<typeof useActions>
type Dispatcher = ReturnType<typeof useDispatcher>
type Viewport = ReturnType<typeof useViewport>

export interface HandlerContext {
  scene: Scene
  actions: Actions
  dispatcher: Dispatcher
  getViewport: () => Viewport | null
  importFromUrl: (url: string, name: string) => Promise<void>
  onProgress?: ((operatorId: string, status: 'running' | 'done', index: number) => void) | undefined
}

export interface ActionDef {
  id: string
  label: string
  description: string
  category: string
  inputs: Input[]
  usesNodeIds?: boolean | 'optional'
  execute: (nodeIds: string[], params: Record<string, unknown>) => Promise<unknown> | unknown
}

/** Passed to each action registration module. */
export interface ActionRegistrar {
  register: (def: ActionDef) => void
  ctx: HandlerContext
  resolveTargets: (nodeIds: string[]) => string[]
  applyTransform: (nodeId: string, fn: (current: THREE.Matrix4) => THREE.Matrix4) => void
  sanitizeProperties: (props: Record<string, unknown>, worldTransform?: number[] | null) => Record<string, unknown>
  roundArr: (arr: number[]) => number[]
}

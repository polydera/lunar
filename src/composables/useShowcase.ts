import * as tf from '@polydera/trueform'
import { operands, operators, sceneOperators } from '@/core'
import { prefs } from '@/composables/usePreferences'
import type { useScene } from '@/scene/useScene'
import type { useDispatcher } from '@/composables/useDispatcher'
import type { useViewport } from '@/viewport/useViewport'

type Scene = ReturnType<typeof useScene>
type Dispatcher = ReturnType<typeof useDispatcher>
type Viewport = ReturnType<typeof useViewport>

/**
 * Download a mesh from URL, import it, compute shape index curvature,
 * and apply the polydera colormap — the "showcase" pipeline used by
 * the onboarding wizard and the download action.
 */
export function useShowcase(scene: Scene, dispatcher: Dispatcher, getViewport: () => Viewport | null) {
  async function downloadAndShowcase(name: string, url: string) {
    // Stage 1: Fetch
    const buffer = await dispatcher.dispatch('Fetch', name, async () => {
      const response = await fetch(url)
      return response.arrayBuffer()
    })

    // Stage 2: Import
    const ext = url.split('.').pop()?.toLowerCase()
    const { mesh, meshId } = await dispatcher.dispatch('Import', name, async () => {
      const mesh = ext === 'obj' ? tf.readObj(buffer, { dynamic: true }) : tf.readStl(buffer)
      await tf.async.buildTree(mesh)

      const meshId = operands.nextId(name)
      operands.add({ id: meshId, type: 'mesh', data: mesh })

      scene.addNode({
        id: meshId,
        label: name,
        parentId: null,
        order: 0,
        operandId: meshId,
        visible: true,
        color: prefs.defaultObjectColor,
        opacity: 100,
        renderMode: 'solid',
      })

      scene.clearSelection()
      scene.select(meshId, false)

      return { mesh, meshId }
    })

    // Stage 3: Curvature
    const curvatureId = await dispatcher.dispatch('Curvature', name, async () => {
      const curvatureOp = operators.get('tf.curvature')!
      const result = await curvatureOp.async({ mesh, variant: 'shapeIndex', k: 2 })

      const arrays = (result as Record<string, unknown>).curvature as tf.NDArrayFloat32[]
      const id = operands.nextId('shape-index')
      operands.add({ id, type: 'ndarray', data: arrays[0]! })

      scene.addNode({
        id,
        label: 'Shape Index',
        parentId: meshId,
        order: 0,
        operandId: id,
        visible: true,
        color: prefs.defaultObjectColor,
        opacity: 100,
        renderMode: 'solid',
      })

      return id
    })

    // Stage 4: Colorize
    const colorByArray = sceneOperators.get('style.colorByArray')!
    colorByArray.apply(
      meshId,
      {
        array: curvatureId,
        colorMap: 'polydera',
        clip: 2,
      },
      scene,
    )

    // Fit camera
    requestAnimationFrame(() => getViewport()?.fitToScene())
  }

  return { downloadAndShowcase }
}

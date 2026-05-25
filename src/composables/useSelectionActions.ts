import { computed } from 'vue'
import * as tf from '@polydera/trueform'
import { operands } from '@/core'
import { copyTransform } from '@/core/utils'
import { defaults } from '@/setup/theme'
import type { useScene } from '@/scene/useScene'
import type { useViewport } from '@/viewport/useViewport'

type Scene = ReturnType<typeof useScene>
type Viewport = ReturnType<typeof useViewport>

export function useSelectionActions(scene: Scene, getViewport: () => Viewport | null) {
  function deleteSelection() {
    const ids = [...scene.activeSelection]
    for (const id of ids) scene.removeNode(id)
  }

  function duplicateSelection() {
    for (const nodeId of [...scene.activeSelection]) {
      const node = scene.getNode(nodeId)
      if (!node?.operandId) continue
      const operand = operands.get(node.operandId)
      if (!operand || operand.type !== 'mesh') continue
      const original = operand.data as tf.Mesh
      const copy = original.shallowCopy()
      copyTransform(original, copy)
      const id = operands.nextId(node.label)
      operands.add({ id, type: 'mesh', data: copy })
      scene.addNode({
        id,
        label: `${node.label} copy`,
        parentId: null,
        order: 0,
        operandId: id,
        visible: true,
        color: node.color,
        opacity: node.opacity,
        renderMode: node.renderMode,
      })
    }
  }

  const renderMode = computed(() => {
    scene.tree.value
    if (scene.activeSelection.length === 0) return 'solid'
    const node = scene.getNode(scene.activeSelection[0]!)
    return node?.renderMode ?? 'solid'
  })

  function setRenderMode(mode: 'solid' | 'wireframe' | 'points') {
    for (const id of scene.activeSelection) scene.setRenderMode(id, mode)
  }

  const color = computed({
    get() {
      scene.version.value
      if (scene.activeSelection.length === 1) {
        return scene.getNode(scene.activeSelection[0]!)?.color ?? defaults.objectColor
      }
      return defaults.objectColor
    },
    set(c: string) {
      for (const id of scene.activeSelection) scene.setColor(id, c)
    },
  })

  function setColor(c: string | undefined) {
    if (!c) return
    for (const id of scene.activeSelection) scene.setColor(id, c)
  }

  const opacity = computed({
    get() {
      scene.version.value
      if (scene.activeSelection.length === 1) {
        return scene.getNode(scene.activeSelection[0]!)?.opacity ?? 100
      }
      return 100
    },
    set(o: number) {
      for (const id of scene.activeSelection) scene.setOpacity(id, o)
    },
  })

  function setOpacity(o: number | undefined) {
    if (o == null) return
    for (const id of scene.activeSelection) scene.setOpacity(id, o)
  }

  function focusSelection() {
    requestAnimationFrame(() => getViewport()?.fitToNodes([...scene.activeSelection]))
  }

  return {
    deleteSelection,
    duplicateSelection,
    renderMode,
    setRenderMode,
    color,
    setColor,
    opacity,
    setOpacity,
    focusSelection,
  }
}

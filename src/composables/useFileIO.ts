import * as tf from '@polydera/trueform'
import { operands } from '@/core'
import { prefs } from '@/composables/usePreferences'
import type { useScene } from '@/scene/useScene'
import type { useDispatcher } from '@/composables/useDispatcher'
import type { useViewport } from '@/viewport/useViewport'

type Scene = ReturnType<typeof useScene>
type Dispatcher = ReturnType<typeof useDispatcher>
type Viewport = ReturnType<typeof useViewport>

export function useFileIO(scene: Scene, dispatcher: Dispatcher, getViewport: () => Viewport | null) {
  function importFile(file: File) {
    const name = file.name.replace(/\.[^.]+$/, '')
    const ext = file.name.split('.').pop()?.toLowerCase()

    dispatcher.dispatch('Import', name, async () => {
      const buffer = await file.arrayBuffer()
      const mesh = ext === 'obj' ? tf.readObj(buffer, { dynamic: true }) : tf.readStl(buffer)
      await tf.async.buildTree(mesh)

      const id = operands.nextId(name)
      operands.add({ id, type: 'mesh', data: mesh })

      scene.addNode({
        id,
        label: name,
        parentId: null,
        order: 0,
        operandId: id,
        visible: true,
        color: prefs.defaultObjectColor,
        opacity: 100,
        renderMode: 'solid',
      })

      if (prefs.autoFitOnImport) {
        requestAnimationFrame(() => getViewport()?.fitToScene())
      }
    })
  }

  async function importFromUrl(url: string, name: string) {
    const buffer = await dispatcher.dispatch('Fetch', name, async () => {
      const response = await fetch(url)
      return response.arrayBuffer()
    })

    await dispatcher.dispatch('Import', name, async () => {
      const ext = url.split('.').pop()?.toLowerCase()
      const mesh = ext === 'obj' ? tf.readObj(buffer, { dynamic: true }) : tf.readStl(buffer)
      await tf.async.buildTree(mesh)

      const id = operands.nextId(name)
      operands.add({ id, type: 'mesh', data: mesh })

      scene.addNode({
        id,
        label: name,
        parentId: null,
        order: 0,
        operandId: id,
        visible: true,
        color: prefs.defaultObjectColor,
        opacity: 100,
        renderMode: 'solid',
      })

      if (prefs.autoFitOnImport) {
        requestAnimationFrame(() => getViewport()?.fitToScene())
      }
    })
  }

  function exportSelection(format: 'stl' | 'obj') {
    for (const nodeId of scene.activeSelection) {
      const node = scene.getNode(nodeId)
      if (!node?.operandId) continue
      const operand = operands.get(node.operandId)
      if (!operand || operand.type !== 'mesh') continue
      const mesh = operand.data as tf.Mesh

      const writePromise = format === 'stl' ? tf.async.writeStl(mesh) : tf.async.writeObj(mesh)
      writePromise.then((raw) => {
        const blob = new Blob([new Uint8Array(raw.data)])
        downloadBlob(blob, `${node.label}.${format}`)
      })
    }
  }

  function downloadBlob(blob: Blob, filename: string) {
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    a.click()
    URL.revokeObjectURL(url)
  }

  function onDragOver(e: DragEvent) {
    e.preventDefault()
  }

  function onDrop(e: DragEvent) {
    e.preventDefault()
    if (!e.dataTransfer?.files) return
    const files = Array.from(e.dataTransfer.files).filter((f) => {
      const ext = f.name.split('.').pop()?.toLowerCase()
      return ext === 'stl' || ext === 'obj'
    })
    files.forEach(importFile)
  }

  return { importFile, importFromUrl, exportSelection, onDragOver, onDrop }
}

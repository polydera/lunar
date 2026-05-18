import * as tf from '@polydera/trueform'
import { zipSync } from 'fflate'
import { operands } from '@/core'
import { prefs } from '@/composables/usePreferences'
import type { useScene } from '@/scene/useScene'
import type { useDispatcher } from '@/composables/useDispatcher'
import type { useViewport } from '@/viewport/useViewport'

type Scene = ReturnType<typeof useScene>
type Dispatcher = ReturnType<typeof useDispatcher>
type Viewport = ReturnType<typeof useViewport>

// OBJ supports a dtype option; STL is float32 by spec, upcast at boundary
// if pref is float64.
export function readMesh(buffer: ArrayBuffer, ext: string | undefined): tf.Mesh {
  const dtype = prefs.floatDtype
  if (ext === 'obj') {
    return tf.readObj(buffer, { dynamic: true, dtype })
  }
  const raw = tf.readStl(buffer)
  if (dtype === 'float32') return raw
  const facesNd = raw.faces
  const pointsTarget = raw.points.as(dtype)
  const mesh = tf.mesh(facesNd, pointsTarget)
  facesNd.delete()
  pointsTarget.delete()
  raw.delete()
  return mesh
}

export function useFileIO(scene: Scene, dispatcher: Dispatcher, getViewport: () => Viewport | null) {
  function importFile(file: File) {
    const name = file.name.replace(/\.[^.]+$/, '')
    const ext = file.name.split('.').pop()?.toLowerCase()

    dispatcher.dispatch('Import', name, async () => {
      const buffer = await file.arrayBuffer()
      const mesh = readMesh(buffer, ext)
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
      const mesh = readMesh(buffer, ext)
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

  async function exportSelection(format: 'stl' | 'obj', nodeIds?: string[]) {
    const ids = nodeIds && nodeIds.length > 0 ? nodeIds : [...scene.activeSelection]

    type Pending = { label: string; mesh: tf.Mesh }
    const pending: Pending[] = []
    for (const nodeId of ids) {
      const node = scene.getNode(nodeId)
      if (!node?.operandId) continue
      const operand = operands.get(node.operandId)
      if (!operand || operand.type !== 'mesh') continue
      pending.push({ label: node.label, mesh: operand.data as tf.Mesh })
    }
    if (pending.length === 0) return

    const write = format === 'stl' ? tf.async.writeStl : tf.async.writeObj
    const results = await Promise.all(
      pending.map(async ({ label, mesh }) => ({ label, bytes: new Uint8Array((await write(mesh)).data) })),
    )

    if (results.length === 1) {
      const { label, bytes } = results[0]!
      downloadBlob(new Blob([bytes as BlobPart]), `${label}.${format}`)
      return
    }

    // Multi-select: zip with collision-suffixed filenames.
    const seen = new Map<string, number>()
    const files: Record<string, Uint8Array> = {}
    for (const { label, bytes } of results) {
      const base = `${label}.${format}`
      const n = seen.get(base) ?? 0
      seen.set(base, n + 1)
      const name = n === 0 ? base : `${label}-${n + 1}.${format}`
      files[name] = bytes
    }
    const zipped = zipSync(files)
    downloadBlob(new Blob([zipped as BlobPart], { type: 'application/zip' }), `meshes.zip`)
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

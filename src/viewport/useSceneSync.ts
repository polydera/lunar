import * as THREE from 'three'
import * as tf from '@polydera/trueform'
import type { useScene, SceneNode } from '@/scene/useScene'
import { operands } from '@/core'
import type { ColorByArrayArgs } from '@/core/sceneOperators/colorByArray'
import type { ShadingArgs, ShadingVariant } from '@/core/sceneOperators/shading'
import { defaults } from '@/setup/theme'
import { buildColorBuffer } from './colorMaps'
import type { Mesh } from '@polydera/trueform'

/** Scene operator id the viewport looks up for per-vertex color rendering. */
const COLOR_BY_ARRAY_ID = 'style.colorByArray'
const SHADING_ID = 'style.shading'

function getColorByArrayArgs(node: SceneNode): ColorByArrayArgs | undefined {
  return node.sceneOperatorState?.[COLOR_BY_ARRAY_ID] as ColorByArrayArgs | undefined
}

function getShadingArgs(node: SceneNode): ShadingArgs | undefined {
  return node.sceneOperatorState?.[SHADING_ID] as ShadingArgs | undefined
}

type Scene = ReturnType<typeof useScene>

export function useSceneSync(threeScene: THREE.Scene, scene: Scene) {
  // ── Matcap texture ───────────────────────────────────────

  const matcapUrl = 'https://raw.githubusercontent.com/nidorx/matcaps/master/1024/635D52_A9BCC0_B1AEA0_819598.png'
  let matcapTexture: THREE.Texture | null = null
  new THREE.TextureLoader().load(matcapUrl, (tex) => {
    matcapTexture = tex
    for (const obj of threeObjects.values()) {
      if (obj instanceof THREE.Mesh && obj.material instanceof THREE.MeshMatcapMaterial) {
        obj.material.matcap = matcapTexture!.clone()
        obj.material.needsUpdate = true
      }
    }
  })

  // ── Scene node → Three.js mapping ────────────────────────

  const threeObjects = new Map<string, THREE.Object3D>()

  // Geometry cache keyed by operandId. Multiple scene nodes that share
  // an operand (e.g. intersection curves linked to multiple parents)
  // share a single BufferGeometry via refcount.
  const geometryCache = new Map<string, { geometry: THREE.BufferGeometry; count: number; version: number }>()

  function acquireGeometry(operandId: string, version: number, build: () => THREE.BufferGeometry): THREE.BufferGeometry {
    const existing = geometryCache.get(operandId)
    if (existing) {
      if (existing.version === version) {
        existing.count++
        return existing.geometry
      }
      // Version mismatch — dispose old, build new
      existing.geometry.dispose()
      const geometry = build()
      geometryCache.set(operandId, { geometry, count: existing.count, version })
      return geometry
    }
    const geometry = build()
    geometryCache.set(operandId, { geometry, count: 1, version })
    return geometry
  }

  function releaseGeometry(operandId: string) {
    const entry = geometryCache.get(operandId)
    if (!entry) return
    entry.count--
    if (entry.count <= 0) {
      entry.geometry.dispose()
      geometryCache.delete(operandId)
    }
  }

  function createObject(node: SceneNode): THREE.Object3D {
    if (!node.operandId) return new THREE.Group()

    const operand = operands.get(node.operandId)
    if (!operand) return new THREE.Group()

    if (operand.type === 'mesh') return createMeshObject(node, operand.data as Mesh, operand.version)
    if (operand.type === 'curves') return createCurvesObject(node, operand.data as tf.Curves, operand.version)

    return new THREE.Group()
  }

  function buildMeshGeometryRaw(tfMesh: Mesh): THREE.BufferGeometry {
    const g = new THREE.BufferGeometry()
    const pts = tfMesh.points
    const fcs = tfMesh.faces
    g.setAttribute('position', new THREE.BufferAttribute(pts.data, 3))
    g.setIndex(new THREE.BufferAttribute(new Uint32Array(fcs.data.buffer, fcs.data.byteOffset, fcs.data.length), 1))
    g.computeBoundingSphere()
    pts.delete()
    fcs.delete()
    return g
  }

  /** Build and attach a per-vertex color buffer derived from a child ndarray operand. */
  function applyColorSource(geometry: THREE.BufferGeometry, source: ColorByArrayArgs, expectedLength: number): boolean {
    if (!source.array) return false
    const operand = operands.get(source.array)
    if (!operand || operand.type !== 'ndarray') return false
    const arr = operand.data as tf.NDArrayFloat32
    if (arr.shape[0] !== expectedLength) return false
    const colors = buildColorBuffer(arr, source.colorMap, source.clip)
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3))
    return true
  }

  /**
   * Apply shading configuration to the geometry. Attaches a per-vertex normal
   * attribute when variant === 'normals' (if the array is valid), or computes
   * smooth vertex normals for variant === 'smooth'. For 'flat', no normals are
   * needed (the material's flatShading derives them from face geometry).
   * Returns the effective variant actually applied.
   */
  function applyShading(
    geometry: THREE.BufferGeometry,
    shading: ShadingArgs | undefined,
    expectedLength: number,
  ): ShadingVariant {
    const variant = shading?.variant ?? 'flat'
    if (variant === 'normals' && shading?.normals) {
      const operand = operands.get(shading.normals)
      if (operand && operand.type === 'ndarray') {
        const arr = operand.data as tf.NDArrayFloat32
        if (arr.shape[0] === expectedLength && arr.shape[1] === 3) {
          geometry.setAttribute('normal', new THREE.BufferAttribute(new Float32Array(arr.data), 3))
          return 'normals'
        }
      }
      // Fall through to smooth if the array is invalid.
      geometry.computeVertexNormals()
      return 'smooth'
    }
    if (variant === 'smooth') {
      geometry.computeVertexNormals()
      return 'smooth'
    }
    return 'flat'
  }

  /**
   * Key that determines whether the mesh needs a geometry rebuild for shading.
   * Only identity-changing fields belong here.
   */
  function shadingKey(shading: ShadingArgs | undefined): string {
    const variant = shading?.variant ?? 'flat'
    if (variant === 'normals') return `normals:${shading?.normals ?? ''}`
    return variant
  }

  /**
   * Key that determines whether the mesh needs a geometry rebuild.
   * Only identity-changing fields belong here — when `array` is null, the
   * mesh falls back to its solid color path (no vertex colors), so clip/map
   * changes on a null-source are a no-op and don't need to invalidate.
   */
  function colorSourceKey(source: ColorByArrayArgs | undefined): string {
    if (!source || !source.array) return ''
    return `${source.array}:${source.colorMap}:${source.clip}`
  }

  function createMeshObject(node: SceneNode, tfMesh: Mesh, version: number): THREE.Mesh {
    const colorBy = getColorByArrayArgs(node)
    const shading = getShadingArgs(node)
    const hasColorSource = !!colorBy?.array
    const hasCustomShading = (shading?.variant ?? 'flat') !== 'flat'
    const needsCustomGeometry = hasColorSource || hasCustomShading

    let geometry: THREE.BufferGeometry
    let attached = false
    let effectiveShading: ShadingVariant = 'flat'
    if (needsCustomGeometry) {
      geometry = buildMeshGeometryRaw(tfMesh)
      if (hasColorSource) {
        attached = applyColorSource(geometry, colorBy!, tfMesh.numberOfPoints)
      }
      effectiveShading = applyShading(geometry, shading, tfMesh.numberOfPoints)
    } else {
      geometry = acquireGeometry(node.operandId!, version, () => buildMeshGeometryRaw(tfMesh))
    }

    const useVertexColors = hasColorSource && attached
    const material = new THREE.MeshMatcapMaterial({
      side: THREE.DoubleSide,
      flatShading: effectiveShading === 'flat',
      color: useVertexColors ? 0xffffff : node.color || defaults.objectColor,
      vertexColors: useVertexColors,
    })
    if (matcapTexture) {
      material.matcap = matcapTexture.clone()
    }
    if (node.opacity < 100) {
      material.transparent = true
      material.opacity = node.opacity / 100
    }

    const mesh = new THREE.Mesh(geometry, material)
    mesh.matrixAutoUpdate = false
    mesh.userData.operandVersion = version
    if (needsCustomGeometry) {
      mesh.userData.colorSourceKey = colorSourceKey(colorBy)
      mesh.userData.shadingKey = shadingKey(shading)
    } else {
      mesh.userData.operandId = node.operandId
    }
    return mesh
  }

  function createCurvesObject(node: SceneNode, curves: tf.Curves, version: number): THREE.Mesh {
    const geometry = acquireGeometry(node.operandId!, version, () => {
      let radius = 0.1
      if (node.parentId) {
        const parentNode = scene.getNode(node.parentId)
        if (parentNode?.operandId) {
          const aabb = scene.getProperties(parentNode.operandId)?.aabb as tf.AABB | undefined
          if (aabb) {
            const d = aabb.data as Float32Array
            const dx = d[3]! - d[0]!
            const dy = d[4]! - d[1]!
            const dz = d[5]! - d[2]!
            const diagonal = Math.sqrt(dx * dx + dy * dy + dz * dz)
            radius = diagonal * 0.002
          }
        }
      }

      const tubeMesh = tf.tubeMesh(curves, radius)
      const pts = tubeMesh.points
      const fcs = tubeMesh.faces
      const g = new THREE.BufferGeometry()
      g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(pts.data), 3))
      g.setIndex(new THREE.BufferAttribute(new Uint32Array(fcs.data), 1))
      g.computeBoundingSphere()
      pts.delete()
      fcs.delete()
      tubeMesh.delete()
      return g
    })

    const material = new THREE.MeshMatcapMaterial({
      side: THREE.DoubleSide,
      flatShading: false,
      color: node.color || defaults.curvesColor,
    })
    if (matcapTexture) {
      material.matcap = matcapTexture.clone()
    }

    const mesh = new THREE.Mesh(geometry, material)
    mesh.matrixAutoUpdate = false
    mesh.userData.operandId = node.operandId
    mesh.userData.operandVersion = version
    return mesh
  }

  function syncNode(id: string) {
    const node = scene.getNode(id)

    if (!node) {
      const obj = threeObjects.get(id)
      if (obj) {
        obj.parent?.remove(obj)
        disposeObject(obj)
        threeObjects.delete(id)
      }
      return
    }

    let obj = threeObjects.get(id)

    // Color source / shading state change.
    if (obj instanceof THREE.Mesh) {
      const colorBy = getColorByArrayArgs(node)
      const shading = getShadingArgs(node)
      const wantColorKey = colorSourceKey(colorBy)
      const haveColorKey = (obj.userData.colorSourceKey as string | undefined) ?? ''
      const wantShadingKey = shadingKey(shading)
      const haveShadingKey = (obj.userData.shadingKey as string | undefined) ?? 'flat'
      const colorChanged = wantColorKey !== haveColorKey
      const shadingChanged = wantShadingKey !== haveShadingKey
      if (colorChanged || shadingChanged) {
        let handled = false
        // In-place patch only works if we already had a custom geometry
        // (colorSourceKey/shadingKey were set) and we still do.
        const hadCustom = haveColorKey !== '' || haveShadingKey !== 'flat'
        const wantCustom = wantColorKey !== '' || wantShadingKey !== 'flat'
        if (hadCustom && wantCustom && node.operandId && obj.material instanceof THREE.MeshMatcapMaterial) {
          const meshOperand = operands.get(node.operandId)
          if (meshOperand?.type === 'mesh') {
            const tfMesh = meshOperand.data as Mesh
            let ok = true
            // Color transition (set / unset / swap)
            if (colorChanged) {
              if (wantColorKey !== '' && colorBy) {
                ok = applyColorSource(obj.geometry, colorBy, tfMesh.numberOfPoints)
                if (ok) {
                  obj.material.vertexColors = true
                  obj.material.color.set(0xffffff)
                }
              } else {
                obj.geometry.deleteAttribute('color')
                obj.material.vertexColors = false
                obj.material.color.set(node.color || defaults.objectColor)
              }
            }
            // Shading transition
            if (ok && shadingChanged) {
              const effective = applyShading(obj.geometry, shading, tfMesh.numberOfPoints)
              obj.material.flatShading = effective === 'flat'
            }
            if (ok) {
              obj.material.needsUpdate = true
              obj.userData.colorSourceKey = wantColorKey
              obj.userData.shadingKey = wantShadingKey
              handled = true
            }
          }
        }
        if (!handled) {
          obj.parent?.remove(obj)
          disposeObject(obj)
          threeObjects.delete(id)
          obj = undefined
        }
      }
    }

    // Operand data version check — if the underlying data was replaced,
    // dispose and recreate so the geometry rebuilds from new data.
    if (obj && node.operandId) {
      const operand = operands.get(node.operandId)
      if (operand && obj.userData.operandVersion !== operand.version) {
        obj.parent?.remove(obj)
        disposeObject(obj)
        threeObjects.delete(id)
        obj = undefined
      }
    }

    if (!obj) {
      obj = createObject(node)
      threeObjects.set(id, obj)

      const parentObj = node.parentId ? threeObjects.get(node.parentId) : null
      ;(parentObj ?? threeScene).add(obj)
    }

    obj.visible = node.visible

    if (node.operandId) {
      const operand = operands.get(node.operandId)
      if (operand) {
        const tfObj = operand.data as any
        const mat = tfObj.transformation
        if (mat) {
          obj.matrixAutoUpdate = false
          const m = new THREE.Matrix4()
          m.fromArray(mat.data)
          m.transpose()
          obj.matrix.copy(m)
          mat.delete()
        }
      }
    }

    if (obj instanceof THREE.Mesh && obj.material instanceof THREE.MeshMatcapMaterial) {
      if (!obj.material.vertexColors) {
        obj.material.color.set(node.color || defaults.objectColor)
      }
      obj.material.opacity = node.opacity / 100
      obj.material.transparent = node.opacity < 100
      obj.material.wireframe = node.renderMode === 'wireframe'
    } else if (obj instanceof THREE.LineSegments && obj.material instanceof THREE.LineBasicMaterial) {
      obj.material.color.set(node.color || defaults.curvesColor)
    }
  }

  function disposeObject(obj: THREE.Object3D) {
    if (obj instanceof THREE.Mesh || obj instanceof THREE.LineSegments) {
      const operandId = obj.userData.operandId as string | undefined
      if (operandId) {
        releaseGeometry(operandId)
      } else {
        obj.geometry.dispose()
      }
      const mat = obj.material
      if (Array.isArray(mat)) {
        mat.forEach((m) => m.dispose())
      } else {
        mat.dispose()
      }
    }
  }

  function dispose() {
    for (const [, obj] of threeObjects) {
      disposeObject(obj)
    }
    threeObjects.clear()
  }

  return {
    threeObjects,
    syncNode,
    dispose,
  }
}

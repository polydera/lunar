import type * as tf from '@polydera/trueform'

type Transformable = tf.Mesh | tf.PointCloud

/** Clone the transformation matrix from one object to another. */
export function copyTransform(from: Transformable, to: Transformable) {
  const mat = from.transformation
  if (mat) {
    const cloned = mat.clone()
    to.transformation = cloned
    cloned.delete()
    mat.delete()
  }
}

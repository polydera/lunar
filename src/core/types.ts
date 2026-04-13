import type { OperandType } from './operands'

export type ValueType = OperandType | 'number' | 'boolean' | 'string' | 'array'

export interface ChildInput {
  name: string
  label: string
  type: ValueType
  description: string
  optional?: boolean
  /**
   * Optional runtime filter to narrow eligible children beyond type matching.
   * Receives the child's operand data and the parent operand's data.
   * Return true to keep the child in the eligible list.
   *
   * Example: only keep per-vertex ndarrays for a mesh input:
   *   filter: (child, parent) =>
   *     (child as tf.NDArray).shape[0] === (parent as tf.Mesh).numberOfPoints
   */
  filter?: (childData: unknown, parentData: unknown) => boolean
}

export interface Input {
  name: string
  label: string
  type: ValueType
  description: string
  optional?: boolean
  array?: boolean
  default?: unknown
  min?: number
  max?: number
  step?: number
  enum?: string[]
  /** Hint: this parameter represents a spatial length — viewport shows a length preview */
  unit?: 'length'
  /** A child operand resolved from this input's scene node children (e.g. ndarray on a mesh) */
  childInput?: ChildInput
}

export interface Output {
  name: string
  label: string
  type: ValueType
  description: string
  /** This output is only produced when a specific input has a specific value */
  condition?: { input: string; value: unknown }
  /** This output becomes the parent node for all other outputs */
  primary?: boolean
  /** This output is an array of items — each creates a separate scene node */
  array?: boolean
  /** Create a scene node for each named input — output is shared, parented under each */
  linkToInputs?: string[]
  /** Copy the transformation from the named input operand onto this output (Mesh/PointCloud only). */
  inheritTransformation?: string
}

export interface Operator {
  id: string
  label: string
  description: string
  category: string
  tags: string[]
  inputs: Input[]
  outputs: Output[]
  sync(inputs: Record<string, unknown>): Record<string, unknown>
  async(inputs: Record<string, unknown>): Promise<Record<string, unknown>>
  /** Hint: this operator is computationally heavy. Prefer async in interactive contexts. */
  expensive?: boolean
  /** Outputs become children of the first operand input in the scene tree */
  outputAsChild?: boolean
  /** URL to the trueform documentation for this operator's underlying function. */
  docsUrl?: string
  /** Hide input nodes after producing results. Derived automatically if not set. */
  hideInputs?: boolean
}

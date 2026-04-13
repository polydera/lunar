import type { TreeItem } from '@nuxt/ui'

export type MeshObject = Omit<TreeItem, 'children'> & {
  value: string
  isVisual?: boolean
  isVisible?: boolean | 'indeterminate'
  opacity?: number
  brightness?: number
  material?: string
  color?: string
  children?: MeshObject[]
}

type PropertyGetter<T> = (item: T) => boolean | 'indeterminate' | undefined
type PropertySetter<T> = (item: T, value: boolean | 'indeterminate') => void

/**
 * Finds an item recursively in a tree by its value
 */
export function findItemRecursive<T extends { value: string; children?: T[] }>(items: T[], value: string): T | null {
  for (const item of items) {
    if (item.value === value) {
      return item
    }
    if (item.children) {
      const found = findItemRecursive(item.children, value)
      if (found) return found
    }
  }
  return null
}

/**
 * Computes the state of a property based on children (for indeterminate state)
 */
export function computePropertyState<T extends { children?: T[] }>(
  item: T,
  getProperty: PropertyGetter<T>,
  defaultValue: boolean = true,
): boolean | 'indeterminate' {
  if (!item.children || item.children.length === 0) {
    return getProperty(item) ?? defaultValue
  }

  const children = item.children
  const propertyStates = children.map((child) => {
    if (child.children && child.children.length > 0) {
      return computePropertyState(child, getProperty, defaultValue)
    }
    return getProperty(child) ?? defaultValue
  })

  const allTrue = propertyStates.every((state) => state === true)
  const allFalse = propertyStates.every((state) => state === false)

  if (allTrue) return true
  if (allFalse) return false
  return 'indeterminate'
}

/**
 * Recursively updates a property on all children
 */
export function updateChildrenProperty<T extends { children?: T[] }>(
  item: T,
  value: boolean | 'indeterminate',
  setProperty: PropertySetter<T>,
): void {
  if (item.children) {
    // Only update children with boolean values, not indeterminate
    const booleanValue = value === 'indeterminate' ? true : value
    for (const child of item.children) {
      setProperty(child, booleanValue)
      updateChildrenProperty(child, booleanValue, setProperty)
    }
  }
}

/**
 * Finds all parent items of a given item
 */
export function findParents<T extends { value: string; children?: T[] }>(
  items: T[],
  targetValue: string,
  parents: T[] = [],
): T[] {
  for (const item of items) {
    if (item.value === targetValue) {
      return parents
    }
    if (item.children) {
      const found = findItemRecursive(item.children, targetValue)
      if (found) {
        return [...parents, item]
      }
      const childParents = findParents(item.children, targetValue, [...parents, item])
      if (childParents.length > 0) {
        return childParents
      }
    }
  }
  return []
}

/**
 * Updates parent property states based on their children
 */
export function updateParentProperty<T extends { value: string; children?: T[] }>(
  items: T[],
  targetValue: string,
  getProperty: PropertyGetter<T>,
  setProperty: PropertySetter<T>,
  defaultValue: boolean = true,
): void {
  const parents = findParents(items, targetValue)
  for (const parent of parents) {
    const computedState = computePropertyState(parent, getProperty, defaultValue)
    setProperty(parent, computedState === 'indeterminate' ? 'indeterminate' : computedState)
  }
}

/**
 * Gets the effective property value (computed from children if parent, explicit value if leaf)
 */
export function getEffectiveProperty<T extends { children?: T[] }>(
  item: T,
  getProperty: PropertyGetter<T>,
  defaultValue: boolean = true,
): boolean | 'indeterminate' {
  // For items with children, always compute from children to show indeterminate state
  if (item.children && item.children.length > 0) {
    return computePropertyState(item, getProperty, defaultValue)
  }
  // For leaf nodes, use explicit value or default
  return getProperty(item) ?? defaultValue
}

/**
 * Toggles a property on an item and updates children/parents accordingly
 */
export function toggleProperty<T extends { value: string; children?: T[] }>(
  items: T[],
  value: string,
  getProperty: PropertyGetter<T>,
  setProperty: PropertySetter<T>,
  defaultValue: boolean = true,
): void {
  const item = findItemRecursive(items, value)
  if (item) {
    const currentState = getEffectiveProperty(item, getProperty, defaultValue)

    // If indeterminate, set all children to true
    // Otherwise toggle the state
    const newValue = currentState === 'indeterminate' ? true : !(currentState === true)

    setProperty(item, newValue)
    updateChildrenProperty(item, newValue, setProperty)

    // Update parent property states recursively
    updateParentProperty(items, value, getProperty, setProperty, defaultValue)
  }
}

// Specific helpers for isVisible
export function getEffectiveVisibility(item: MeshObject): boolean | 'indeterminate' {
  return getEffectiveProperty<MeshObject>(item, (item) => item.isVisible, true)
}

export function toggleVisibility(items: MeshObject[], value: string): void {
  toggleProperty<MeshObject>(
    items,
    value,
    (item) => item.isVisible,
    (item, value) => {
      item.isVisible = value === 'indeterminate' ? 'indeterminate' : value
    },
    true,
  )
}

export function setDefaultExpanded(items: MeshObject[]): MeshObject[] {
  return items.map((item) => {
    const processedItem: MeshObject = {
      ...item,
      defaultExpanded: item.children && item.children.length > 0 ? true : item.defaultExpanded,
    }
    if (item.children) {
      processedItem.children = setDefaultExpanded(item.children)
    }
    return processedItem
  })
}

/**
 * Initializes expanded states based on defaultExpanded property
 */
export function initializeExpandedStates(items: MeshObject[]): Record<string, boolean> {
  const states: Record<string, boolean> = {}
  const traverse = (items: MeshObject[]) => {
    for (const item of items) {
      states[item.value] = item.defaultExpanded ?? false
      if (item.children) {
        traverse(item.children)
      }
    }
  }
  traverse(items)
  return states
}

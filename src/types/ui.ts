export enum UIElement {
  ACTION_BUTTON,
  ICON_BUTTON,
  SEPARATOR,
  COLUMN,
  ROW,
  SLIDER,
  TOGGLE,
  SELECT,
  PREVIEW_SELECT,
  PROPERTY,
}

export interface UIElementBase {
  id?: string
  label: string
  description?: string
  disabled?: boolean
}

export type UIAction =
  | {
      component: UIElement.ACTION_BUTTON
      props: UIElementBase & { icon: string; isConfirm?: boolean }
      isFormField?: boolean
    }
  | {
      component: UIElement.ICON_BUTTON
      props: UIElementBase & { icon: string }
      isFormField?: boolean
    }
  | {
      component: UIElement.SEPARATOR
      props: { direction?: 'horizontal' | 'vertical' }
      isFormField?: boolean
    }
  | {
      component: UIElement.COLUMN
      props: { items: UIAction[] }
      isFormField?: boolean
    }
  | {
      component: UIElement.ROW
      props: { items: UIAction[] }
      isFormField?: boolean
    }
  | {
      component: UIElement.SLIDER
      props: UIElementBase & { min?: number; max?: number; step?: number }
      isFormField?: boolean
    }
  | {
      component: UIElement.TOGGLE
      props: UIElementBase
      isFormField?: boolean
    }
  | {
      component: UIElement.SELECT
      props: UIElementBase & { items: { label: string; value: string }[] }
      isFormField?: boolean
    }
  | {
      component: UIElement.PREVIEW_SELECT
      props: UIElementBase & { items: { label: string; value: string; preview?: string | null }[]; multiple?: boolean }
      isFormField?: boolean
    }
  | {
      component: UIElement.PROPERTY
      props: { label: string; value: string }
      isFormField?: boolean
    }

export function button(props: UIElementBase & { icon: string; isConfirm?: boolean }): UIAction {
  return {
    component: UIElement.ACTION_BUTTON,
    props,
    isFormField: false,
  }
}

export function iconButton(props: UIElementBase & { icon: string }): UIAction {
  return {
    component: UIElement.ICON_BUTTON,
    props,
    isFormField: false,
  }
}

export function separator(props: { direction?: 'horizontal' | 'vertical' } = {}): UIAction {
  return {
    component: UIElement.SEPARATOR,
    props,
    isFormField: false,
  }
}

export function column(items: UIAction[]): UIAction {
  return {
    component: UIElement.COLUMN,
    props: { items },
    isFormField: false,
  }
}

export function row(items: UIAction[]): UIAction {
  return {
    component: UIElement.ROW,
    props: { items },
    isFormField: false,
  }
}

export function slider(props: UIElementBase & { min?: number; max?: number; step?: number }): UIAction {
  return {
    component: UIElement.SLIDER,
    props,
    isFormField: true,
  }
}

export function toggle(props: UIElementBase): UIAction {
  return {
    component: UIElement.TOGGLE,
    props,
    isFormField: true,
  }
}

export function select(props: UIElementBase & { items: { label: string; value: string }[] }): UIAction {
  return {
    component: UIElement.SELECT,
    props,
    isFormField: true,
  }
}

export function previewSelect(
  props: UIElementBase & { items: { label: string; value: string; preview?: string | null }[]; multiple?: boolean },
): UIAction {
  return {
    component: UIElement.PREVIEW_SELECT,
    props,
    isFormField: false,
  }
}

export function property(props: { label: string; value: string }): UIAction {
  return {
    component: UIElement.PROPERTY,
    props,
    isFormField: false,
  }
}

export type UISetup = {
  modules: {
    name: string
    value: string
    icon: string
    operations: {
      name: string
      actions: UIAction[]
    }[]
    views: {
      name: string
      value: string
      icon: string
    }[]
    toolbar: UIAction[]
    properties: UIAction[]
  }[]
}

/** Read a Luna CSS custom property value */
function ln(name: string): string {
  return getComputedStyle(document.documentElement).getPropertyValue(`--ln-${name}`).trim()
}

/** Colors from the Luna color scheme — single source of truth is main.css */
export const defaults = {
  get objectColor() {
    return ln('object-color')
  },
  get curvesColor() {
    return ln('curves-color')
  },
}

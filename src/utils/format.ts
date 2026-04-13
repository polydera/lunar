/** Format an integer count as compact string: 1234 → "1.2k", 1234567 → "1.2M" */
export function formatCount(n: number): string {
  if (n < 1000) return String(n)
  if (n < 1_000_000) return `${(n / 1000).toFixed(n < 10_000 ? 1 : 0)}k`
  return `${(n / 1_000_000).toFixed(n < 10_000_000 ? 1 : 0)}M`
}

/**
 * Format a scalar stat value. Large magnitudes (≥ 1000) use the compact
 * `formatCount` form; small ones get 4 fractional digits with trailing zeros
 * trimmed. Used across all report sections for min/max/mean/std cells.
 */
export function formatScalar(n: number): string {
  return Math.abs(n) >= 1000 ? formatCount(n) : n.toFixed(4).replace(/\.?0+$/, '')
}

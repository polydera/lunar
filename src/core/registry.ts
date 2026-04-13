import type { Operator } from './types'

export class OperatorRegistry {
  private operators = new Map<string, Operator>()

  register(op: Operator): void {
    this.operators.set(op.id, op)
  }

  get(id: string): Operator | undefined {
    return this.operators.get(id)
  }

  all(): Operator[] {
    return [...this.operators.values()]
  }

  byCategory(category: string): Operator[] {
    return this.all().filter((op) => op.category === category)
  }

  categories(): string[] {
    return [...new Set(this.all().map((op) => op.category))]
  }

  search(query: string): Operator[] {
    const q = query.toLowerCase()
    return this.all().filter(
      (op) =>
        op.id.toLowerCase().includes(q) ||
        op.label.toLowerCase().includes(q) ||
        op.description.toLowerCase().includes(q) ||
        op.tags.some((t) => t.toLowerCase().includes(q)),
    )
  }
}

export const operators = new OperatorRegistry()

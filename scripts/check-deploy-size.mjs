import { readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'

// Cloudflare Workers Assets per-file limit.
const MAX_FILE_BYTES = 25 * 1024 * 1024

function walk(dir) {
  const out = []
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, entry.name)
    if (entry.isDirectory()) out.push(...walk(p))
    else out.push([p, statSync(p).size])
  }
  return out
}

const files = walk('dist')
const offenders = files.filter(([, size]) => size > MAX_FILE_BYTES)

if (offenders.length) {
  console.error('dist contains files over the 25 MiB Cloudflare Workers Assets per-file limit:')
  for (const [p, s] of offenders) {
    console.error(`  ${p} = ${(s / 1024 / 1024).toFixed(2)} MiB`)
  }
  process.exit(1)
}

const total = files.reduce((a, [, s]) => a + s, 0)
console.log(
  `dist OK: ${files.length} files, ${(total / 1024 / 1024).toFixed(2)} MiB total, largest under 25 MiB`,
)

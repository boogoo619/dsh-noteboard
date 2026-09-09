import { describe, expect, it } from 'vitest'
import { readdirSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { join } from 'node:path'

/** Only this module may reason about path FORM; everyone else gets canonical roots. */
const ALLOWED_SUFFIX = 'workspace-root.mjs'
const FORBIDDEN = [
  [/startsWith\('\/'\)/, "startsWith('/') rejects every Windows root — use parseWorkspaceRoot / path.isAbsolute"],
  [/split\('\/'\)/, 'separator surgery belongs in workspace-root.mjs (toRelKey/fromRelKey)'],
  [/split\('\\\\'\)/, 'separator surgery belongs in workspace-root.mjs (toRelKey/fromRelKey)'],
]

describe('path hygiene', () => {
  it('keeps path-form surgery inside workspace-root.mjs only', () => {
    const srcDir = fileURLToPath(new URL('../src/', import.meta.url))
    const violations = []
    // Recursive: future server modules in subdirectories must not escape the
    // scan. Only .mjs — fs-path surgery is a server concern; src/client never
    // touches the disk.
    for (const relative of readdirSync(srcDir, { recursive: true })) {
      if (!relative.endsWith('.mjs') || relative.endsWith(ALLOWED_SUFFIX)) continue
      const text = readFileSync(join(srcDir, relative), 'utf8')
      for (const [pattern, reason] of FORBIDDEN) if (pattern.test(text)) violations.push(`${relative}: ${reason} (${pattern})`)
    }
    expect(violations, violations.join('\n')).toEqual([])
  })
})

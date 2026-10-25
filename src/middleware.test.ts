import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

// middleware.ts can't be imported under vitest (next-intl needs next/server resolution),
// so evaluate the exact matcher string literal from source: JS string escapes included.
const source = readFileSync(join(__dirname, 'middleware.ts'), 'utf8')
const literal = source.match(/matcher:\s*\[\s*('(?:[^'\\]|\\.)*')\s*\]/)?.[1]
const pattern: string = new Function(`return ${literal}`)()
// Next anchors each matcher as a full-path regex.
const re = new RegExp('^' + pattern + '$')

describe('middleware matcher', () => {
  it('extracts the matcher literal', () => {
    expect(literal).toBeDefined()
  })
  it.each(['/', '/th', '/en/map', '/authors', '/apix', '/th/login'])('runs for %s', (p) => {
    expect(re.test(p)).toBe(true)
  })
  it.each(['/api/v1/x', '/api', '/auth/callback', '/_next/static/a.js', '/favicon.ico'])(
    'skips %s',
    (p) => {
      expect(re.test(p)).toBe(false)
    },
  )
})

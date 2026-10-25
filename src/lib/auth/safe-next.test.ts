import { describe, expect, it } from 'vitest'
import { safeNextPath } from './safe-next'

describe('safeNextPath', () => {
  it.each([
    ['/th/admin', '/th/admin'],
    ['/th/admin?tab=2', '/th/admin?tab=2'],
    [null, '/'],
    [undefined, '/'],
    [['/a', '/b'], '/'],
    [42, '/'],
    ['', '/'],
    ['https://evil.com', '/'],
    ['//evil.com', '/'],
    ['/\\evil.com', '/'],
    ['/th/a\\b', '/'],
    ['admin', '/'],
    ['/\t/evil.com', '/'],
    ['/\n/evil.com', '/'],
  ])('safeNextPath(%j) -> %s', (input, out) => expect(safeNextPath(input)).toBe(out))
})

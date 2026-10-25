import { describe, expect, it } from 'vitest'
import { GATED_PREFIXES, isGatedPath } from './gated'

describe('isGatedPath', () => {
  it.each([
    ['/prepare', true],
    ['/prepare/trips/1', true],
    ['/prepared', false],
    ['/', false],
    ['/map', false],
  ])('isGatedPath(%s)', (p, out) => expect(isGatedPath(p)).toBe(out))

  it('gates exactly /prepare', () => {
    expect(GATED_PREFIXES).toEqual(['/prepare'])
  })
})

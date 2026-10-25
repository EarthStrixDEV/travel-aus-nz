import { describe, expect, it } from 'vitest'
import { loginHref } from './login-href'

describe('loginHref', () => {
  it('encodes path + query into next', () => {
    expect(loginHref('/th/map', '?x=1')).toBe('/login?next=%2Fth%2Fmap%3Fx%3D1')
    expect(loginHref('/th/map', 'x=1')).toBe('/login?next=%2Fth%2Fmap%3Fx%3D1')
  })
  it('omits an empty query', () => {
    expect(loginHref('/en/dishes', '')).toBe('/login?next=%2Fen%2Fdishes')
  })
  it('falls back to / for a path that is not same-origin', () => {
    expect(loginHref('//evil.com', '')).toBe('/login?next=%2F')
  })
})

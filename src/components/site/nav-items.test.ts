import { describe, expect, it } from 'vitest'
import { isActive, navItems, tabItems } from './nav-items'

describe('nav items', () => {
  it('nav hrefs', () =>
    expect(navItems.map((i) => i.href)).toEqual(['/', '/map', '/dishes', '/currency', '/visa', '/prepare']))

  it('tab hrefs', () =>
    expect(tabItems.map((i) => i.href)).toEqual(['/', '/map', '/dishes', '/currency', '/prepare']))

  it.each([
    ['/', '/', true],
    ['/map', '/', false],
    ['/map', '/map', true],
    ['/map/sydney', '/map', true],
    ['/mapx', '/map', false],
  ])('isActive(%s, %s)', (p, h, out) => expect(isActive(p, h)).toBe(out))
})

import { describe, expect, it } from 'vitest'
import { isActive, navItems, tabItems } from './nav-items'

describe('nav items', () => {
  it('nav hrefs', () =>
    expect(navItems.map((i) => i.href)).toEqual([
      '/',
      '/map',
      '/transport',
      '/eat-drink',
      '/gallery',
      '/money',
      '/visa',
      '/prepare',
    ]))

  it('nav groups', () => {
    expect(navItems.filter((i) => i.group === 'explore').map((i) => i.key)).toEqual([
      'destinations',
      'map',
      'transport',
      'eatDrink',
      'gallery',
    ])
    expect(navItems.filter((i) => i.group === 'plan').map((i) => i.key)).toEqual(['money', 'visa', 'prepare'])
  })

  it('tab hrefs', () =>
    expect(tabItems.map((i) => i.href)).toEqual(['/', '/map', '/transport', '/eat-drink', '/trip']))

  it.each([
    ['/', '/', true],
    ['/map', '/', false],
    ['/map', '/map', true],
    ['/map/sydney', '/map', true],
    ['/mapx', '/map', false],
    ['/eat-drink/x', '/eat-drink', true],
  ])('isActive(%s, %s)', (p, h, out) => expect(isActive(p, h)).toBe(out))
})

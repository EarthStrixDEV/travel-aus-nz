import { describe, expect, it } from 'vitest'
import { parseThemeCookie, themeClass } from './theme'

describe('theme', () => {
  it.each([
    ['dark', 'dark'],
    ['light', 'light'],
    [undefined, 'system'],
    ['blue', 'system'],
  ])('parseThemeCookie(%s)', (v, out) => expect(parseThemeCookie(v)).toBe(out))

  it('themeClass', () => {
    expect(themeClass('system')).toBe('')
    expect(themeClass('dark')).toBe('dark')
    expect(themeClass('light')).toBe('light')
  })
})

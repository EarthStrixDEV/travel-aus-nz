// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest'
import { THEME_INIT_SCRIPT } from './theme'

function runWithCookie(...cookies: string[]) {
  document.cookie.split(';').forEach((c) => {
    const name = c.split('=')[0].trim()
    if (name) document.cookie = `${name}=; Max-Age=0; Path=/`
  })
  cookies.filter(Boolean).forEach((c) => (document.cookie = c))
  new Function(THEME_INIT_SCRIPT)()
  return document.documentElement.className
}

describe('THEME_INIT_SCRIPT', () => {
  afterEach(() => {
    document.documentElement.className = ''
  })

  it.each([
    ['theme=dark', 'dark'],
    ['theme=light', 'light'],
    ['theme=blue', ''],
    ['', ''],
    ['mytheme=dark', ''],
  ])('cookie %j -> <html class=%j>', (cookie, cls) => {
    expect(runWithCookie(cookie)).toBe(cls)
  })

  it('finds the cookie among others', () => {
    expect(runWithCookie('a=1', 'theme=dark', 'z=2')).toBe('dark')
  })
})

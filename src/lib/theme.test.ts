// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest'
import { applyThemeCookie, THEME_INIT_SCRIPT } from './theme'

function setCookies(cookies: string[]) {
  document.cookie.split(';').forEach((c) => {
    const name = c.split('=')[0].trim()
    if (name) document.cookie = `${name}=; Max-Age=0; Path=/`
  })
  cookies.filter(Boolean).forEach((c) => (document.cookie = c))
}

const appliers = {
  THEME_INIT_SCRIPT: () => new Function(THEME_INIT_SCRIPT)(),
  applyThemeCookie,
}

describe.each(Object.entries(appliers))('%s', (_, apply) => {
  function runWithCookie(...cookies: string[]) {
    setCookies(cookies)
    apply()
    return document.documentElement.className
  }

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

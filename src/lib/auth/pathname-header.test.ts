import { describe, expect, it } from 'vitest'
import { withPathnameHeader } from './pathname-header'

describe('withPathnameHeader', () => {
  it('appends to existing request-header overrides', () => {
    const res = { headers: new Headers({ 'x-middleware-override-headers': 'a,x-next-intl-locale' }) }
    withPathnameHeader(res, '/th/admin?x=1')
    expect(res.headers.get('x-middleware-override-headers')).toBe('a,x-next-intl-locale,x-pathname')
    expect(res.headers.get('x-middleware-request-x-pathname')).toBe('/th/admin?x=1')
  })
  it('does nothing on responses without overrides (redirects)', () => {
    const res = { headers: new Headers() }
    withPathnameHeader(res, '/th')
    expect(res.headers.get('x-middleware-request-x-pathname')).toBeNull()
  })
})

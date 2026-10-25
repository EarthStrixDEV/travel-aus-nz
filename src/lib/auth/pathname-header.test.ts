import { describe, expect, it } from 'vitest'
import { PATHNAME_HEADER, setPathnameHeader } from './pathname-header'

describe('setPathnameHeader', () => {
  it('sets the path on the request headers', () => {
    const headers = new Headers()
    setPathnameHeader(headers, '/th/admin?x=1')
    expect(headers.get(PATHNAME_HEADER)).toBe('/th/admin?x=1')
  })
  it('overwrites a client-supplied value', () => {
    const headers = new Headers({ [PATHNAME_HEADER]: '/spoofed' })
    setPathnameHeader(headers, '/th')
    expect(headers.get(PATHNAME_HEADER)).toBe('/th')
  })
})

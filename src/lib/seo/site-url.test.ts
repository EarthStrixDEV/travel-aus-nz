import { describe, expect, it } from 'vitest'
import { siteUrl } from './site-url'

describe('siteUrl', () => {
  it('uses NEXT_PUBLIC_SITE_URL without a trailing slash', () => {
    expect(siteUrl({ NEXT_PUBLIC_SITE_URL: 'https://travelausnz.com/', NODE_ENV: 'production' })).toBe('https://travelausnz.com')
  })

  it('falls back to localhost outside production', () => {
    expect(siteUrl({ NODE_ENV: 'development' })).toBe('http://localhost:3000')
    expect(siteUrl({ NEXT_PUBLIC_SITE_URL: '  ', NODE_ENV: 'test' })).toBe('http://localhost:3000')
  })

  it('throws a clear error in production when unset or invalid', () => {
    expect(() => siteUrl({ NODE_ENV: 'production' })).toThrow(/NEXT_PUBLIC_SITE_URL/)
    expect(() => siteUrl({ NEXT_PUBLIC_SITE_URL: 'not a url', NODE_ENV: 'production' })).toThrow(/NEXT_PUBLIC_SITE_URL/)
  })
})

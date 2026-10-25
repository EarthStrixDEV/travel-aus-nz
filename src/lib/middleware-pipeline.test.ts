import { NextRequest, NextResponse } from 'next/server'
import { describe, expect, it, vi } from 'vitest'
import { runMiddleware } from './middleware-pipeline'

// Simulate a session refresh: getUser() triggers setAll with a new token + cache headers.
vi.mock('@supabase/ssr', () => ({
  createServerClient: (
    _url: string,
    _key: string,
    opts: { cookies: { setAll: (c: unknown[], h: Record<string, string>) => void } },
  ) => ({
    auth: {
      getUser: async () => {
        opts.cookies.setAll(
          [{ name: 'sb-test-auth-token', value: 'refreshed', options: { path: '/', httpOnly: true } }],
          { 'Cache-Control': 'private, no-cache, no-store, must-revalidate, max-age=0' },
        )
        return { data: { user: null }, error: null }
      },
    },
  }),
}))

describe('runMiddleware', () => {
  it('makes refreshed cookies visible downstream and sets them on the response', async () => {
    const request = new NextRequest('http://localhost/th/trips?tab=1', {
      headers: { cookie: 'sb-test-auth-token=stale', 'x-pathname': '/spoofed' },
    })
    let seen: Headers | undefined
    const handleI18n = (req: NextRequest) => {
      // next-intl forwards a copy of the request headers to server components.
      seen = new Headers(req.headers)
      return NextResponse.next({ request: { headers: seen } })
    }

    const response = await runMiddleware(request, handleI18n)

    // Downstream (server components) see the refreshed cookie and the real path.
    expect(seen?.get('cookie')).toContain('sb-test-auth-token=refreshed')
    expect(seen?.get('cookie')).not.toContain('stale')
    expect(seen?.get('x-pathname')).toBe('/th/trips?tab=1')
    expect(response.headers.get('x-middleware-request-cookie')).toContain('sb-test-auth-token=refreshed')
    expect(response.headers.get('x-middleware-request-x-pathname')).toBe('/th/trips?tab=1')

    // The browser receives the refreshed cookie and the no-store cache header.
    expect(response.cookies.get('sb-test-auth-token')?.value).toBe('refreshed')
    expect(response.headers.get('set-cookie')).toContain('HttpOnly')
    expect(response.headers.get('cache-control')).toContain('no-store')
  })

  it('applies refreshed cookies to next-intl redirects too', async () => {
    const request = new NextRequest('http://localhost/', { headers: { cookie: 'sb-test-auth-token=stale' } })
    const response = await runMiddleware(request, () => NextResponse.redirect('http://localhost/th'))
    expect(response.status).toBe(307)
    expect(response.cookies.get('sb-test-auth-token')?.value).toBe('refreshed')
  })
})

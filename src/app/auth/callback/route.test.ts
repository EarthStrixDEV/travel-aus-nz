import { beforeEach, describe, expect, it, vi } from 'vitest'

const exchangeCodeForSession = vi.fn()
vi.mock('@/lib/supabase/server', () => ({
  createClient: async () => ({ auth: { exchangeCodeForSession } }),
}))

import { NextRequest } from 'next/server'
import { GET } from './route'

const call = (qs: string) => GET(new NextRequest(`http://localhost:3000/auth/callback${qs}`))

beforeEach(() => vi.clearAllMocks())

describe('GET /auth/callback', () => {
  it('valid code -> redirects to the safe next path', async () => {
    exchangeCodeForSession.mockResolvedValue({ error: null })
    const res = await call('?code=abc&next=/th/admin')
    expect(exchangeCodeForSession).toHaveBeenCalledWith('abc')
    expect(res.headers.get('location')).toBe('http://localhost:3000/th/admin')
  })
  it.each(['https://evil.com', '//evil.com', '/\\evil.com'])('hostile next %s -> /', async (next) => {
    exchangeCodeForSession.mockResolvedValue({ error: null })
    const res = await call(`?code=abc&next=${encodeURIComponent(next)}`)
    expect(res.headers.get('location')).toBe('http://localhost:3000/')
  })
  it('missing code -> login error, no exchange', async () => {
    const res = await call('?next=/th/admin')
    expect(exchangeCodeForSession).not.toHaveBeenCalled()
    expect(res.headers.get('location')).toBe('http://localhost:3000/th/login?error=auth')
  })
  it('failed exchange -> login error', async () => {
    exchangeCodeForSession.mockResolvedValue({ error: new Error('bad') })
    const res = await call('?code=abc')
    expect(res.headers.get('location')).toBe('http://localhost:3000/th/login?error=auth')
  })
})

import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest, NextResponse } from 'next/server'

const rpc = vi.fn()
const rateLimit = vi.fn()
vi.mock('@/lib/supabase/public', () => ({ createPublicClient: () => ({ rpc }) }))
vi.mock('@/lib/api/rate-limit', () => ({ rateLimit: (...a: unknown[]) => rateLimit(...a) }))

import { GET } from './route'

const call = (qs: string) => GET(new NextRequest(`http://localhost:3000/api/v1/search${qs}`))

beforeEach(() => {
  vi.clearAllMocks()
  rateLimit.mockResolvedValue(null)
  rpc.mockResolvedValue({ data: [], error: null })
})

describe('GET /api/v1/search', () => {
  it('q too short -> 400 VALIDATION', async () => {
    const res = await call('?q=a')
    expect(res.status).toBe(400)
    expect((await res.json()).error.code).toBe('VALIDATION')
    expect(rpc).not.toHaveBeenCalled()
  })

  it.each(['', '?q=', `?q=${'x'.repeat(81)}`, '?q=a&locale=fr'])('rejects %j', async (qs) => {
    expect((await call(qs)).status).toBe(400)
  })

  it('rate limit exceeded -> 429 and no query', async () => {
    rateLimit.mockResolvedValue(
      NextResponse.json({ error: { code: 'RATE_LIMITED', message: 'Too many requests' } }, { status: 429 }),
    )
    const res = await call('?q=sydney')
    expect(res.status).toBe(429)
    expect((await res.json()).error.code).toBe('RATE_LIMITED')
    expect(rpc).not.toHaveBeenCalled()
  })

  it('passes filters to search_content and returns { results }', async () => {
    const rows = [{ kind: 'region', slug: 'sydney', name: 'Sydney', sub: 'New South Wales' }]
    rpc.mockResolvedValue({ data: rows, error: null })
    const res = await call('?q=%20syd%20&locale=en&region=sydney&month=9&interests[]=nature&interests[]=art')
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ results: rows })
    expect(rpc).toHaveBeenCalledWith('search_content', {
      q: 'syd',
      p_locale: 'en',
      p_region: 'sydney',
      p_month: 9,
      p_interests: ['nature', 'art'],
    })
  })

  it('defaults to th and omits unset filters', async () => {
    await call('?q=ซิด')
    expect(rpc).toHaveBeenCalledWith('search_content', {
      q: 'ซิด',
      p_locale: 'th',
      p_region: undefined,
      p_month: undefined,
      p_interests: undefined,
    })
  })

  it('month out of range -> 400', async () => {
    expect((await call('?q=sydney&month=13')).status).toBe(400)
  })

  it('database error -> 500 INTERNAL', async () => {
    rpc.mockResolvedValue({ data: null, error: { message: 'boom' } })
    const res = await call('?q=sydney')
    expect(res.status).toBe(500)
    expect((await res.json()).error.code).toBe('INTERNAL')
  })
})

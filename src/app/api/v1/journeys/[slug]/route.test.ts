import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const getJourneyDetail = vi.fn()
vi.mock('@/lib/supabase/public', () => ({ createPublicClient: () => ({}) }))
vi.mock('@/lib/content/cache', () => ({ cachedContent: (_k: string[], _t: string, fn: () => unknown) => fn }))
vi.mock('@/lib/content/journeys', () => ({ getJourneyDetail: (...a: unknown[]) => getJourneyDetail(...a) }))

import { GET } from './route'

const call = (slug: string, qs = '') =>
  GET(new NextRequest(`http://localhost:3000/api/v1/journeys/x${qs}`), { params: Promise.resolve({ slug }) })

beforeEach(() => {
  vi.clearAllMocks()
  vi.spyOn(console, 'error').mockImplementation(() => {})
})

describe('GET /api/v1/journeys/[slug]', () => {
  it('returns the journey', async () => {
    getJourneyDetail.mockResolvedValue({ slug: 'a-b', itinerary: [] })
    const res = await call('a-b', '?locale=en')
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ slug: 'a-b', itinerary: [] })
    expect(getJourneyDetail).toHaveBeenCalledWith(expect.anything(), 'en', 'a-b')
  })

  it('unknown slug -> 404 NOT_FOUND', async () => {
    getJourneyDetail.mockResolvedValue(null)
    const res = await call('nope')
    expect(res.status).toBe(404)
    expect((await res.json()).error.code).toBe('NOT_FOUND')
  })

  it.each(['Bad Slug', 'UPPER', 'a_b'])('invalid slug %j -> 400 VALIDATION', async (slug) => {
    const res = await call(slug)
    expect(res.status).toBe(400)
    expect((await res.json()).error.code).toBe('VALIDATION')
    expect(getJourneyDetail).not.toHaveBeenCalled()
  })

  it('invalid locale -> 400', async () => {
    expect((await call('a-b', '?locale=fr')).status).toBe(400)
  })

  it('loader error -> 500 INTERNAL envelope', async () => {
    getJourneyDetail.mockRejectedValue(new Error('db down'))
    const res = await call('a-b')
    expect(res.status).toBe(500)
    expect((await res.json()).error.code).toBe('INTERNAL')
  })
})

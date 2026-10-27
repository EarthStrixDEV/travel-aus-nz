import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest, NextResponse } from 'next/server'

const { providerPlan, planRoute, rateLimit, db, cache } = vi.hoisted(() => ({
  providerPlan: vi.fn(),
  planRoute: vi.fn(),
  rateLimit: vi.fn(),
  db: { from: vi.fn() },
  cache: { get: vi.fn(), set: vi.fn() },
}))

vi.mock('@/lib/routing/google', () => ({ googleRoutes: { name: 'google', plan: providerPlan } }))
vi.mock('@/lib/routing/cache', () => ({ redisRouteCache: () => cache }))
vi.mock('@/lib/supabase/public', () => ({ createPublicClient: () => db }))
vi.mock('@/lib/api/rate-limit', () => ({ rateLimit: (...a: unknown[]) => rateLimit(...a) }))
vi.mock('@/lib/routing/plan', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/routing/plan')>()
  return { ...actual, planRoute: (...a: unknown[]) => planRoute(...a) }
})

import { GET } from './route'

const call = (qs: string) => GET(new NextRequest(`http://localhost:3000/api/v1/routes/plan${qs}`))
const ok = '?from=central-station&to=bondi-beach&depart=2026-11-02T09:00'

const option = {
  depart: '2026-11-01T22:01:00.000Z',
  arrive: '2026-11-01T22:35:00.000Z',
  duration_min: 34,
  summary: 'T4 → 333',
  fare_min: 5.18,
  fare_max: 7.4,
  currency: 'AUD',
  card: 'Opal or contactless',
  legs: [],
}

beforeEach(() => {
  vi.clearAllMocks()
  rateLimit.mockResolvedValue(null)
  planRoute.mockResolvedValue({ options: [option] })
})

describe('GET /api/v1/routes/plan', () => {
  it('200 { options } with no-store and the injected deps', async () => {
    const res = await call(`${ok}&modes[]=train&modes[]=bus&step_free=true&locale=en`)
    expect(res.status).toBe(200)
    expect(res.headers.get('Cache-Control')).toBe('no-store')
    expect(await res.json()).toEqual({ options: [option] })
    expect(planRoute).toHaveBeenCalledWith(
      { from: 'central-station', to: 'bondi-beach', depart: '2026-11-02T09:00', modes: ['train', 'bus'], stepFree: true, locale: 'en' },
      { provider: expect.objectContaining({ name: 'google' }), db, cache },
    )
    expect(rateLimit).toHaveBeenCalledWith(expect.anything(), { limit: 20, window: '10 m', prefix: 'routes' })
  })

  it('defaults: no modes, step_free off, locale th', async () => {
    await call(ok)
    expect(planRoute.mock.calls[0][0]).toEqual({ from: 'central-station', to: 'bondi-beach', depart: '2026-11-02T09:00', modes: [], stepFree: false, locale: 'th' })
  })

  it('accepts lat,lng endpoints inside AU/NZ', async () => {
    expect((await call('?from=-33.8688,151.2093&to=bondi-beach&depart=2026-11-02T09:00')).status).toBe(200)
  })

  it.each([
    ['', 'missing everything'],
    ['?from=central-station&to=bondi-beach', 'missing depart'],
    ['?from=central-station&to=bondi-beach&depart=2026-11-02', 'date only'],
    ['?from=central-station&to=bondi-beach&depart=2026-13-02T09:00', 'bad month'],
    ['?from=51.5,-0.12&to=bondi-beach&depart=2026-11-02T09:00', 'outside AU/NZ'],
    ['?from=Central%20Station&to=bondi-beach&depart=2026-11-02T09:00', 'not a slug'],
    [`${ok}&modes[]=plane`, 'unknown mode'],
    [`${ok}&step_free=maybe`, 'bad step_free'],
  ])('rejects %j (%s) with 400 VALIDATION', async (qs) => {
    const res = await call(qs)
    expect(res.status).toBe(400)
    expect((await res.json()).error.code).toBe('VALIDATION')
    expect(planRoute).not.toHaveBeenCalled()
  })

  it('21st request in the window -> 429 and the provider is never called (Review Focus 2)', async () => {
    let n = 0
    rateLimit.mockImplementation(async () =>
      ++n > 20 ? NextResponse.json({ error: { code: 'RATE_LIMITED', message: 'Too many requests' } }, { status: 429 }) : null,
    )
    planRoute.mockClear()
    for (let i = 0; i < 20; i++) expect((await call(ok)).status).toBe(200)
    const res = await call(ok)
    expect(res.status).toBe(429)
    expect((await res.json()).error.code).toBe('RATE_LIMITED')
    expect(planRoute).toHaveBeenCalledTimes(20)
    expect(providerPlan).not.toHaveBeenCalled()
  })

  it('routing unavailable -> 503 ROUTING_UNAVAILABLE with fallback journey (Review Focus 1)', async () => {
    const fallback = { slug: 'central-to-bondi', title: 'Central to Bondi by bus' }
    planRoute.mockResolvedValue({ error: 'ROUTING_UNAVAILABLE', message: 'Route planning is unavailable', fallback })
    const res = await call(ok)
    expect(res.status).toBe(503)
    expect(res.headers.get('Cache-Control')).toBe('no-store')
    expect(await res.json()).toEqual({
      error: { code: 'ROUTING_UNAVAILABLE', message: 'Route planning is unavailable' },
      fallback,
    })
  })

  it('unknown place -> 404 NOT_FOUND', async () => {
    planRoute.mockResolvedValue({ error: 'NOT_FOUND', message: 'Unknown place: nowhere' })
    const res = await call(ok)
    expect(res.status).toBe(404)
    expect((await res.json()).error.code).toBe('NOT_FOUND')
  })

  it('unexpected failure -> 500 INTERNAL', async () => {
    planRoute.mockRejectedValue(new Error('db down'))
    const res = await call(ok)
    expect(res.status).toBe(500)
    expect((await res.json()).error.code).toBe('INTERNAL')
  })
})

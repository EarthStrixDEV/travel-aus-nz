import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const m = vi.hoisted(() => ({ recompute: vi.fn(), service: vi.fn(() => ({})) }))

vi.mock('server-only', () => ({}))
vi.mock('@/lib/supabase/service', () => ({ createServiceClient: m.service }))
vi.mock('@/lib/trip/legs', () => ({ recomputeStaleLegs: m.recompute }))
vi.mock('@/lib/trip/recompute', () => ({ routePlanner: vi.fn() }))

import { GET } from './route'

const req = (auth?: string) => new Request('http://x/api/cron/leg-recompute', { headers: auth ? { authorization: auth } : {} })

beforeEach(() => {
  vi.stubEnv('CRON_SECRET', 's3cret')
  m.recompute.mockResolvedValue({ checked: 2, ok: 1, failed: 1 })
})
afterEach(() => {
  vi.unstubAllEnvs()
  vi.clearAllMocks()
})

describe('GET /api/cron/leg-recompute', () => {
  it('no or wrong bearer -> 401 and nothing runs', async () => {
    expect((await GET(req())).status).toBe(401)
    expect((await GET(req('Bearer nope'))).status).toBe(401)
    expect(m.service).not.toHaveBeenCalled()
    expect(m.recompute).not.toHaveBeenCalled()
  })

  it('valid bearer -> sweeps legs stale for 2+ minutes, 50 at most', async () => {
    const res = await GET(req('Bearer s3cret'))
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ checked: 2, ok: 1, failed: 1 })
    expect(m.recompute).toHaveBeenCalledWith({}, expect.any(Function), { olderThanMs: 120_000, limit: 50 })
  })
})

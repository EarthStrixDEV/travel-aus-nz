import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const rollDailyCloses = vi.fn()
const revalidateTag = vi.fn()
vi.mock('@/lib/fx/ingest', () => ({ rollDailyCloses: (...a: unknown[]) => rollDailyCloses(...a) }))
vi.mock('@/lib/supabase/service', () => ({ createServiceClient: () => ({}) }))
vi.mock('next/cache', () => ({ revalidateTag: (...a: unknown[]) => revalidateTag(...a) }))

import { GET } from './route'

const call = (auth?: string) => GET(new Request('http://localhost/api/cron/fx-daily', { headers: auth ? { authorization: auth } : {} }))

beforeEach(() => {
  vi.clearAllMocks()
  vi.stubEnv('CRON_SECRET', 'abc')
  vi.spyOn(console, 'error').mockImplementation(() => {})
})
afterEach(() => vi.unstubAllEnvs())

describe('GET /api/cron/fx-daily', () => {
  it('401 without the bearer', async () => {
    expect((await call()).status).toBe(401)
    expect(rollDailyCloses).not.toHaveBeenCalled()
  })

  it('rolls the previous day and busts the fx tag', async () => {
    rollDailyCloses.mockResolvedValue({ day: '2026-10-24', quotes: 8 })
    const res = await call('Bearer abc')
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ day: '2026-10-24', quotes: 8 })
    expect(revalidateTag).toHaveBeenCalledWith('fx')
  })

  it('db failure -> 500 INTERNAL', async () => {
    rollDailyCloses.mockRejectedValue(new Error('db'))
    expect((await call('Bearer abc')).status).toBe(500)
  })
})

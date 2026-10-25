import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const ingestFx = vi.fn()
const revalidateTag = vi.fn()
vi.mock('@/lib/fx/ingest', () => ({ ingestFx: (...a: unknown[]) => ingestFx(...a) }))
vi.mock('@/lib/supabase/service', () => ({ createServiceClient: () => ({}) }))
vi.mock('next/cache', () => ({ revalidateTag: (...a: unknown[]) => revalidateTag(...a) }))

import { GET } from './route'

const call = (auth?: string) => GET(new Request('http://localhost/api/cron/fx-ingest', { headers: auth ? { authorization: auth } : {} }))

beforeEach(() => {
  vi.clearAllMocks()
  vi.stubEnv('CRON_SECRET', 'abc')
  vi.spyOn(console, 'error').mockImplementation(() => {})
})
afterEach(() => vi.unstubAllEnvs())

describe('GET /api/cron/fx-ingest', () => {
  it('401 without a bearer, and never touches the db or providers', async () => {
    expect((await call()).status).toBe(401)
    expect((await call('Bearer nope')).status).toBe(401)
    expect(ingestFx).not.toHaveBeenCalled()
  })

  it('writes and busts the fx cache tag', async () => {
    ingestFx.mockResolvedValue({ written: true, source: 'frankfurter' })
    const res = await call('Bearer abc')
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ written: true, source: 'frankfurter' })
    expect(revalidateTag).toHaveBeenCalledWith('fx')
  })

  it('all providers failed -> 502 so the cron run shows as failed, cache untouched', async () => {
    ingestFx.mockResolvedValue({ written: false })
    const res = await call('Bearer abc')
    expect(res.status).toBe(502)
    expect(revalidateTag).not.toHaveBeenCalled()
  })
})

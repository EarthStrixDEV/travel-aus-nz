import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const checkLinks = vi.fn()
const revalidateTag = vi.fn()
vi.mock('@/lib/entry/link-check', () => ({ checkLinks: (...a: unknown[]) => checkLinks(...a) }))
vi.mock('@/lib/supabase/service', () => ({ createServiceClient: () => ({}) }))
vi.mock('next/cache', () => ({ revalidateTag: (...a: unknown[]) => revalidateTag(...a) }))

import { GET } from './route'

const call = (auth?: string) => GET(new Request('http://localhost/api/cron/link-check', { headers: auth ? { authorization: auth } : {} }))

beforeEach(() => {
  vi.clearAllMocks()
  vi.stubEnv('CRON_SECRET', 'abc')
  vi.spyOn(console, 'error').mockImplementation(() => {})
})
afterEach(() => vi.unstubAllEnvs())

describe('GET /api/cron/link-check', () => {
  it('401 without a valid bearer, and never fetches a link', async () => {
    expect((await call()).status).toBe(401)
    expect((await call('Bearer nope')).status).toBe(401)
    expect(checkLinks).not.toHaveBeenCalled()
  })

  it('runs the check with the global fetch and returns the summary; nothing flagged leaves the cache alone', async () => {
    checkLinks.mockResolvedValue({ checked: 3, flagged: 0, errors: 0 })
    const res = await call('Bearer abc')
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ checked: 3, flagged: 0, errors: 0 })
    expect(checkLinks).toHaveBeenCalledWith(expect.anything(), fetch)
    expect(revalidateTag).not.toHaveBeenCalled()
  })

  it('busts the entry tag when a link was flagged (needs_review changes what the helper shows)', async () => {
    checkLinks.mockResolvedValue({ checked: 3, flagged: 1, errors: 0 })
    await call('Bearer abc')
    expect(revalidateTag).toHaveBeenCalledWith('entry')
  })

  it('502 when some links could not be recorded, but a flag from the others still busts the cache', async () => {
    checkLinks.mockResolvedValue({ checked: 2, flagged: 1, errors: 1 })
    const res = await call('Bearer abc')
    expect(res.status).toBe(502)
    expect((await res.json()).error.code).toBe('INTERNAL')
    expect(revalidateTag).toHaveBeenCalledWith('entry')
  })

  it('500 INTERNAL envelope when the run throws', async () => {
    checkLinks.mockRejectedValue(new Error('db down'))
    const res = await call('Bearer abc')
    expect(res.status).toBe(500)
    expect((await res.json()).error.code).toBe('INTERNAL')
  })
})

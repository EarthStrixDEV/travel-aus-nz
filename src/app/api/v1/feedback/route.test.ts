import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextResponse } from 'next/server'

const insert = vi.fn()
const getUser = vi.fn()
const rateLimit = vi.fn()
vi.mock('@/lib/supabase/service', () => ({ createServiceClient: () => ({ from: () => ({ insert }) }) }))
vi.mock('@/lib/supabase/server', () => ({ createClient: async () => ({ auth: { getUser } }) }))
vi.mock('@/lib/api/rate-limit', () => ({ rateLimit: (...a: unknown[]) => rateLimit(...a) }))

import { POST } from './route'

const call = (body: unknown, raw = false) =>
  POST(new Request('http://localhost:3000/api/v1/feedback', { method: 'POST', body: raw ? (body as string) : JSON.stringify(body), headers: { 'content-type': 'application/json' } }))

const valid = { entity: 'au-eta', kind: 'outdated', note: 'The fee changed.' }

beforeEach(() => {
  vi.clearAllMocks()
  vi.spyOn(console, 'error').mockImplementation(() => {})
  rateLimit.mockResolvedValue(null)
  insert.mockResolvedValue({ error: null })
  getUser.mockResolvedValue({ data: { user: null } })
})

describe('POST /api/v1/feedback', () => {
  it('202 and inserts with the service client; anonymous -> user_id null', async () => {
    const res = await call(valid)
    expect(res.status).toBe(202)
    expect(insert).toHaveBeenCalledWith({ entity: 'au-eta', kind: 'outdated', note: 'The fee changed.', user_id: null })
  })

  it('records user_id only when a session exists', async () => {
    getUser.mockResolvedValue({ data: { user: { id: 'u-1' } } })
    await call({ entity: 'nzeta', kind: 'broken' })
    expect(insert).toHaveBeenCalledWith({ entity: 'nzeta', kind: 'broken', note: null, user_id: 'u-1' })
  })

  it('a session lookup failure still accepts the feedback as anonymous', async () => {
    getUser.mockRejectedValue(new Error('cookies unavailable'))
    expect((await call(valid)).status).toBe(202)
    expect(insert).toHaveBeenCalledWith(expect.objectContaining({ user_id: null }))
  })

  it('is limited to 5 per hour per IP; the 6th request is 429 and nothing is stored', async () => {
    let n = 0
    rateLimit.mockImplementation(async (_req: Request, opts: { limit: number }) =>
      ++n > opts.limit ? NextResponse.json({ error: { code: 'RATE_LIMITED', message: 'Too many requests' } }, { status: 429 }) : null,
    )
    for (let i = 0; i < 5; i++) expect((await call(valid)).status).toBe(202)
    const sixth = await call(valid)
    expect(sixth.status).toBe(429)
    expect((await sixth.json()).error.code).toBe('RATE_LIMITED')
    expect(insert).toHaveBeenCalledTimes(5)
    expect(rateLimit).toHaveBeenCalledWith(expect.any(Request), { limit: 5, window: '1 h', prefix: 'feedback' })
  })

  it.each([
    ['kind: spam', { ...valid, kind: 'spam' }],
    ['missing kind', { entity: 'au-eta' }],
    ['empty entity', { ...valid, entity: '' }],
    ['entity over 120', { ...valid, entity: 'x'.repeat(121) }],
    ['note over 1000', { ...valid, note: 'x'.repeat(1001) }],
    ['non-string note', { ...valid, note: 5 }],
  ])('%s -> 400 VALIDATION', async (_name, body) => {
    const res = await call(body)
    expect(res.status).toBe(400)
    expect((await res.json()).error.code).toBe('VALIDATION')
    expect(insert).not.toHaveBeenCalled()
  })

  it('accepts the boundary lengths', async () => {
    expect((await call({ entity: 'x'.repeat(120), kind: 'unclear', note: 'y'.repeat(1000) })).status).toBe(202)
  })

  it('invalid JSON -> 400', async () => {
    expect((await call('{nope', true)).status).toBe(400)
  })

  it('insert failure -> 500 INTERNAL envelope', async () => {
    insert.mockResolvedValue({ error: { message: 'rls' } })
    const res = await call(valid)
    expect(res.status).toBe(500)
    expect((await res.json()).error.code).toBe('INTERNAL')
  })
})

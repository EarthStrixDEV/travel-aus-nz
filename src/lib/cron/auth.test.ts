import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { requireCron } from './auth'

const req = (auth?: string) => new Request('http://localhost/api/cron/x', { headers: auth ? { authorization: auth } : {} })

beforeEach(() => vi.stubEnv('CRON_SECRET', 's3cret'))
afterEach(() => vi.unstubAllEnvs())

describe('requireCron', () => {
  it('passes (null) with the exact bearer token', () => {
    expect(requireCron(req('Bearer s3cret'))).toBeNull()
  })

  it.each([undefined, 'Bearer wrong', 'Bearer ', 'Bearer s3cret2', 's3cret', 'Basic s3cret', 'bearer s3cret'])(
    'rejects %s with 401',
    async (auth) => {
      const res = requireCron(req(auth))
      expect(res?.status).toBe(401)
      expect((await res!.json()).error.code).toBe('UNAUTHORIZED')
    },
  )

  it('never accepts an empty secret: unset CRON_SECRET -> 401 even for "Bearer "', () => {
    vi.stubEnv('CRON_SECRET', '')
    expect(requireCron(req('Bearer '))?.status).toBe(401)
    expect(requireCron(req('Bearer'))?.status).toBe(401)
    expect(requireCron(req())?.status).toBe(401)
    vi.unstubAllEnvs()
    delete process.env.CRON_SECRET
    expect(requireCron(req('Bearer undefined'))?.status).toBe(401)
    expect(requireCron(req())?.status).toBe(401)
  })
})

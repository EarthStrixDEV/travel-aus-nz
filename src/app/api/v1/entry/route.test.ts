import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const getEntry = vi.fn()
vi.mock('@/lib/content/entry', () => ({ getEntry: (...a: unknown[]) => getEntry(...a) }))

import { GET } from './route'

const call = (qs = '') => GET(new NextRequest(`http://localhost:3000/api/v1/entry${qs}`))

beforeEach(() => {
  vi.clearAllMocks()
  vi.spyOn(console, 'error').mockImplementation(() => {})
  getEntry.mockResolvedValue({ rules: [], permissions: [], links: [], documents: [], faqs: [], timeline: null, last_verified_at: null })
})

describe('GET /api/v1/entry', () => {
  it('returns the payload for the requested locale (default th)', async () => {
    const res = await call()
    expect(res.status).toBe(200)
    expect(Object.keys(await res.json()).sort()).toEqual(['documents', 'faqs', 'last_verified_at', 'links', 'permissions', 'rules', 'timeline'])
    expect(getEntry).toHaveBeenCalledWith('th')
    await call('?locale=en')
    expect(getEntry).toHaveBeenLastCalledWith('en')
  })

  it('unknown locale -> 400 VALIDATION', async () => {
    const res = await call('?locale=fr')
    expect(res.status).toBe(400)
    expect((await res.json()).error.code).toBe('VALIDATION')
  })

  it('loader error -> 500 INTERNAL envelope', async () => {
    getEntry.mockRejectedValue(new Error('db down'))
    const res = await call()
    expect(res.status).toBe(500)
    expect((await res.json()).error.code).toBe('INTERNAL')
  })
})

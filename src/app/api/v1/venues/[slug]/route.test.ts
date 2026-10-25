import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const getVenue = vi.fn()
vi.mock('@/lib/content/venues', () => ({ getVenue: (...a: unknown[]) => getVenue(...a) }))

import { GET } from './route'

const call = (slug: string, qs = '') =>
  GET(new NextRequest(`http://localhost:3000/api/v1/venues/${slug}${qs}`), { params: Promise.resolve({ slug }) })

beforeEach(() => {
  vi.clearAllMocks()
  vi.spyOn(console, 'error').mockImplementation(() => {})
})

describe('GET /api/v1/venues/:slug', () => {
  it('returns the venue detail for the locale', async () => {
    getVenue.mockResolvedValue({ slug: 'low-tide', name: 'Low Tide' })
    const res = await call('low-tide', '?locale=en')
    expect(res.status).toBe(200)
    expect(getVenue).toHaveBeenCalledWith('low-tide', 'en')
    expect(await res.json()).toEqual({ slug: 'low-tide', name: 'Low Tide' })
  })

  it('defaults to th', async () => {
    getVenue.mockResolvedValue({ slug: 'low-tide' })
    await call('low-tide')
    expect(getVenue).toHaveBeenCalledWith('low-tide', 'th')
  })

  it('unknown, closed or unpublished slug -> 404 NOT_FOUND', async () => {
    getVenue.mockResolvedValue(null)
    const res = await call('nope')
    expect(res.status).toBe(404)
    expect((await res.json()).error.code).toBe('NOT_FOUND')
  })

  it.each(['Bad_Slug', '?locale=fr'])('%s -> 400 VALIDATION', async (v) => {
    const res = v.startsWith('?') ? await call('ok', v) : await call(v)
    expect(res.status).toBe(400)
    expect((await res.json()).error.code).toBe('VALIDATION')
    expect(getVenue).not.toHaveBeenCalled()
  })

  it('loader error -> 500 INTERNAL envelope', async () => {
    getVenue.mockRejectedValue(new Error('db down'))
    const res = await call('low-tide')
    expect(res.status).toBe(500)
    expect((await res.json()).error.code).toBe('INTERNAL')
  })
})

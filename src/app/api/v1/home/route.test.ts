import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const getHome = vi.fn()
vi.mock('@/lib/content/home', () => ({ getHome: (...a: unknown[]) => getHome(...a) }))

import { GET } from './route'

const call = (qs: string) => GET(new NextRequest(`http://localhost:3000/api/v1/home${qs}`))

beforeEach(() => {
  vi.clearAllMocks()
  vi.spyOn(console, 'error').mockImplementation(() => {})
})

describe('GET /api/v1/home', () => {
  it('returns HomeData for the requested country and locale', async () => {
    const data = { slides: [], regions: [], journeys: [], routeShowcase: null, diningEdit: null }
    getHome.mockResolvedValue(data)
    const res = await call('?country=nz&locale=en')
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual(data)
    expect(getHome).toHaveBeenCalledWith('en', 'nz')
  })

  it('defaults to th / au', async () => {
    getHome.mockResolvedValue({})
    await call('')
    expect(getHome).toHaveBeenCalledWith('th', 'au')
  })

  it('invalid country -> 400 VALIDATION', async () => {
    const res = await call('?country=fr')
    expect(res.status).toBe(400)
    expect((await res.json()).error.code).toBe('VALIDATION')
    expect(getHome).not.toHaveBeenCalled()
  })

  it('loader error -> 500 INTERNAL envelope', async () => {
    getHome.mockRejectedValue(new Error('db down'))
    const res = await call('?country=au')
    expect(res.status).toBe(500)
    const body = await res.json()
    expect(body.error.code).toBe('INTERNAL')
    expect(typeof body.error.message).toBe('string')
  })
})

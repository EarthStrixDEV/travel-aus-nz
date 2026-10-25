import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'
import { encodeCursor } from '@/lib/api/cursor'
import { photo } from '@/lib/gallery/fixtures'

const getGallery = vi.fn()
vi.mock('@/lib/content/gallery', () => ({ getGallery: (...a: unknown[]) => getGallery(...a) }))

import { GET } from './route'

const call = (qs: string) => GET(new NextRequest(`http://localhost:3000/api/v1/gallery${qs}`))

const LIST = [
  photo('a', { sort: 1, season: 'winter', region: { slug: 'sydney', name: 'Sydney' }, type: 'beach' }),
  photo('b', { sort: 2, season: 'winter', region: { slug: 'sydney', name: 'Sydney' }, type: 'city' }),
  photo('c', { sort: 3, season: 'summer', region: { slug: 'tasmania', name: 'Tasmania' }, type: 'beach' }),
]

beforeEach(() => {
  vi.clearAllMocks()
  vi.spyOn(console, 'error').mockImplementation(() => {})
  getGallery.mockResolvedValue(LIST)
})

describe('GET /api/v1/gallery', () => {
  it('returns photos with their place summary, defaulting to th', async () => {
    const res = await call('')
    expect(res.status).toBe(200)
    expect(getGallery).toHaveBeenCalledWith('th')
    const body = await res.json()
    expect(body.items.map((p: { id: string }) => p.id)).toEqual(['id-a', 'id-b', 'id-c'])
    expect(body.items[0].place).toMatchObject({ slug: 'a', bestTime: 'Best a', access: 'Access a' })
    expect(body.nextCursor).toBeNull()
  })

  it('filters by region, type and season (intersection)', async () => {
    const res = await call('?region=sydney&season=winter&type=city&locale=en')
    expect(getGallery).toHaveBeenCalledWith('en')
    expect((await res.json()).items.map((p: { id: string }) => p.id)).toEqual(['id-b'])
  })

  it('pages with an opaque cursor', async () => {
    const first = await (await call('?limit=2')).json()
    expect(first.items).toHaveLength(2)
    expect(first.nextCursor).toEqual(expect.any(String))
    const second = await (await call(`?limit=2&cursor=${first.nextCursor}`)).json()
    expect(second.items.map((p: { id: string }) => p.id)).toEqual(['id-c'])
    expect(second.nextCursor).toBeNull()
  })

  it.each([
    '?season=monsoon',
    '?region=Not%20A%20Slug',
    '?type=%3Cscript%3E',
    '?locale=fr',
    '?limit=0',
    '?cursor=!!!notacursor',
    `?cursor=${encodeCursor({ sort: 'a-string', id: 'x' })}`,
  ])('%s -> 400 VALIDATION', async (qs) => {
    const res = await call(qs)
    expect(res.status).toBe(400)
    expect((await res.json()).error.code).toBe('VALIDATION')
    expect(getGallery).not.toHaveBeenCalled()
  })

  it('loader error -> 500 INTERNAL envelope', async () => {
    getGallery.mockRejectedValue(new Error('db down'))
    const res = await call('')
    expect(res.status).toBe(500)
    expect((await res.json()).error.code).toBe('INTERNAL')
  })
})

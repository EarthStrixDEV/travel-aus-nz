import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'
import { encodeCursor } from '@/lib/api/cursor'
import type { VenueCard } from '@/lib/venues/filter'

const getVenues = vi.fn()
vi.mock('@/lib/content/venues', () => ({ getVenues: (...a: unknown[]) => getVenues(...a) }))

import { GET } from './route'

const call = (qs = '') => GET(new NextRequest(`http://localhost:3000/api/v1/venues${qs}`))

function venue(slug: string, over: Partial<VenueCard> = {}): VenueCard {
  return {
    id: `id-${slug}`,
    slug,
    kind: 'restaurant',
    name: slug,
    city: { slug: 'sydney', name: 'Sydney' },
    hood: 'CBD',
    cuisine: null,
    priceLevel: 2,
    dietary: [],
    drinks: [],
    tags: [],
    description: '',
    menuHighlights: '',
    signatureDrinks: '',
    hours: [],
    hoursNote: '',
    stop: null,
    ...over,
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.spyOn(console, 'error').mockImplementation(() => {})
  getVenues.mockResolvedValue([])
})

describe('GET /api/v1/venues', () => {
  it('defaults: th, restaurants, whole catalog', async () => {
    const res = await call()
    expect(res.status).toBe(200)
    expect(getVenues).toHaveBeenCalledWith('th', undefined)
    expect(await res.json()).toMatchObject({ items: [], nextCursor: null })
  })

  it('passes locale and city to the loader and filters like filterVenues', async () => {
    getVenues.mockResolvedValue([
      venue('a', { dietary: ['vegan', 'gluten_free'], priceLevel: 2 }),
      venue('b', { dietary: ['vegan'], priceLevel: 2 }),
      venue('c', { dietary: ['vegan', 'gluten_free'], priceLevel: 4 }),
      venue('d', { kind: 'bar', dietary: ['vegan', 'gluten_free'] }),
    ])
    const res = await call('?locale=en&city=sydney&price_max=3&diet[]=vegan&diet=gluten_free')
    expect(getVenues).toHaveBeenCalledWith('en', 'sydney')
    const body = await res.json()
    expect(body.items.map((v: VenueCard) => v.slug)).toEqual(['a'])
    expect(body.facets.diet).toEqual({ vegan: 2, gluten_free: 1 })
    expect(body.facets.price).toEqual({ '1': 0, '2': 1, '3': 1, '4': 2 })
  })

  it('kind=bar returns bars only', async () => {
    getVenues.mockResolvedValue([venue('r'), venue('b', { kind: 'bar' })])
    const body = await (await call('?kind=bar')).json()
    expect(body.items.map((v: VenueCard) => v.slug)).toEqual(['b'])
  })

  it('paginates by slug with a cursor and reports nextCursor', async () => {
    getVenues.mockResolvedValue(['e', 'b', 'a', 'd', 'c'].map((s) => venue(s)))
    const first = await (await call('?limit=2')).json()
    expect(first.items.map((v: VenueCard) => v.slug)).toEqual(['a', 'b'])
    expect(first.nextCursor).toBe(encodeCursor({ sort: 'b', id: 'id-b' }))
    // Facets describe the whole filtered set, not the page.
    expect(first.facets.city).toEqual({ sydney: 5 })

    const second = await (await call(`?limit=2&cursor=${first.nextCursor}`)).json()
    expect(second.items.map((v: VenueCard) => v.slug)).toEqual(['c', 'd'])

    const last = await (await call(`?limit=2&cursor=${second.nextCursor}`)).json()
    expect(last.items.map((v: VenueCard) => v.slug)).toEqual(['e'])
    expect(last.nextCursor).toBeNull()
  })

  it.each([
    '?cursor=!!!notacursor',
    '?kind=pub',
    '?price_max=5',
    '?price_max=0',
    '?price_max=abc',
    '?city=Sydney!',
    '?diet[]=<script>',
    '?locale=fr',
    '?limit=0',
    '?limit=101',
  ])('%s -> 400 VALIDATION', async (qs) => {
    const res = await call(qs)
    expect(res.status).toBe(400)
    expect((await res.json()).error.code).toBe('VALIDATION')
    expect(getVenues).not.toHaveBeenCalled()
  })

  it('loader error -> 500 INTERNAL envelope', async () => {
    getVenues.mockRejectedValue(new Error('db down'))
    const res = await call()
    expect(res.status).toBe(500)
    expect((await res.json()).error.code).toBe('INTERNAL')
  })
})

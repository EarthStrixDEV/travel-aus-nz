import { describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/supabase/public', () => ({ createPublicClient: () => ({}) }))
vi.mock('@/lib/content/cache', () => ({ cachedContent: (_key: string[], _tag: string, fn: () => unknown) => fn }))

import { loadGallery, toGalleryPhoto } from './gallery'

type Row = Record<string, unknown>

const venue = (slug: string, over: Row = {}) => ({
  slug, name_i18n: { en: slug.toUpperCase() }, area_i18n: { en: 'Surry Hills' }, status: 'published', is_closed: false, ...over,
})

const row = (over: Row = {}): Row => ({
  id: 'p1',
  season: 'winter',
  sort: 2,
  title_i18n: { en: 'Bondi walk', th: 'เดินบอนไดถึงคูจี' },
  media: { path: 'placeholder/bondi.jpg', width: 1200, height: 1500, blurhash: null, alt_i18n: { en: 'Cliffs' } },
  region: { slug: 'sydney', name_i18n: { en: 'Sydney' } },
  place: {
    id: 'pl1', slug: 'bondi-to-coogee-walk', category: 'Wine region', name_i18n: { en: 'Bondi to Coogee' },
    desc_i18n: { en: 'Six km of cliffs' }, best_time_i18n: { en: 'Nov-Mar' }, access_i18n: { en: 'Bus 333' },
    nearby: [],
  },
  ...over,
})

describe('toGalleryPhoto', () => {
  it('maps the photo, its place summary and the media', () => {
    const p = toGalleryPhoto(row() as never, 'en')!
    expect(p).toMatchObject({
      id: 'p1', title: 'Bondi walk', sort: 2, season: 'winter',
      region: { slug: 'sydney', name: 'Sydney' }, type: 'wine-region', typeLabel: 'Wine region',
      image: { alt: 'Cliffs', width: 1200, height: 1500 },
      place: { id: 'pl1', slug: 'bondi-to-coogee-walk', name: 'Bondi to Coogee', description: 'Six km of cliffs', bestTime: 'Nov-Mar', access: 'Bus 333' },
    })
    expect(p.image.url).toMatch(/\/storage\/v1\/object\/public\/media\/placeholder\/bondi\.jpg$/)
    expect(p.image.blurDataURL).toBeUndefined()
  })

  it('uses the requested locale, and falls back to the place name when the photo has no title', () => {
    expect(toGalleryPhoto(row() as never, 'th')!.title).toBe('เดินบอนไดถึงคูจี')
    expect(toGalleryPhoto(row({ title_i18n: null }) as never, 'en')!.title).toBe('Bondi to Coogee')
  })

  it('derives blurDataURL from a blurhash', () => {
    const p = toGalleryPhoto(row({ media: { path: 'a.jpg', width: 10, height: 10, blurhash: 'LEHV6nWB2yk8pyo0adR*.7kCMdnj', alt_i18n: null } }) as never, 'en')!
    expect(p.image.blurDataURL).toMatch(/^data:image\/svg\+xml;base64,/)
    expect(p.image.alt).toBe('Bondi walk')
  })

  it('lists at most 3 nearby venues, by sort, leaving out closed, unpublished and missing ones', () => {
    const nearby = [
      { sort: 5, venue: venue('e') },
      { sort: 1, venue: venue('a') },
      { sort: 2, venue: venue('closed', { is_closed: true }) },
      { sort: 3, venue: venue('draft', { status: 'draft' }) },
      { sort: 4, venue: null },
      { sort: 4, venue: venue('d') },
      { sort: 2, venue: venue('b') },
    ]
    const p = toGalleryPhoto(row({ place: { ...(row().place as Row), nearby } }) as never, 'en')!
    expect(p.place.nearby.map((v) => v.slug)).toEqual(['a', 'b', 'd'])
    expect(p.place.nearby[0]).toEqual({ slug: 'a', name: 'A', area: 'Surry Hills' })
  })

  it('drops a photo whose media or place is missing', () => {
    expect(toGalleryPhoto(row({ media: null }) as never, 'en')).toBeNull()
    expect(toGalleryPhoto(row({ place: null }) as never, 'en')).toBeNull()
  })
})

function fakeClient(rows: Row[]) {
  const calls: Record<string, unknown[][]> = {}
  const rec = (name: string) => (...a: unknown[]) => ((calls[name] ??= []).push(a), q)
  const q: Record<string, unknown> = {
    select: rec('select'),
    eq: rec('eq'),
    order: rec('order'),
    then: (resolve: (v: { data: Row[]; error: null }) => unknown) => resolve({ data: rows, error: null }),
  }
  return { client: { from: (t: string) => ((calls.from = [[t]]), q) } as never, calls }
}

describe('loadGallery', () => {
  it('reads published photos of published places, ordered by sort', async () => {
    const { client, calls } = fakeClient([row({ id: 'b', sort: 2 }), row({ id: 'a', sort: 1 })])
    const list = await loadGallery(client, 'en')
    expect(calls.from).toEqual([['gallery_photos']])
    expect(calls.eq).toEqual(expect.arrayContaining([['status', 'published'], ['place.status', 'published']]))
    expect(list.map((p) => p.id)).toEqual(['a', 'b'])
  })

  it('throws on a database error', async () => {
    const q: Record<string, unknown> = {
      select: () => q, eq: () => q, order: () => q,
      then: (resolve: (v: unknown) => unknown) => resolve({ data: null, error: new Error('db down') }),
    }
    await expect(loadGallery({ from: () => q } as never, 'en')).rejects.toThrow('db down')
  })
})

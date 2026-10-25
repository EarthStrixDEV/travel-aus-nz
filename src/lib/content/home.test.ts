import { describe, expect, it, vi } from 'vitest'

type Row = Record<string, unknown>
let tables: Record<string, Row[]> = {}

/** Minimal PostgREST query-builder stand-in: honours eq / in / limit; order is a no-op. */
function fakeClient() {
  return {
    from(table: string) {
      let rows = [...(tables[table] ?? [])]
      const q = {
        select: () => q,
        eq: (col: string, val: unknown) => {
          rows = rows.filter((r) => r[col] === val)
          return q
        },
        in: (col: string, vals: unknown[]) => {
          rows = rows.filter((r) => vals.includes(r[col]))
          return q
        },
        order: () => q,
        limit: (n: number) => {
          rows = rows.slice(0, n)
          return q
        },
        then: (resolve: (v: { data: Row[]; error: null }) => unknown) => resolve({ data: rows, error: null }),
      }
      return q
    },
  }
}

vi.mock('@/lib/supabase/public', () => ({ createPublicClient: () => fakeClient() }))
// unstable_cache needs the Next runtime; run the loader directly.
vi.mock('@/lib/content/cache', () => ({ cachedContent: (_key: string[], _tag: string, fn: () => unknown) => fn }))

import { getHome } from './home'

const region = (slug: string, rank: number | null, status = 'published', country = 'AU'): Row => ({
  slug,
  country,
  status,
  featured_rank: rank,
  name_i18n: { en: slug.toUpperCase() },
  state_i18n: null,
  lede_i18n: null,
  best_months: [9, 10, 11],
  cover: null,
})

describe('getHome regions', () => {
  it('excludes draft regions and orders by featured_rank', async () => {
    tables = {
      regions: [
        region('melbourne', 3),
        region('hidden-draft', 2, 'draft'),
        region('sydney', 1),
        region('tasmania', 2),
        region('unranked', null),
        region('fiordland', 1, 'published', 'NZ'),
      ],
    }
    const home = await getHome('en', 'au')
    expect(home.regions.map((r) => r.slug)).toEqual(['sydney', 'tasmania', 'melbourne'])
  })

  it('localises names with an en fallback', async () => {
    tables = { regions: [{ ...region('sydney', 1), name_i18n: { en: 'Sydney', th: 'ซิดนีย์' } }, { ...region('perth', 2), name_i18n: { en: 'Perth' } }] }
    const th = await getHome('th', 'au')
    expect(th.regions.map((r) => r.name)).toEqual(['ซิดนีย์', 'Perth'])
  })
})

describe('getHome slides', () => {
  it('returns only active slides', async () => {
    tables = {
      hero_slides: [
        { id: 1, sort: 1, active: true, caption_i18n: { en: 'One' }, media: null, place: null },
        { id: 2, sort: 2, active: false, caption_i18n: { en: 'Two' }, media: null, place: null },
      ],
    }
    const home = await getHome('en', 'au')
    expect(home.slides.map((s) => s.id)).toEqual([1])
  })
})

describe('getHome diningEdit', () => {
  const place = (id: string, closed: boolean): Row => ({
    id,
    slug: `slug-${id}`,
    type: 'restaurant',
    status: 'published',
    is_closed: closed,
    name_i18n: { en: `Venue ${id}` },
    area_i18n: { en: 'CBD' },
    price_level: 2,
    city: { name_i18n: { en: 'Sydney' } },
    venue: { cuisine: { name_i18n: { en: 'Seafood' } } },
    tags: [],
  })

  it('drops closed venues and keeps collection order', async () => {
    tables = {
      collections: [
        { id: 'c1', slug: 'edit', placement: 'home_dining', status: 'published', title_i18n: { en: 'Edit' }, sub_i18n: { en: 'October' } },
      ],
      collection_items: [
        { collection_id: 'c1', entity_id: 'p1', position: 2 },
        { collection_id: 'c1', entity_id: 'p2', position: 1 },
        { collection_id: 'c1', entity_id: 'p3', position: 3 },
      ],
      places: [place('p1', false), place('p2', false), place('p3', true)],
    }
    const home = await getHome('en', 'au')
    expect(home.diningEdit?.venues.map((v) => v.id)).toEqual(['p2', 'p1'])
    expect(home.diningEdit?.venues[0]).toMatchObject({ name: 'Venue p2', cuisine: 'Seafood', where: 'CBD, Sydney' })
  })

  it('is null without a published home_dining collection', async () => {
    tables = { collections: [{ id: 'c1', slug: 'x', placement: 'home_dining', status: 'draft', title_i18n: {} }] }
    expect((await getHome('en', 'au')).diningEdit).toBeNull()
  })
})

describe('getHome routeShowcase', () => {
  it('sorts legs by seq', async () => {
    tables = {
      journeys: [
        {
          slug: 'mel-sor',
          kind: 'route_showcase',
          status: 'published',
          country: 'AU',
          title_i18n: { en: 'Melbourne → Sorrento' },
          line_i18n: { en: 'Pay with myki' },
          from_name: 'Melbourne',
          to_name: 'Sorrento',
          days: 1,
          price_from: 18,
          currency: 'AUD',
          modes: ['train', 'ferry'],
          cover: null,
          legs: [
            { seq: 2, day: 1, mode: 'ferry', from_name: 'B', to_name: 'C', operator: null, duration_min: 40, frequency_text: 'Hourly' },
            { seq: 1, day: 1, mode: 'train', from_name: 'A', to_name: 'B', operator: 'V/Line', duration_min: 65, frequency_text: null },
          ],
        },
      ],
    }
    const { routeShowcase } = await getHome('en', 'au')
    expect(routeShowcase?.legs.map((l) => l.from)).toEqual(['A', 'B'])
    expect(routeShowcase?.legs[0]).toMatchObject({ mode: 'train', operator: 'V/Line', durationMin: 65 })
  })
})

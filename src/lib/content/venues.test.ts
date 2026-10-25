import { describe, expect, it, vi } from 'vitest'

type Row = Record<string, unknown>
let tables: Record<string, Row[]> = {}

const pick = (row: Row, path: string): unknown => path.split('.').reduce<unknown>((o, k) => (o as Row | null)?.[k], row)

/** Minimal PostgREST stand-in: honours eq (including `embed.column`), in and order. */
function fakeClient() {
  return {
    from(table: string) {
      let rows = [...(tables[table] ?? [])]
      const q = {
        select: () => q,
        eq: (col: string, val: unknown) => {
          rows = rows.filter((r) => pick(r, col) === val)
          return q
        },
        in: (col: string, vals: unknown[]) => {
          rows = rows.filter((r) => vals.includes(pick(r, col)))
          return q
        },
        order: (col: string) => {
          rows = [...rows].sort((a, b) => String(pick(a, col)).localeCompare(String(pick(b, col))))
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

import { getVenue, getVenues } from './venues'

const place = (slug: string, over: Row = {}, venue: Row | null = {}): Row => ({
  slug,
  id: `id-${slug}`,
  type: 'restaurant',
  status: 'published',
  is_closed: false,
  name_i18n: { en: slug.toUpperCase(), th: `${slug}-th` },
  area_i18n: { en: 'Surry Hills' },
  desc_i18n: { en: 'About' },
  price_level: 3,
  hours_note_i18n: { en: 'Closed Mondays' },
  city: { slug: 'sydney', name_i18n: { en: 'Sydney', th: 'ซิดนีย์' }, timezone: 'Australia/Sydney' },
  neighbourhood: { name: 'Surry Hills' },
  venue: venue && {
    dietary: ['vegan'],
    menu_highlights_i18n: { en: 'Bread' },
    drinks_i18n: { en: 'Spritz' },
    cuisine: { slug: 'seafood', name_i18n: { en: 'Seafood', th: 'อาหารทะเล' } },
    drinks: [{ drink: 'wine' }],
    ...venue,
  },
  tags: [],
  hours: [],
  stops: [],
  ...over,
})

describe('getVenues', () => {
  it('lists only published, open venues (Review Focus 4)', async () => {
    tables = {
      places: [
        place('open'),
        place('closed', { is_closed: true }),
        place('draft', { status: 'draft' }),
        place('archived', { status: 'archived' }),
        place('closed-draft', { is_closed: true, status: 'draft' }),
      ],
    }
    const venues = await getVenues('en')
    expect(venues.map((v) => v.slug)).toEqual(['open'])
  })

  it('a closed venue never reaches the detail lookup either', async () => {
    tables = { places: [place('closed', { is_closed: true }), place('draft', { status: 'draft' })] }
    expect(await getVenue('closed', 'en')).toBeNull()
    expect(await getVenue('draft', 'en')).toBeNull()
  })

  it('narrows to one city and orders by slug', async () => {
    tables = {
      places: [
        place('zeta'),
        place('alpha'),
        place('mel', { city: { slug: 'melbourne', name_i18n: { en: 'Melbourne' }, timezone: 'Australia/Melbourne' } }),
      ],
    }
    expect((await getVenues('en', 'sydney')).map((v) => v.slug)).toEqual(['alpha', 'zeta'])
    expect((await getVenues('en')).map((v) => v.slug)).toEqual(['alpha', 'mel', 'zeta'])
  })

  it('maps a venue: localised text, cuisine, dietary, drinks, price', async () => {
    tables = { places: [place('saltbush')] }
    const [v] = await getVenues('th')
    expect(v).toMatchObject({
      id: 'id-saltbush',
      slug: 'saltbush',
      kind: 'restaurant',
      name: 'saltbush-th',
      city: { slug: 'sydney', name: 'ซิดนีย์' },
      hood: 'Surry Hills',
      cuisine: { slug: 'seafood', name: 'อาหารทะเล' },
      priceLevel: 3,
      dietary: ['vegan'],
      drinks: ['wine'],
      description: 'About',
      menuHighlights: 'Bread',
      signatureDrinks: 'Spritz',
      hoursNote: 'Closed Mondays',
    })
  })

  it('lists cafes under restaurants and bars under bars', async () => {
    tables = { places: [place('c', { type: 'cafe' }), place('b', { type: 'bar' }), place('r', { type: 'restaurant' })] }
    const kinds = Object.fromEntries((await getVenues('en')).map((v) => [v.slug, v.kind]))
    expect(kinds).toEqual({ c: 'restaurant', b: 'bar', r: 'restaurant' })
  })

  it('skips places without a venues row and venues without a cuisine are fine', async () => {
    tables = { places: [place('no-venue', {}, null), place('no-cuisine', {}, { cuisine: null, drinks: null, dietary: null })] }
    const venues = await getVenues('en')
    expect(venues.map((v) => v.slug)).toEqual(['no-cuisine'])
    expect(venues[0]).toMatchObject({ cuisine: null, drinks: [], dietary: [] })
  })

  it('keeps only atmosphere tags, hours sorted, and the nearest stop by rank', async () => {
    tables = {
      places: [
        place('bar', {
          type: 'bar',
          tags: [
            { tag: { slug: 'rooftop', kind: 'atmosphere', name_i18n: { en: 'Rooftop' } } },
            { tag: { slug: 'art', kind: 'interest', name_i18n: { en: 'Art' } } },
            { tag: null },
          ],
          hours: [
            { weekday: 3, open_time: '17:00:00', close_time: '01:00:00' },
            { weekday: 2, open_time: '17:00:00', close_time: '01:00:00' },
          ],
          stops: [
            { rank: 2, walk_min: 9, stop: { name: 'Far Station' } },
            { rank: 1, walk_min: 4, stop: { name: 'Near Station' } },
            { rank: 0, walk_min: 1, stop: null },
          ],
        }),
      ],
    }
    const [v] = await getVenues('en')
    expect(v.tags).toEqual([{ slug: 'rooftop', name: 'Rooftop' }])
    expect(v.hours).toEqual([
      { weekday: 2, open: '17:00', close: '01:00' },
      { weekday: 3, open: '17:00', close: '01:00' },
    ])
    expect(v.stop).toEqual({ name: 'Near Station', walkMin: 4 })
  })

  it('falls back to the neighbourhood when the area is empty', async () => {
    tables = { places: [place('p', { area_i18n: null })] }
    expect((await getVenues('en'))[0].hood).toBe('Surry Hills')
  })
})

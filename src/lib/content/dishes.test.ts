import { describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/supabase/public', () => ({ createPublicClient: () => ({}) }))
vi.mock('@/lib/content/cache', () => ({ cachedContent: (_key: string[], _tag: string, fn: () => unknown) => fn }))

import { pickVenueRegion } from '@/lib/dishes/filter'
import { loadDish, loadDishes } from './dishes'

type Row = Record<string, unknown>

/** Minimal PostgREST stand-in: `eq` filters top-level columns; every other builder call passes through. */
function fakeClient(tables: Record<string, Row[]>) {
  const from = (table: string) => {
    let rows = [...(tables[table] ?? [])]
    const q: Record<string, unknown> = {}
    const pass = () => q
    Object.assign(q, {
      select: pass,
      order: pass,
      eq: (col: string, value: unknown) => {
        if (!col.includes('.')) rows = rows.filter((r) => r[col] === value)
        return q
      },
      maybeSingle: () => Promise.resolve({ data: rows[0] ?? null, error: null }),
      then: (resolve: (v: unknown) => unknown) => resolve({ data: rows, error: null }),
    })
    return q
  }
  return { from } as never
}

const region = (slug: string) => ({ slug, name_i18n: { en: slug[0].toUpperCase() + slug.slice(1) } })

const dish = (id: string, over: Row = {}): Row => ({
  id,
  slug: id,
  country: 'AU',
  type: 'savoury',
  name_i18n: { en: id.toUpperCase(), th: `ไทย ${id}` },
  line_i18n: null,
  dietary: ['gluten_free'],
  price_level: 2,
  price_text: 'A$10–14',
  must_try_rank: null,
  sort: 0,
  status: 'published',
  region: region('sydney'),
  cover: null,
  ...over,
})

const place = (slug: string, over: Row = {}): Row => ({
  slug,
  name_i18n: { en: slug },
  area_i18n: { en: 'The Rocks' },
  status: 'published',
  is_closed: false,
  stops: [{ rank: 1, walk_min: 6, stop: { name: 'Circular Quay' } }],
  ...over,
})

describe('loadDishes', () => {
  const tables = () => ({
    dishes: [
      dish('pie', { sort: 2 }),
      dish('pavlova', { sort: 1, must_try_rank: 2 }),
      dish('oysters', { sort: 3, must_try_rank: 1 }),
      dish('draft-dish', { status: 'draft', must_try_rank: 3 }),
      dish('hangi', { country: 'NZ', region: region('rotorua'), sort: 4, must_try_rank: 3 }),
    ],
    collections: [
      { slug: 'sweet-tooth', kind: 'dish', status: 'published', title_i18n: { en: 'Sweet tooth' }, sub_i18n: null, items: [
        { entity_id: 'pavlova', position: 2 }, { entity_id: 'draft-dish', position: 1 }, { entity_id: 'pie', position: 3 },
      ] },
      { slug: 'only-drafts', kind: 'dish', status: 'published', title_i18n: { en: 'Nope' }, sub_i18n: null, items: [{ entity_id: 'draft-dish', position: 1 }] },
      { slug: 'draft-collection', kind: 'dish', status: 'draft', title_i18n: { en: 'Draft' }, sub_i18n: null, items: [{ entity_id: 'pie', position: 1 }] },
    ],
  })

  it('lists published dishes in editors order and leaves drafts out', async () => {
    const data = await loadDishes(fakeClient(tables()), 'en')
    expect(data.dishes.map((d) => d.slug)).toEqual(['pavlova', 'pie', 'oysters', 'hangi'])
    expect(data.dishes[0]).toMatchObject({ name: 'PAVLOVA', country: 'au', region: { slug: 'sydney', name: 'Sydney' }, priceText: 'A$10–14' })
  })

  it('must-try is ranks 1–3 in rank order, published only', async () => {
    const data = await loadDishes(fakeClient(tables()), 'en')
    expect(data.mustTry.map((d) => d.slug)).toEqual(['oysters', 'pavlova', 'hangi'])
  })

  it('collections count published members only and hide empty or draft collections', async () => {
    const data = await loadDishes(fakeClient(tables()), 'en')
    expect(data.collections).toHaveLength(1)
    expect(data.collections[0]).toMatchObject({ slug: 'sweet-tooth', title: 'Sweet tooth', count: 2 })
    expect(data.collections[0].previews.map((d) => d.slug)).toEqual(['pavlova', 'pie'])
  })
})

describe('loadDish', () => {
  const detail = (venues: Row[]) => ({
    dishes: [
      dish('oysters', {
        story_i18n: { en: 'Grown in NSW estuaries.' },
        dispute_note_i18n: null,
        taste_i18n: { en: 'Creamy' },
        served_i18n: { en: 'On ice' },
        allergy_i18n: null,
        pairings: [{ k_i18n: { en: 'Beer' }, v_i18n: { en: 'Pale ale' }, sort: 2 }, { k_i18n: { en: 'Wine' }, v_i18n: { en: 'Semillon' }, sort: 1 }],
        venues,
      }),
    ],
  })

  it('never lists a closed or unpublished venue', async () => {
    const d = await loadDish(
      fakeClient(detail([
        { rank: 1, price_text: 'A$5 each', note_i18n: null, region: region('sydney'), place: place('closed-bar', { is_closed: true }) },
        { rank: 2, price_text: null, note_i18n: null, region: region('sydney'), place: place('draft-room', { status: 'draft' }) },
        { rank: 3, price_text: null, note_i18n: { en: 'Shucked to order' }, region: region('sydney'), place: place('harbourline') },
      ])),
      'oysters',
      'en',
    )
    expect(d!.venuesByRegion).toEqual([
      {
        region: { slug: 'sydney', name: 'Sydney' },
        venues: [{ slug: 'harbourline', name: 'harbourline', area: 'The Rocks', priceText: null, note: 'Shucked to order', stop: { name: 'Circular Quay', walkMin: 6 } }],
      },
    ])
  })

  it('caps venues at three per region, by rank, and sorts pairings', async () => {
    const venues = [5, 1, 4, 2, 3].map((rank) => ({ rank, price_text: null, note_i18n: null, region: region('sydney'), place: place(`v${rank}`) }))
    const d = await loadDish(fakeClient(detail(venues)), 'oysters', 'en')
    expect(d!.venuesByRegion[0].venues.map((v) => v.slug)).toEqual(['v1', 'v2', 'v3'])
    expect(d!.pairings).toEqual([{ k: 'Wine', v: 'Semillon' }, { k: 'Beer', v: 'Pale ale' }])
  })

  it('a region with no venues falls back to the dish home region', async () => {
    const d = await loadDish(
      fakeClient(detail([{ rank: 1, price_text: null, note_i18n: null, region: region('sydney'), place: place('harbourline') }])),
      'oysters',
      'en',
    )
    expect(pickVenueRegion(d!.venuesByRegion, 'tasmania', d!.region?.slug ?? null)?.region.slug).toBe('sydney')
  })

  it('is null for an unknown or draft dish', async () => {
    expect(await loadDish(fakeClient({ dishes: [dish('x', { status: 'draft' })] }), 'x', 'en')).toBeNull()
    expect(await loadDish(fakeClient({ dishes: [] }), 'nope', 'en')).toBeNull()
  })
})

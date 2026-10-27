import { describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/supabase/public', () => ({ createPublicClient: () => ({}) }))
vi.mock('@/lib/content/cache', () => ({ cachedContent: (_key: string[], _tag: string, fn: () => unknown) => fn }))

import { loadPrepare, parseTitledItems } from './prepare'

type Row = Record<string, unknown>

function fakeClient(tables: Record<string, Row[]>) {
  const from = (table: string) => {
    let rows = [...(tables[table] ?? [])]
    const q: Record<string, unknown> = {}
    Object.assign(q, {
      select: () => q,
      order: () => q,
      eq: (col: string, v: unknown) => ((rows = rows.filter((r) => r[col] === v)), q),
      in: (col: string, vs: unknown[]) => ((rows = rows.filter((r) => vs.includes(r[col]))), q),
      then: (resolve: (v: unknown) => unknown) => resolve({ data: rows, error: null }),
    })
    return q
  }
  return { from } as never
}

const tables = (): Record<string, Row[]> => ({
  checklist_templates: [
    { id: 1, moment: '3m', title_i18n: { en: 'Entry permission' }, note_i18n: null, applies_to: null, sort: 1 },
    { id: 2, moment: '1m', title_i18n: { en: 'Opal card' }, note_i18n: null, applies_to: ['AU'], sort: 2 },
    { id: 3, moment: 'later', title_i18n: { en: 'Bad moment' }, note_i18n: null, applies_to: null, sort: 3 },
  ],
  regions: [
    {
      slug: 'sydney', name_i18n: { en: 'Sydney' }, country: 'AU', best_months: [9, 10, 11], featured_rank: 1, status: 'published',
      months: [{ month: 1, comfort: 3, crowds: 3, recommended: false }, { month: 10, comfort: 3, crowds: 2, recommended: true }],
    },
    { slug: 'no-months', name_i18n: { en: 'X' }, country: 'AU', best_months: null, featured_rank: 2, status: 'published', months: [] },
    { slug: 'draft', name_i18n: { en: 'D' }, country: 'NZ', best_months: null, featured_rank: 3, status: 'draft', months: [{ month: 1, comfort: 1, crowds: 1, recommended: true }] },
  ],
  packing_items: [
    { id: 1, season: 'summer', grp: 'Clothes', title_i18n: { en: 'Hat' }, sort: 1 },
    { id: 2, season: null, grp: 'Clothes', title_i18n: { en: 'No season' }, sort: 2 },
  ],
  content_blocks: [
    { key: 'facts', body_i18n: { en: [{ title: 'Tipping', text: 'Not expected.', icon: 'coin' }, { title: 5 }] } },
    { key: 'health', body_i18n: {} },
  ],
  connectivity_options: [{ id: 1, name_i18n: { en: 'eSIM' }, setup_i18n: { en: 'Install before you fly' }, cost_text: 'A$30', best_i18n: null, watch_i18n: null, verified_at: null }],
  airport_transfers: [
    { airport_code: 'SYD', option_name: 'Airport Link train', mode: 'train', duration_min: 15, fare_min: '20.00', fare_max: null, currency: 'AUD', verified_at: '2026-10-01', city: { slug: 'sydney', name_i18n: { en: 'Sydney' }, region: { country: 'AU' } } },
    { airport_code: 'SYD', option_name: 'Bus 420', mode: 'bus', duration_min: 40, fare_min: '4.50', fare_max: null, currency: 'AUD', verified_at: null, city: { slug: 'sydney', name_i18n: { en: 'Sydney' }, region: { country: 'AU' } } },
  ],
})

describe('loadPrepare', () => {
  it('maps templates with countries and drops an unknown moment', async () => {
    const d = await loadPrepare(fakeClient(tables()), 'en')
    expect(d.templates).toEqual([
      { id: 1, moment: '3m', title: 'Entry permission', note: '', appliesTo: ['au', 'nz'] },
      { id: 2, moment: '1m', title: 'Opal card', note: '', appliesTo: ['au'] },
    ])
  })

  it('returns 12 months per published region that has month rows', async () => {
    const d = await loadPrepare(fakeClient(tables()), 'en')
    expect(d.regions.map((r) => r.slug)).toEqual(['sydney'])
    expect(d.regions[0].months).toHaveLength(12)
    expect(d.regions[0].months[0]).toEqual({ comfort: 3, crowds: 3, recommended: false })
    expect(d.regions[0].months[9]).toEqual({ comfort: 3, crowds: 2, recommended: true })
    expect(d.regions[0].months[5]).toBeNull()
  })

  it('groups airport options per airport and flags unverified fares', async () => {
    const d = await loadPrepare(fakeClient(tables()), 'en')
    expect(d.transfers).toHaveLength(1)
    expect(d.transfers[0]).toMatchObject({ airport: 'SYD', country: 'au', city: { slug: 'sydney', name: 'Sydney' } })
    expect(d.transfers[0].options.map((o) => [o.name, o.fareMin, o.verified])).toEqual([
      ['Airport Link train', 20, true],
      ['Bus 420', 4.5, false],
    ])
  })

  it('reads facts, skips malformed entries and treats {} as none; packing needs a season', async () => {
    const d = await loadPrepare(fakeClient(tables()), 'en')
    expect(d.facts).toEqual([{ title: 'Tipping', text: 'Not expected.', icon: 'coin' }])
    expect(d.health).toEqual([])
    expect(d.packing.map((p) => p.title)).toEqual(['Hat'])
  })
})

describe('parseTitledItems', () => {
  it('falls back to English when the locale is missing', () => {
    expect(parseTitledItems({ en: [{ title: 'A', text: 'B' }] }, 'th')).toEqual([{ title: 'A', text: 'B' }])
  })
})

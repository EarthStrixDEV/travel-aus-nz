import { describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/supabase/public', () => ({ createPublicClient: () => ({}) }))
vi.mock('@/lib/content/cache', () => ({ cachedContent: (_key: string[], _tag: string, fn: () => unknown) => fn }))

import { loadCityLines, loadTransport } from './transport'

type Row = Record<string, unknown>

/**
 * Minimal PostgREST stand-in: one row list per table, `eq` filters on top-level columns (as the database would),
 * every other builder call is recorded and passed through.
 */
function fakeClient(tables: Record<string, Row[]>, opts: { error?: Error } = {}) {
  const calls: { table: string; method: string; args: unknown[] }[] = []
  const from = (table: string) => {
    let rows = [...(tables[table] ?? [])]
    const q: Record<string, unknown> = {}
    const pass = (method: string) => (...args: unknown[]) => (calls.push({ table, method, args }), q)
    Object.assign(q, {
      select: pass('select'),
      order: pass('order'),
      in: pass('in'),
      eq: (col: string, value: unknown) => {
        calls.push({ table, method: 'eq', args: [col, value] })
        if (!col.includes('.')) rows = rows.filter((r) => r[col] === value)
        return q
      },
      maybeSingle: () => Promise.resolve(opts.error ? { data: null, error: opts.error } : { data: rows[0] ?? null, error: null }),
      then: (resolve: (v: unknown) => unknown) => resolve(opts.error ? { data: null, error: opts.error } : { data: rows, error: null }),
    })
    return q
  }
  return { client: { from } as never, calls }
}

const scenic = (slug: string, over: Row = {}): Row => ({
  slug,
  country: 'NZ',
  mode: 'train',
  name_i18n: { en: slug.toUpperCase(), th: `ไทย ${slug}` },
  from_name: 'Christchurch',
  to_name: 'Greymouth',
  line_i18n: { en: 'Over the Southern Alps' },
  duration_text: '4 h 50',
  frequency_text: 'Daily',
  fare_from: '219.00',
  currency: 'NZD',
  status: 'published',
  cover: null,
  ...over,
})

const city = (id: number, slug: string, over: Row = {}): Row => ({
  id, slug, name_i18n: { en: slug[0].toUpperCase() + slug.slice(1) }, timezone: 'Australia/Sydney', status: 'published',
  region: { country: 'AU' }, ...over,
})

describe('loadTransport', () => {
  const tables = () => ({
    cities: [city(1, 'sydney'), city(2, 'auckland', { timezone: 'Pacific/Auckland', region: { country: 'NZ' } }), city(3, 'perth', { status: 'draft' })],
    scenic_routes: [scenic('tranzalpine'), scenic('the-ghan-draft', { status: 'draft', country: 'AU' }), scenic('interislander', { mode: 'ferry', fare_from: null })],
    transit_cards: [
      {
        name: 'Opal', contactless: true, how_to_i18n: { en: 'Tap on and off' }, caps_i18n: { en: 'A$50 weekly cap' },
        official_url: 'https://transportnsw.info/tickets-opal', verified_at: '2026-10-01', city: { slug: 'sydney', name_i18n: { en: 'Sydney' } },
      },
    ],
    content_blocks: [{ key: 'transport_tips', body_i18n: { en: 'Caps apply daily.', th: 'มีเพดานค่าโดยสารรายวัน' } }],
  })

  it('leaves out a draft scenic route, and asks the database for published rows only', async () => {
    const { client, calls } = fakeClient(tables())
    const data = await loadTransport(client, 'en')
    expect(data.scenic.map((s) => s.slug)).toEqual(['interislander', 'tranzalpine'])
    expect(calls).toContainEqual({ table: 'scenic_routes', method: 'eq', args: ['status', 'published'] })
  })

  it('maps scenic routes, cards, published cities and tips in the requested locale', async () => {
    const { client } = fakeClient(tables())
    const data = await loadTransport(client, 'th')
    expect(data.cities).toEqual([
      { slug: 'sydney', name: 'Sydney', country: 'au', timezone: 'Australia/Sydney' },
      { slug: 'auckland', name: 'Auckland', country: 'nz', timezone: 'Pacific/Auckland' },
    ])
    expect(data.scenic.find((s) => s.slug === 'tranzalpine')).toMatchObject({
      name: 'ไทย tranzalpine', country: 'nz', mode: 'train', from: 'Christchurch', to: 'Greymouth',
      duration: '4 h 50', frequency: 'Daily', fareFrom: 219, currency: 'NZD', image: null,
    })
    expect(data.scenic.find((s) => s.slug === 'interislander')!.fareFrom).toBeNull()
    expect(data.cards).toEqual([
      {
        name: 'Opal', city: 'sydney', cityName: 'Sydney', contactless: true, howTo: 'Tap on and off', caps: 'A$50 weekly cap',
        officialUrl: 'https://transportnsw.info/tickets-opal', verifiedAt: '2026-10-01',
      },
    ])
    expect(data.tips).toBe('มีเพดานค่าโดยสารรายวัน')
  })

  it('gives null tips when the block is missing or empty', async () => {
    const t = tables()
    expect((await loadTransport(fakeClient({ ...t, content_blocks: [] }).client, 'en')).tips).toBeNull()
    expect((await loadTransport(fakeClient({ ...t, content_blocks: [{ key: 'transport_tips', body_i18n: {} }] }).client, 'en')).tips).toBeNull()
  })

  it('throws on a database error', async () => {
    await expect(loadTransport(fakeClient(tables(), { error: new Error('db down') }).client, 'en')).rejects.toThrow('db down')
  })
})

describe('loadCityLines', () => {
  const line = (id: number, mode: string, short: string, over: Row = {}): Row => ({
    id, city_id: 1, mode, short_name: short, long_name: `${short} line`,
    summary: { end_to_end_min: 40, headway_peak_min: 5, headway_offpeak_min: 15, fare_min: '3.20', fare_max: '5.10' },
    stops: [
      { seq: 2, stop: { name: 'Town Hall' } },
      { seq: 1, stop: { name: 'Central' } },
      { seq: 3, stop: null },
    ],
    ...over,
  })
  const tables = () => ({
    cities: [city(1, 'sydney')],
    transit_lines: [line(1, 'ferry', 'F1'), line(2, 'train', 'T8'), line(3, 'bus', '333'), line(4, 'train', 'T1'), line(5, 'train', 'T10'), line(6, 'tram', 'L2', { summary: null, stops: [] })],
  })

  it('sorts lines by mode, then short name', async () => {
    const res = await loadCityLines(fakeClient(tables()).client, 'sydney')
    expect(res!.lines.map((l) => `${l.mode}:${l.short_name}`)).toEqual(['train:T1', 'train:T8', 'train:T10', 'tram:L2', 'bus:333', 'ferry:F1'])
  })

  it('lists a line without a summary row with null figures, and orders stops by seq', async () => {
    const res = await loadCityLines(fakeClient(tables()).client, 'sydney')
    expect(res!.lines.find((l) => l.short_name === 'L2')).toEqual({
      short_name: 'L2', long_name: 'L2 line', mode: 'tram', stops: [],
      end_to_end_min: null, headway_peak_min: null, headway_offpeak_min: null, fare_min: null, fare_max: null,
    })
    expect(res!.lines[0]).toMatchObject({ stops: ['Central', 'Town Hall'], end_to_end_min: 40, fare_min: 3.2, fare_max: 5.1 })
  })

  it('filters by mode in the query', async () => {
    const { client, calls } = fakeClient(tables())
    const res = await loadCityLines(client, 'sydney', 'train')
    expect(calls).toContainEqual({ table: 'transit_lines', method: 'eq', args: ['mode', 'train'] })
    expect(res!.lines.every((l) => l.mode === 'train')).toBe(true)
  })

  it('returns null for an unknown city', async () => {
    expect(await loadCityLines(fakeClient(tables()).client, 'atlantis')).toBeNull()
  })
})

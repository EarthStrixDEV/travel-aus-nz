import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { RouteCache } from './cache'
import { floorTo15, localToUtc, parsePointParam, planRoute, type PlanDeps } from './plan'
import { RoutingUnavailable, type RoutingProvider } from './provider'
import type { RouteOption } from './types'

// ---- helpers ---------------------------------------------------------------------------

const f64 = (n: number) => {
  const b = Buffer.alloc(8)
  b.writeDoubleLE(n)
  return b.toString('hex')
}
/** Hex EWKB, SRID 4326, as PostgREST returns `geography` columns. */
const ewkbPoint = (lng: number, lat: number) => '0101000020E6100000' + f64(lng) + f64(lat)
const ewkbBox = (minLng: number, minLat: number, maxLng: number, maxLat: number) => {
  const ring = [
    [minLng, minLat],
    [maxLng, minLat],
    [maxLng, maxLat],
    [minLng, maxLat],
    [minLng, minLat],
  ]
  const u32 = (n: number) => {
    const b = Buffer.alloc(4)
    b.writeUInt32LE(n)
    return b.toString('hex')
  }
  return '0103000020E6100000' + u32(1) + u32(ring.length) + ring.map(([x, y]) => f64(x) + f64(y)).join('')
}

type Row = Record<string, unknown>

/** Minimal PostgREST stand-in: `eq` filters rows; awaiting gives all rows, `maybeSingle` the first. */
function fakeDb(tables: Record<string, Row[]>) {
  const calls: string[] = []
  const db = {
    from(table: string) {
      calls.push(table)
      let rows = tables[table] ?? []
      const builder = {
        select: () => builder,
        eq: (col: string, v: unknown) => {
          rows = rows.filter((r) => r[col] === v)
          return builder
        },
        maybeSingle: async () => ({ data: rows[0] ?? null, error: null }),
        then: (ok: (v: unknown) => unknown, fail?: (e: unknown) => unknown) =>
          Promise.resolve({ data: rows, error: null }).then(ok, fail),
      }
      return builder
    },
  }
  return { db: db as unknown as PlanDeps['db'], calls }
}

function memoryCache(): RouteCache & { store: Map<string, RouteOption[]> } {
  const store = new Map<string, RouteOption[]>()
  return {
    store,
    get: async (k) => structuredClone(store.get(k) ?? null),
    set: async (k, v) => void store.set(k, structuredClone(v)),
  }
}

// Fixture options as the Google provider maps them (fares/card empty).
const FIXTURE_OPTIONS: RouteOption[] = (() => {
  const leg = (mode: RouteOption['legs'][number]['mode'], from: string, to: string, agency?: string, board?: [number, number], alight?: [number, number]) => ({
    mode,
    from,
    to,
    depart: '2026-11-01T22:00:00.000Z',
    arrive: '2026-11-01T22:10:00.000Z',
    duration_min: 10,
    detail: '',
    distance_m: 5000,
    ...(agency ? { agency } : {}),
    ...(board ? { board: { lat: board[0], lng: board[1] } } : {}),
    ...(alight ? { alight: { lat: alight[0], lng: alight[1] } } : {}),
  })
  const base = { duration_min: 34, fare_min: null, fare_max: null, currency: 'AUD' as const, card: null }
  return [
    {
      ...base,
      depart: '2026-11-01T22:01:00.000Z',
      arrive: '2026-11-01T22:35:00.000Z',
      summary: 'T4 → 333',
      legs: [
        leg('walk', '', 'Central Station'),
        leg('train', 'Central Station', 'Bondi Junction Station', 'Sydney Trains', [-33.88306, 151.20629], [-33.89148, 151.24778]),
        leg('bus', 'Bondi Junction Interchange', 'Bondi Beach', 'Transdev John Holland', [-33.89121, 151.24811], [-33.89065, 151.27474]),
        leg('walk', 'Bondi Beach', ''),
      ],
    },
    {
      ...base,
      depart: '2026-11-01T21:59:00.000Z',
      arrive: '2026-11-01T22:42:00.000Z',
      summary: '333',
      legs: [
        leg('walk', '', 'Central Station, Eddy Av'),
        leg('bus', 'Central Station, Eddy Av', 'Bondi Beach', 'Transdev John Holland', [-33.88302, 151.20743], [-33.89065, 151.27474]),
        leg('walk', 'Bondi Beach', ''),
      ],
    },
  ]
})()

const tables = (): Record<string, Row[]> => ({
  places: [
    { slug: 'central-station', status: 'published', name_i18n: { en: 'Central Station', th: 'สถานีเซ็นทรัล' }, geom: ewkbPoint(151.2065, -33.8832), city: { timezone: 'Australia/Sydney' } },
    { slug: 'bondi-beach', status: 'published', name_i18n: { en: 'Bondi Beach' }, geom: ewkbPoint(151.2767, -33.8915), city: { timezone: 'Australia/Sydney' } },
    { slug: 'secret-draft', status: 'draft', name_i18n: { en: 'Draft' }, geom: ewkbPoint(151.2, -33.8), city: { timezone: 'Australia/Sydney' } },
  ],
  cities: [
    { status: 'published', timezone: 'Australia/Sydney', bbox: ewkbBox(150.5, -34.2, 151.4, -33.5) },
    { status: 'published', timezone: 'Pacific/Auckland', bbox: ewkbBox(174.4, -37.1, 175.1, -36.6) },
  ],
  transit_agencies: [
    { id: 1, name: 'Sydney Trains', country: 'AU', card_id: 10 },
    { id: 2, name: 'Transdev John Holland', country: 'AU', card_id: 10 },
  ],
  transit_cards: [{ id: 10, name: 'Opal', contactless: true }],
  fare_rules: [
    { agency_id: 1, mode: null, rule: { kind: 'distance', bands: [{ upto_km: 10, peak: 4.2, offpeak: 2.94 }] } },
    { agency_id: 2, mode: null, rule: { kind: 'flat', peak: 3.2, offpeak: 2.24 } },
  ],
  transit_stops: [
    { step_free: true, geom: ewkbPoint(151.2063, -33.8831) }, // ~5 m from the T4 board point
    { step_free: true, geom: ewkbPoint(151.2478, -33.8915) },
    { step_free: true, geom: ewkbPoint(151.2481, -33.8912) },
    { step_free: true, geom: ewkbPoint(151.2747, -33.8907) },
    { step_free: null, geom: ewkbPoint(151.20743, -33.88302) }, // Eddy Av: unknown
  ],
  journeys: [
    { slug: 'other', status: 'published', from_name: 'Sydney', to_name: 'Melbourne', title_i18n: { en: 'Other' }, line_i18n: null, country: 'AU', days: 1, price_from: null, currency: null, modes: ['train'], cover: null },
    { slug: 'central-to-bondi-draft', status: 'draft', from_name: 'Central Station', to_name: 'Bondi Beach', title_i18n: { en: 'Draft' }, line_i18n: null, country: 'AU', days: 1, price_from: null, currency: null, modes: ['bus'], cover: null },
    { slug: 'central-to-bondi', status: 'published', from_name: 'central station', to_name: 'BONDI BEACH', title_i18n: { en: 'Central to Bondi by bus' }, line_i18n: null, country: 'AU', days: 1, price_from: 3.2, currency: 'AUD', modes: ['bus'], cover: null },
  ],
})

let provider: RoutingProvider & { plan: ReturnType<typeof vi.fn> }
let cache: ReturnType<typeof memoryCache>
let deps: PlanDeps

beforeEach(() => {
  provider = { name: 'fake', plan: vi.fn(async () => structuredClone(FIXTURE_OPTIONS)) }
  cache = memoryCache()
  deps = { provider, db: fakeDb(tables()).db, cache, now: () => new Date('2026-10-27T00:00:00Z') }
})

const base = { from: 'central-station', to: 'bondi-beach', depart: '2026-11-02T09:00', locale: 'en' as const }

// ---- tests -----------------------------------------------------------------------------

describe('planRoute', () => {
  it('resolves slugs, converts depart with the from-city timezone and adds fares/cards', async () => {
    const result = await planRoute(base, deps)
    expect(provider.plan).toHaveBeenCalledWith({
      from: { lat: -33.8832, lng: 151.2065 },
      to: { lat: -33.8915, lng: 151.2767 },
      departUtc: new Date('2026-11-01T22:00:00Z'),
    })
    if (!('options' in result)) throw new Error('expected options')
    expect(result.options).toHaveLength(2)
    expect(result.options[0]).toMatchObject({ fare_min: 5.18, fare_max: 7.4, card: 'Opal or contactless', currency: 'AUD' })
    // Origin/destination labels filled from the resolved places.
    expect(result.options[0].legs[0].from).toBe('Central Station')
    expect(result.options[0].legs[3].to).toBe('Bondi Beach')
  })

  it('same from/to/depart within one 15-minute bucket -> one upstream call (Review Focus 2)', async () => {
    await planRoute(base, deps)
    await planRoute({ ...base, depart: '2026-11-02T09:10' }, deps)
    await planRoute({ ...base, modes: ['bus'], stepFree: true }, deps)
    expect(provider.plan).toHaveBeenCalledTimes(1)
    expect([...cache.store.keys()]).toEqual([expect.stringMatching(/^route:[0-9a-f]{64}$/)])
  })

  it('a different bucket is a new upstream call', async () => {
    await planRoute(base, deps)
    await planRoute({ ...base, depart: '2026-11-02T09:15' }, deps)
    expect(provider.plan).toHaveBeenCalledTimes(2)
  })

  it('modes=train drops options containing a bus leg', async () => {
    const result = await planRoute({ ...base, modes: ['train'] }, deps)
    expect(result).toEqual({ options: [] })
  })

  it('modes=bus keeps only the bus-only option', async () => {
    const result = await planRoute({ ...base, modes: ['bus'] }, deps)
    if (!('options' in result)) throw new Error('expected options')
    expect(result.options.map((o) => o.summary)).toEqual(['333'])
  })

  it('step_free drops an option whose board stop has step_free = null', async () => {
    const result = await planRoute({ ...base, stepFree: true }, deps)
    if (!('options' in result)) throw new Error('expected options')
    expect(result.options.map((o) => o.summary)).toEqual(['T4 → 333'])
  })

  it('provider unavailable -> ROUTING_UNAVAILABLE with the matching published journey (Review Focus 1)', async () => {
    provider.plan.mockRejectedValue(new RoutingUnavailable('timeout'))
    const result = await planRoute(base, deps)
    expect(result).toMatchObject({ error: 'ROUTING_UNAVAILABLE', fallback: { slug: 'central-to-bondi', title: 'Central to Bondi by bus' } })
    expect(cache.store.size).toBe(0)
  })

  it('provider unavailable and no matching journey -> fallback null', async () => {
    provider.plan.mockRejectedValue(new RoutingUnavailable('down'))
    const result = await planRoute({ ...base, from: '-33.8688,151.2093' }, deps)
    expect(result).toEqual({ error: 'ROUTING_UNAVAILABLE', message: expect.any(String), fallback: null })
  })

  it('lat,lng input uses the timezone of the city whose bbox contains it', async () => {
    await planRoute({ from: '-36.8485,174.7633', to: '-36.8442,174.7676', depart: '2026-11-02T09:00' }, deps)
    expect(provider.plan.mock.calls[0][0].departUtc).toEqual(new Date('2026-11-01T20:00:00Z'))
  })

  it('lat,lng outside every city bbox falls back to Australia/Sydney', async () => {
    await planRoute({ from: '-31.95,115.86', to: '-31.96,115.85', depart: '2026-11-02T09:00' }, deps)
    expect(provider.plan.mock.calls[0][0].departUtc).toEqual(new Date('2026-11-01T22:00:00Z'))
  })

  it('unknown or unpublished place slug -> NOT_FOUND, no upstream call', async () => {
    expect(await planRoute({ ...base, to: 'nowhere' }, deps)).toMatchObject({ error: 'NOT_FOUND' })
    expect(await planRoute({ ...base, to: 'secret-draft' }, deps)).toMatchObject({ error: 'NOT_FOUND' })
    expect(provider.plan).not.toHaveBeenCalled()
  })

  it('a departure already in the past is sent upstream as now', async () => {
    deps.now = () => new Date('2026-11-01T22:07:00Z')
    await planRoute({ ...base, depart: '2026-11-02T09:05' }, deps)
    expect(provider.plan.mock.calls[0][0].departUtc).toEqual(new Date('2026-11-01T22:07:00Z'))
  })
})

describe('time helpers', () => {
  it('localToUtc handles standard and daylight time', () => {
    expect(localToUtc('2026-07-01T09:00', 'Australia/Sydney')).toEqual(new Date('2026-06-30T23:00:00Z'))
    expect(localToUtc('2026-11-02T09:00', 'Australia/Sydney')).toEqual(new Date('2026-11-01T22:00:00Z'))
    expect(localToUtc('2026-11-02T09:00', 'Pacific/Auckland')).toEqual(new Date('2026-11-01T20:00:00Z'))
    expect(localToUtc('2026-11-02T09:00', 'Australia/Perth')).toEqual(new Date('2026-11-02T01:00:00Z'))
  })

  it('floorTo15 buckets to the quarter hour', () => {
    expect(floorTo15(new Date('2026-11-01T22:14:59Z'))).toEqual(new Date('2026-11-01T22:00:00Z'))
    expect(floorTo15(new Date('2026-11-01T22:15:00Z'))).toEqual(new Date('2026-11-01T22:15:00Z'))
  })
})

describe('parsePointParam', () => {
  it.each([
    ['-33.8688,151.2093', { lat: -33.8688, lng: 151.2093 }],
    ['-36.8485, 174.7633', { lat: -36.8485, lng: 174.7633 }],
    ['51.5,-0.12', null], // London
    ['-33.8,abc', null],
    ['central-station', null],
  ])('%s', (s, expected) => {
    expect(parsePointParam(s)).toEqual(expected)
  })
})

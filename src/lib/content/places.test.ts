import { describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/supabase/public', () => ({ createPublicClient: () => ({}) }))
vi.mock('@/lib/content/cache', () => ({ cachedContent: (_k: string[], _t: string, fn: () => unknown) => fn }))

import { DEMO_MAP_STYLE, loadPlace, normaliseMapPlaces, parseBbox, resolveMapStyle } from './places'

const STOP_HEX = '0101000020E61000007AA52C431CE76240C7BAB88D06F040C0'
const PLACE_HEX = '0101000020E6100000B1E1E995B2E66240E561A1D634EF40C0'

describe('parseBbox', () => {
  it('parses a valid Sydney bbox', () => {
    expect(parseBbox('150.9,-34.0,151.4,-33.7')).toEqual([150.9, -34, 151.4, -33.7])
  })

  it.each([
    ['151,-34,150,-33', 'min >= max'],
    ['150,-33,151,-33', 'zero-height'],
    ['a,b,c,d', 'non-numeric'],
    ['100,-50,160,-10', 'span 60'],
    ['150,-34,151', 'three parts'],
    ['150,-34,151,-33,1', 'five parts'],
    [',-34,151,-33', 'empty part'],
    ['-181,-34,-170,-33', 'lng out of range'],
    ['150,-91,151,-80', 'lat out of range'],
    ['', 'empty'],
  ])('%s -> null (%s)', (s) => {
    expect(parseBbox(s)).toBeNull()
  })
})

describe('resolveMapStyle', () => {
  it('uses the configured style URL', () => {
    expect(resolveMapStyle('https://api.maptiler.com/maps/x/style.json?key=k', 'production')).toBe(
      'https://api.maptiler.com/maps/x/style.json?key=k',
    )
  })
  it('falls back to the MapLibre demo style outside production', () => {
    expect(resolveMapStyle(undefined, 'development')).toBe(DEMO_MAP_STYLE)
    expect(resolveMapStyle('', 'test')).toBe(DEMO_MAP_STYLE)
  })
  it('is null in production when unset (list view only)', () => {
    expect(resolveMapStyle(undefined, 'production')).toBeNull()
  })
})

describe('normaliseMapPlaces', () => {
  it('localises cluster and feature names', () => {
    expect(
      normaliseMapPlaces(
        {
          clusters: [
            { neighbourhood_id: 3, neighbourhood: 'Surry Hills', city: 'sydney', city_name: { en: 'Sydney', th: 'ซิดนีย์' }, lng: 151.2, lat: -33.8, count: 2 },
            { neighbourhood_id: null, neighbourhood: null, city: 'sydney', city_name: { en: 'Sydney', th: 'ซิดนีย์' }, lng: 151.1, lat: -33.9, count: 1 },
          ],
          counts: { bar: 3 },
        },
        'th',
      ),
    ).toEqual({
      level: 'clusters',
      clusters: [
        { neighbourhoodId: 3, name: 'Surry Hills', city: 'sydney', cityName: 'ซิดนีย์', lng: 151.2, lat: -33.8, count: 2 },
        { neighbourhoodId: null, name: 'ซิดนีย์', city: 'sydney', cityName: 'ซิดนีย์', lng: 151.1, lat: -33.9, count: 1 },
      ],
      counts: { bar: 3 },
    })

    const places = normaliseMapPlaces(
      {
        features: {
          type: 'FeatureCollection',
          features: [{ type: 'Feature', geometry: { type: 'Point', coordinates: [151.2, -33.8] }, properties: { slug: 'low-tide', type: 'bar', name_i18n: { en: 'Low Tide' } } }],
        },
        counts: { bar: 1 },
      },
      'th',
    )
    expect(places).toEqual({
      level: 'places',
      features: {
        type: 'FeatureCollection',
        features: [{ type: 'Feature', geometry: { type: 'Point', coordinates: [151.2, -33.8] }, properties: { slug: 'low-tide', type: 'bar', name: 'Low Tide' } }],
      },
      counts: { bar: 1 },
    })
  })
})

describe('loadPlace', () => {
  function client(row: unknown) {
    const q = {
      select: () => q,
      eq: () => q,
      maybeSingle: () => Promise.resolve({ data: row, error: null }),
    }
    return { from: () => q } as never
  }

  it('maps detail, sorts stops by rank and keeps at most 3', async () => {
    const stop = (rank: number, name: string) => ({ rank, walk_min: rank * 2, walk_geom: null, stop: { name, geom: STOP_HEX } })
    const detail = await loadPlace(
      client({
        id: 'p1', slug: 'low-tide', type: 'bar', geom: PLACE_HEX,
        name_i18n: { en: 'Low Tide' }, area_i18n: { en: 'Potts Point' }, desc_i18n: { en: 'Wine.' },
        price_level: 2, price_note_i18n: { en: 'Glass A$15–22' }, hours_note_i18n: null, website: null,
        city: { slug: 'sydney', name_i18n: { en: 'Sydney' }, timezone: 'Australia/Sydney', region: { country: 'AU' } },
        tags: [{ tag: { slug: 'wine', name_i18n: { en: 'Wine bar' } } }],
        hours: [{ weekday: 2, open_time: '15:00:00', close_time: '23:00:00' }, { weekday: 1, open_time: '15:00:00', close_time: '23:00:00' }],
        stops: [stop(4, 'D'), stop(2, 'B'), stop(1, 'A'), stop(3, 'C')],
      }),
      'low-tide',
      'en',
    )
    expect(detail).toMatchObject({
      id: 'p1', slug: 'low-tide', type: 'bar', name: 'Low Tide', area: 'Potts Point', description: 'Wine.',
      city: { slug: 'sydney', name: 'Sydney', timezone: 'Australia/Sydney' }, country: 'au',
      tags: ['Wine bar'], priceLevel: 2, priceNote: 'Glass A$15–22', hoursNote: '',
      hours: [{ weekday: 1, open: '15:00', close: '23:00' }, { weekday: 2, open: '15:00', close: '23:00' }],
    })
    expect(detail!.lng).toBeCloseTo(151.2093, 4)
    expect(detail!.stops.map((s) => [s.name, s.walkMin, s.walk])).toEqual([['A', 2, null], ['B', 4, null], ['C', 6, null]])
    expect(detail!.stops[0].lng).toBeCloseTo(151.2222, 4)
  })

  it('returns null when the place is not found', async () => {
    expect(await loadPlace(client(null), 'nope', 'en')).toBeNull()
  })
})

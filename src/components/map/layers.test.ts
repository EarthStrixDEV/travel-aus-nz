import { describe, expect, it, vi } from 'vitest'
import { parseBbox } from '@/lib/content/places'
import { ALL_LAYERS, apiBbox, layerCount, layerOf, matchesQuery, typesFor } from './layers'

vi.mock('@/lib/supabase/public', () => ({ createPublicClient: () => ({}) }))
vi.mock('@/lib/content/cache', () => ({ cachedContent: (_k: string[], _t: string, fn: () => unknown) => fn }))

describe('layers', () => {
  it('maps place types to layers', () => {
    expect(layerOf('cafe')).toBe('restaurant')
    expect(layerOf('station')).toBe('transport')
    expect(layerOf('village')).toBe('attraction')
  })

  it('all layers on -> no type filter; otherwise the on layers only', () => {
    expect(typesFor(ALL_LAYERS)).toEqual([])
    expect(typesFor({ ...ALL_LAYERS, restaurant: false, transport: false })).toEqual(['attraction', 'village', 'bar'])
  })

  it('sums counts per layer', () => {
    expect(layerCount({ restaurant: 3, cafe: 2, bar: 1 }, 'restaurant')).toBe(5)
    expect(layerCount({}, 'bar')).toBe(0)
  })

  it('search folds case and accents', () => {
    expect(matchesQuery('Kōkako Kitchen', 'kokako')).toBe(true)
    expect(matchesQuery('Low Tide', '  ')).toBe(true)
    expect(matchesQuery('Low Tide', 'archive')).toBe(false)
  })
})

describe('apiBbox', () => {
  it('rounds outward to 3 decimals', () => {
    expect(apiBbox([151.20049, -33.87051, 151.21001, -33.86001])).toEqual([151.2, -33.871, 151.211, -33.86])
  })

  it('keeps any viewport acceptable to parseBbox (whole-world and wide-Australia views)', () => {
    for (const b of [[-540, -120, 540, 120], [110, -45, 156, -9], [112.9, -43.7, 153.7, -10.6]] as const) {
      const out = apiBbox([...b])
      expect(parseBbox(out.join(','))).toEqual(out)
    }
  })
})

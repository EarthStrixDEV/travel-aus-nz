import { describe, expect, it } from 'vitest'
import { parsePoint } from './geo'

describe('parsePoint', () => {
  it('reads hex EWKB as PostgREST returns it (live Sydney value)', () => {
    const p = parsePoint('0101000020E6100000B1E1E995B2E66240E561A1D634EF40C0')
    expect(p?.lng).toBeCloseTo(151.2093, 3)
    expect(p?.lat).toBeCloseTo(-33.8688, 3)
  })
  it('reads GeoJSON points', () => {
    expect(parsePoint({ type: 'Point', coordinates: [174.76, -36.85] })).toEqual({ lng: 174.76, lat: -36.85 })
  })
  it('returns null for anything else', () => {
    expect(parsePoint(null)).toBeNull()
    expect(parsePoint('nonsense')).toBeNull()
    expect(parsePoint({ type: 'Point', coordinates: ['x'] })).toBeNull()
  })
})

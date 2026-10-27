import { describe, expect, it } from 'vitest'
import { isOffMap, transitMinutes, type TripLeg, type TripPlace } from './model'

const SYDNEY: [number, number, number, number] = [150.9, -34.1, 151.4, -33.7]

const place = (lng: number | null, lat: number | null, bbox = SYDNEY): TripPlace => ({
  id: 'p',
  slug: 'p',
  type: 'attraction',
  name: 'P',
  area: '',
  lng,
  lat,
  citySlug: 'sydney',
  cityBbox: bbox,
})

const leg = (status: TripLeg['status'], durationMin: number): TripLeg => ({ mode: 'train', durationMin, summary: null, fareMin: null, fareMax: null, status })

describe('isOffMap', () => {
  it('a Blue Mountains stop on a Sydney day is off the city map', () => {
    expect(isOffMap([{ place: place(151.21, -33.86) }, { place: place(150.31, -33.71) }])).toBe(true)
  })
  it('every stop inside the first stop\'s city bbox stays on the map', () => {
    expect(isOffMap([{ place: place(151.21, -33.86) }, { place: place(151.27, -33.89) }])).toBe(false)
  })
  it('no stops, or no city bbox, is on-map; a stop with no position is off-map', () => {
    expect(isOffMap([])).toBe(false)
    expect(isOffMap([{ place: { ...place(150.3, -33.7), cityBbox: null } }])).toBe(false)
    expect(isOffMap([{ place: place(151.21, -33.86) }, { place: place(null, null) }])).toBe(true)
  })
})

describe('transitMinutes', () => {
  it('sums computed legs only', () => {
    expect(transitMinutes([{ legToNext: leg('ok', 12) }, { legToNext: leg('stale', 30) }, { legToNext: leg('ok', 20) }, { legToNext: null }])).toBe(32)
  })
})

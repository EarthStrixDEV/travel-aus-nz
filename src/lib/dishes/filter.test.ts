import { describe, expect, it } from 'vitest'
import {
  dishFilterToParams,
  filterDishes,
  hasActiveFilters,
  parseDishFilter,
  pickVenueRegion,
  type DishCard,
  type RegionVenues,
} from './filter'

const dish = (slug: string, over: Partial<DishCard> = {}): DishCard => ({
  id: slug,
  slug,
  name: slug,
  line: '',
  country: 'au',
  region: { slug: 'sydney', name: 'Sydney' },
  type: 'savoury',
  dietary: [],
  priceLevel: 2,
  priceText: null,
  mustTryRank: null,
  image: null,
  ...over,
})

const dishes = [
  dish('rock-oysters', { type: 'savoury', dietary: ['gluten_free', 'no_pork', 'halal'], priceLevel: 3 }),
  dish('pavlova', { type: 'sweet', dietary: ['vegetarian', 'gluten_free', 'no_pork'], priceLevel: 2 }),
  dish('vegan-salad', { type: 'savoury', dietary: ['vegan', 'vegetarian', 'gluten_free'], priceLevel: 1, region: { slug: 'melbourne', name: 'Melbourne' } }),
  dish('hangi', { country: 'nz', region: { slug: 'rotorua', name: 'Rotorua' }, dietary: ['gluten_free'], priceLevel: 2 }),
  dish('no-price', { priceLevel: null }),
]

describe('filterDishes', () => {
  it('diet filters are AND: vegan + gluten_free keeps only dishes with both', () => {
    const { items } = filterDishes(dishes, { diet: ['vegan', 'gluten_free'] })
    expect(items.map((d) => d.slug)).toEqual(['vegan-salad'])
  })

  it('combines country, region, type and price (at or below)', () => {
    expect(filterDishes(dishes, { country: 'nz', diet: [] }).items.map((d) => d.slug)).toEqual(['hangi'])
    expect(filterDishes(dishes, { region: 'melbourne', diet: [] }).items.map((d) => d.slug)).toEqual(['vegan-salad'])
    expect(filterDishes(dishes, { type: 'sweet', diet: [] }).items.map((d) => d.slug)).toEqual(['pavlova'])
    expect(filterDishes(dishes, { priceMax: 2, diet: [] }).items.map((d) => d.slug)).toEqual(['pavlova', 'vegan-salad', 'hangi'])
  })

  it('facet counts ignore their own facet but apply the others, and the result count matches the list', () => {
    const { items, facets, count } = filterDishes(dishes, { country: 'au', type: 'savoury', diet: [] })
    expect(count).toBe(items.length)
    expect(facets.type).toMatchObject({ savoury: 3, sweet: 1 })
    expect(facets.country).toMatchObject({ au: 3, nz: 1 })
    expect(facets.diet.gluten_free).toBe(2)
  })
})

describe('URL query <-> filter', () => {
  it('round-trips and drops unknown values', () => {
    const f = parseDishFilter(new URLSearchParams('country=nz&region=rotorua&type=sweet&price_max=3&diet=vegan&diet=halal&diet=Bad!'))
    expect(f).toEqual({ country: 'nz', region: 'rotorua', type: 'sweet', priceMax: 3, diet: ['vegan', 'halal'] })
    expect(parseDishFilter(dishFilterToParams(f))).toEqual(f)
    expect(parseDishFilter(new URLSearchParams('country=fr&type=pizza&price_max=9'))).toEqual({ diet: [] })
  })

  it('knows when any filter is set', () => {
    expect(hasActiveFilters({ diet: [] })).toBe(false)
    expect(hasActiveFilters({ diet: ['vegan'] })).toBe(true)
  })
})

describe('pickVenueRegion', () => {
  const group = (slug: string, n: number): RegionVenues => ({
    region: { slug, name: slug },
    venues: Array.from({ length: n }, (_, i) => ({ slug: `${slug}-${i}`, name: `${slug} ${i}`, area: '', priceText: null, note: '', stop: null })),
  })
  const groups = [group('sydney', 3), group('melbourne', 1), group('tasmania', 0)]

  it('uses the requested region when it has venues', () => {
    expect(pickVenueRegion(groups, 'melbourne', 'sydney')?.region.slug).toBe('melbourne')
  })
  it('falls back to the dish home region, then to the region with the most venues', () => {
    expect(pickVenueRegion(groups, 'tasmania', 'melbourne')?.region.slug).toBe('melbourne')
    expect(pickVenueRegion(groups, 'tasmania', 'tasmania')?.region.slug).toBe('sydney')
    expect(pickVenueRegion(groups, undefined, null)?.region.slug).toBe('sydney')
  })
  it('is null when no region has venues', () => {
    expect(pickVenueRegion([group('x', 0)], 'x', 'x')).toBeNull()
  })
})

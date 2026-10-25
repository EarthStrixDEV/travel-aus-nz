import { describe, expect, it } from 'vitest'
import {
  countByKind,
  filterVenues,
  hasActiveFilters,
  parseVenueFilter,
  venueFilterToParams,
  type VenueCard,
  type VenueFilter,
} from './filter'

let n = 0
function venue(over: Partial<VenueCard> & { cuisineSlug?: string | null; tagSlugs?: string[] } = {}): VenueCard {
  const { cuisineSlug = null, tagSlugs = [], ...rest } = over
  n += 1
  return {
    id: `id-${n}`,
    slug: `venue-${n}`,
    kind: 'restaurant',
    name: `Venue ${n}`,
    city: { slug: 'sydney', name: 'Sydney' },
    hood: 'CBD',
    cuisine: cuisineSlug ? { slug: cuisineSlug, name: cuisineSlug } : null,
    priceLevel: 2,
    dietary: [],
    drinks: [],
    tags: tagSlugs.map((slug) => ({ slug, name: slug })),
    description: '',
    menuHighlights: '',
    signatureDrinks: '',
    hours: [],
    hoursNote: '',
    stop: null,
    ...rest,
  }
}

const base: VenueFilter = { kind: 'restaurant', diet: [] }
const slugs = (items: VenueCard[]) => items.map((v) => v.slug).sort()

describe('filterVenues', () => {
  it('diet is AND: [vegan, gluten_free] keeps only venues with both', () => {
    const both = venue({ slug: 'both', dietary: ['vegan', 'gluten_free', 'vegetarian'] })
    const veganOnly = venue({ slug: 'vegan-only', dietary: ['vegan'] })
    const gfOnly = venue({ slug: 'gf-only', dietary: ['gluten_free'] })
    const none = venue({ slug: 'none' })
    const { items } = filterVenues([both, veganOnly, gfOnly, none], { ...base, diet: ['vegan', 'gluten_free'] })
    expect(items.map((v) => v.slug)).toEqual(['both'])
  })

  it('priceMax: 2 drops price 3 and 4 (and unpriced venues), keeps free and 1-2', () => {
    const list = [
      venue({ slug: 'free', priceLevel: 0 }),
      venue({ slug: 'p1', priceLevel: 1 }),
      venue({ slug: 'p2', priceLevel: 2 }),
      venue({ slug: 'p3', priceLevel: 3 }),
      venue({ slug: 'p4', priceLevel: 4 }),
      venue({ slug: 'unknown', priceLevel: null }),
    ]
    const { items } = filterVenues(list, { ...base, priceMax: 2 })
    expect(slugs(items)).toEqual(['free', 'p1', 'p2'])
  })

  it('only returns the selected kind', () => {
    const list = [venue({ slug: 'r' }), venue({ slug: 'b', kind: 'bar' })]
    expect(filterVenues(list, { ...base, kind: 'bar' }).items.map((v) => v.slug)).toEqual(['b'])
  })

  it('city, drink, mood and cuisine are exact matches', () => {
    const list = [
      venue({ slug: 'a', drinks: ['wine'], tagSlugs: ['rooftop'], cuisineSlug: 'seafood' }),
      venue({ slug: 'b', drinks: ['wine', 'beer'], tagSlugs: ['rooftop', 'waterfront'], cuisineSlug: 'italian', city: { slug: 'melbourne', name: 'Melbourne' } }),
      venue({ slug: 'c', drinks: ['beer'], tagSlugs: ['waterfront'], cuisineSlug: 'seafood' }),
    ]
    expect(slugs(filterVenues(list, { ...base, drink: 'wine' }).items)).toEqual(['a', 'b'])
    expect(slugs(filterVenues(list, { ...base, mood: 'waterfront' }).items)).toEqual(['b', 'c'])
    expect(slugs(filterVenues(list, { ...base, cuisine: 'seafood' }).items)).toEqual(['a', 'c'])
    expect(slugs(filterVenues(list, { ...base, city: 'melbourne' }).items)).toEqual(['b'])
    expect(slugs(filterVenues(list, { ...base, drink: 'wine', mood: 'rooftop', cuisine: 'seafood' }).items)).toEqual(['a'])
  })

  describe('facets', () => {
    const list = [
      venue({ slug: 'sea-syd', cuisineSlug: 'seafood' }),
      venue({ slug: 'sea-mel', cuisineSlug: 'seafood', city: { slug: 'melbourne', name: 'Melbourne' } }),
      venue({ slug: 'ita-syd', cuisineSlug: 'italian' }),
      venue({ slug: 'ita-mel', cuisineSlug: 'italian', city: { slug: 'melbourne', name: 'Melbourne' } }),
      venue({ slug: 'bar-1', kind: 'bar', cuisineSlug: 'wine' }),
    ]

    it('cuisine counts ignore the current cuisine selection', () => {
      const { items, facets } = filterVenues(list, { ...base, cuisine: 'seafood' })
      expect(items).toHaveLength(2)
      expect(facets.cuisine).toEqual({ seafood: 2, italian: 2 })
    })

    it('cuisine counts still honour the other filters', () => {
      const { facets } = filterVenues(list, { ...base, cuisine: 'seafood', city: 'melbourne' })
      expect(facets.cuisine).toEqual({ seafood: 1, italian: 1 })
      // ...while the city facet ignores the city selection but honours the cuisine one.
      expect(facets.city).toEqual({ sydney: 1, melbourne: 1 })
    })

    it('is scoped to the selected kind', () => {
      const { facets } = filterVenues(list, { ...base, kind: 'bar' })
      expect(facets.cuisine).toEqual({ wine: 1 })
      expect(facets.city).toEqual({ sydney: 1 })
    })

    it('keeps zero-count values so chips stay visible', () => {
      const { facets } = filterVenues(list, { ...base, city: 'melbourne', cuisine: 'italian' })
      expect(facets.cuisine).toEqual({ seafood: 1, italian: 1 })
      const none = filterVenues(list, { ...base, city: 'sydney' }).facets.city
      expect(none).toEqual({ sydney: 2, melbourne: 2 })
    })

    it('diet facet ignores the diet selection; each value is counted separately', () => {
      const dl = [
        venue({ dietary: ['vegan', 'vegetarian'] }),
        venue({ dietary: ['vegetarian'] }),
        venue({ dietary: ['gluten_free'] }),
      ]
      const { items, facets } = filterVenues(dl, { ...base, diet: ['vegan'] })
      expect(items).toHaveLength(1)
      expect(facets.diet).toEqual({ vegan: 1, vegetarian: 2, gluten_free: 1 })
    })

    it('price facet is cumulative and ignores the price selection', () => {
      const pl = [venue({ priceLevel: 0 }), venue({ priceLevel: 1 }), venue({ priceLevel: 3 }), venue({ priceLevel: null })]
      const { facets } = filterVenues(pl, { ...base, priceMax: 1 })
      expect(facets.price).toEqual({ '1': 2, '2': 2, '3': 3, '4': 3 })
    })

    it('drink and mood facets count multi-valued venues once per value', () => {
      const dl = [
        venue({ drinks: ['wine', 'beer'], tagSlugs: ['rooftop'] }),
        venue({ drinks: ['wine'], tagSlugs: ['rooftop', 'hidden'] }),
      ]
      const { facets } = filterVenues(dl, base)
      expect(facets.drink).toEqual({ wine: 2, beer: 1 })
      expect(facets.mood).toEqual({ rooftop: 2, hidden: 1 })
    })
  })
})

describe('countByKind', () => {
  it('counts each kind under the other filters, ignoring the tab', () => {
    const list = [
      venue({ dietary: ['vegan'] }),
      venue({ dietary: [] }),
      venue({ kind: 'bar', dietary: ['vegan'] }),
      venue({ kind: 'bar', dietary: ['vegan'], priceLevel: 4 }),
    ]
    expect(countByKind(list, base)).toEqual({ restaurant: 2, bar: 2 })
    expect(countByKind(list, { ...base, diet: ['vegan'], priceMax: 3 })).toEqual({ restaurant: 1, bar: 1 })
  })
})

describe('URL query', () => {
  it('round-trips a full filter', () => {
    const f: VenueFilter = { kind: 'bar', city: 'sydney', priceMax: 3, drink: 'wine', mood: 'rooftop', diet: ['vegan', 'gluten_free'], cuisine: 'seafood' }
    const qs = venueFilterToParams(f).toString()
    expect(parseVenueFilter(new URLSearchParams(qs))).toEqual(f)
  })

  it('defaults serialise to an empty query', () => {
    expect(venueFilterToParams({ kind: 'restaurant', diet: [] }).toString()).toBe('')
    expect(parseVenueFilter(new URLSearchParams(''))).toEqual({
      kind: 'restaurant', city: undefined, priceMax: undefined, drink: undefined, mood: undefined, diet: [], cuisine: undefined,
    })
  })

  it('drops malformed values and folds diet forms', () => {
    const f = parseVenueFilter(new URLSearchParams('kind=pub&price_max=9&city=Sydney!&diet[]=vegan&diet=vegan,gluten_free&diet=%3Cb%3E'))
    expect(f.kind).toBe('restaurant')
    expect(f.priceMax).toBeUndefined()
    expect(f.city).toBeUndefined()
    expect(f.diet).toEqual(['vegan', 'gluten_free'])
  })

  it('hasActiveFilters ignores the tab', () => {
    expect(hasActiveFilters({ kind: 'bar', diet: [] })).toBe(false)
    expect(hasActiveFilters({ kind: 'bar', diet: ['vegan'] })).toBe(true)
    expect(hasActiveFilters({ kind: 'restaurant', diet: [], priceMax: 1 })).toBe(true)
  })
})

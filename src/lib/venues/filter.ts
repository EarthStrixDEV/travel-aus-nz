import type { PlaceHours } from '@/lib/content/places'

/** Pure venue model + filter logic: shared by the page (client), the API and tests. No server imports at runtime. */

export type VenueKind = 'restaurant' | 'bar'
export const VENUE_KINDS: readonly VenueKind[] = ['restaurant', 'bar']

export type VenueCard = {
  id: string
  slug: string
  /** `cafe` places are listed under Restaurants. */
  kind: VenueKind
  name: string
  city: { slug: string; name: string }
  /** Area / neighbourhood, e.g. "Surry Hills". */
  hood: string
  cuisine: { slug: string; name: string } | null
  /** 0-4, null when unknown. */
  priceLevel: number | null
  /** `venues.dietary[]` slugs: vegetarian, vegan, gluten_free… */
  dietary: string[]
  /** `venue_drinks.drink` slugs: wine, cocktails, beer, coffee, non_alc. */
  drinks: string[]
  /** Atmosphere tags (`place_tags` kind = atmosphere). */
  tags: { slug: string; name: string }[]
  description: string
  menuHighlights: string
  signatureDrinks: string
  hours: PlaceHours[]
  hoursNote: string
  /** First `place_stop_links` row by rank; null when none is linked. */
  stop: { name: string; walkMin: number } | null
}

export type VenueFilter = {
  kind: VenueKind
  city?: string
  /** Show venues priced at this level or lower. */
  priceMax?: 1 | 2 | 3 | 4
  drink?: string
  mood?: string
  /** Every listed requirement must be met (AND). */
  diet: string[]
  cuisine?: string
}

export const FACET_KEYS = ['city', 'price', 'drink', 'mood', 'diet', 'cuisine'] as const
export type FacetKey = (typeof FACET_KEYS)[number]
export type Facets = Record<FacetKey, Record<string, number>>

export const PRICE_LEVELS = [1, 2, 3, 4] as const

const matchers: Record<FacetKey, (v: VenueCard, f: VenueFilter) => boolean> = {
  city: (v, f) => !f.city || v.city.slug === f.city,
  price: (v, f) => f.priceMax === undefined || (v.priceLevel !== null && v.priceLevel <= f.priceMax),
  drink: (v, f) => !f.drink || v.drinks.includes(f.drink),
  mood: (v, f) => !f.mood || v.tags.some((t) => t.slug === f.mood),
  diet: (v, f) => f.diet.every((d) => v.dietary.includes(d)),
  cuisine: (v, f) => !f.cuisine || v.cuisine?.slug === f.cuisine,
}

const passes = (v: VenueCard, f: VenueFilter, skip?: FacetKey) =>
  FACET_KEYS.every((k) => k === skip || matchers[k](v, f))

/** The values a venue contributes to a facet. Price is cumulative: a level-2 venue counts under 2, 3 and 4. */
function facetValues(key: FacetKey, v: VenueCard): string[] {
  switch (key) {
    case 'city':
      return [v.city.slug]
    case 'price':
      return v.priceLevel === null ? [] : PRICE_LEVELS.filter((n) => n >= v.priceLevel!).map(String)
    case 'drink':
      return v.drinks
    case 'mood':
      return v.tags.map((t) => t.slug)
    case 'diet':
      return v.dietary
    case 'cuisine':
      return v.cuisine ? [v.cuisine.slug] : []
  }
}

/**
 * Filters one tab's venues and counts every facet. A facet's counts are computed with that facet's
 * own filter removed (the other filters still apply), so choosing "Seafood" does not zero out the
 * other cuisines. Every value present in the tab appears in the facet, with 0 when nothing matches.
 */
export function filterVenues(list: VenueCard[], f: VenueFilter): { items: VenueCard[]; facets: Facets } {
  const pool = list.filter((v) => v.kind === f.kind)
  const facets = Object.fromEntries(FACET_KEYS.map((k) => [k, {}])) as Facets

  for (const key of FACET_KEYS) {
    const counts: Record<string, number> = key === 'price' ? { '1': 0, '2': 0, '3': 0, '4': 0 } : {}
    for (const v of pool) for (const value of facetValues(key, v)) counts[value] ??= 0
    for (const v of pool) {
      if (!passes(v, f, key)) continue
      for (const value of facetValues(key, v)) counts[value] += 1
    }
    facets[key] = counts
  }

  return { items: pool.filter((v) => passes(v, f)), facets }
}

/** Tab counts: how many venues of each kind pass every filter except the kind itself. */
export function countByKind(list: VenueCard[], f: VenueFilter): Record<VenueKind, number> {
  const counts: Record<VenueKind, number> = { restaurant: 0, bar: 0 }
  for (const v of list) if (passes(v, f)) counts[v.kind] += 1
  return counts
}

// ---------------------------------------------------------------------------
// URL query <-> filter. Lenient: unknown or malformed values are dropped.
// ---------------------------------------------------------------------------

export const SLUG_PATTERN = /^[a-z0-9_-]{1,60}$/

const slugOrUndefined = (s: string | null): string | undefined => (s && SLUG_PATTERN.test(s) ? s : undefined)

export function parsePriceMax(s: string | null): VenueFilter['priceMax'] {
  const n = Number(s)
  return s !== null && s.trim() !== '' && Number.isInteger(n) && n >= 1 && n <= 4 ? (n as 1 | 2 | 3 | 4) : undefined
}

/** `diet=a&diet=b`, `diet=a,b` and `diet[]=a` all fold into one de-duplicated list. */
export function parseDiet(params: URLSearchParams): string[] {
  const raw = [...params.getAll('diet[]'), ...params.getAll('diet')].flatMap((s) => s.split(','))
  return [...new Set(raw.filter((s) => SLUG_PATTERN.test(s)))]
}

export function parseVenueFilter(params: URLSearchParams): VenueFilter {
  return {
    kind: params.get('kind') === 'bar' ? 'bar' : 'restaurant',
    city: slugOrUndefined(params.get('city')),
    priceMax: parsePriceMax(params.get('price_max')),
    drink: slugOrUndefined(params.get('drink')),
    mood: slugOrUndefined(params.get('mood')),
    diet: parseDiet(params),
    cuisine: slugOrUndefined(params.get('cuisine')),
  }
}

/** Inverse of {@link parseVenueFilter}; defaults (restaurant tab, no filters) serialise to nothing. */
export function venueFilterToParams(f: VenueFilter): URLSearchParams {
  const p = new URLSearchParams()
  if (f.kind === 'bar') p.set('kind', 'bar')
  if (f.city) p.set('city', f.city)
  if (f.priceMax !== undefined) p.set('price_max', String(f.priceMax))
  if (f.drink) p.set('drink', f.drink)
  if (f.mood) p.set('mood', f.mood)
  for (const d of f.diet) p.append('diet', d)
  if (f.cuisine) p.set('cuisine', f.cuisine)
  return p
}

/** True when any filter other than the tab is set. */
export function hasActiveFilters(f: VenueFilter): boolean {
  return Boolean(f.city || f.priceMax !== undefined || f.drink || f.mood || f.diet.length || f.cuisine)
}

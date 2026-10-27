import type { Country } from '@/lib/content/shared'

/** Pure dish model + filter logic: shared by the page (client), the API and tests. No server imports at runtime. */

export const DISH_TYPES = ['savoury', 'sweet', 'drink', 'snack'] as const
export type DishType = (typeof DISH_TYPES)[number]

/** `dishes.dietary[]` slugs (spec §9 dietary filter). */
export const DISH_DIETS = ['vegetarian', 'vegan', 'gluten_free', 'halal', 'no_pork', 'no_shellfish'] as const

export const PRICE_LEVELS = [1, 2, 3, 4] as const

export type DishImage = { url: string; alt: string; width: number; height: number; blurDataURL?: string }

export type DishCard = {
  id: string
  slug: string
  name: string
  /** One-line description under the name. */
  line: string
  country: Country
  region: { slug: string; name: string } | null
  type: string
  dietary: string[]
  /** 1-4, null when unknown. */
  priceLevel: number | null
  /** Editorial range in local currency, e.g. "A$14–19". */
  priceText: string | null
  /** 1-3 for "If you eat only three things", else null. */
  mustTryRank: number | null
  image: DishImage | null
}

export type DishFilter = {
  country?: Country
  region?: string
  type?: string
  /** Dishes priced at this level or lower. */
  priceMax?: 1 | 2 | 3 | 4
  /** Every listed requirement must be met (AND). */
  diet: string[]
}

export const FACET_KEYS = ['country', 'region', 'type', 'price', 'diet'] as const
export type FacetKey = (typeof FACET_KEYS)[number]
export type Facets = Record<FacetKey, Record<string, number>>

const matchers: Record<FacetKey, (d: DishCard, f: DishFilter) => boolean> = {
  country: (d, f) => !f.country || d.country === f.country,
  region: (d, f) => !f.region || d.region?.slug === f.region,
  type: (d, f) => !f.type || d.type === f.type,
  price: (d, f) => f.priceMax === undefined || (d.priceLevel !== null && d.priceLevel <= f.priceMax),
  diet: (d, f) => f.diet.every((x) => d.dietary.includes(x)),
}

const passes = (d: DishCard, f: DishFilter, skip?: FacetKey) => FACET_KEYS.every((k) => k === skip || matchers[k](d, f))

/** Values a dish contributes to a facet. Price is cumulative: a level-2 dish counts under 2, 3 and 4. */
function facetValues(key: FacetKey, d: DishCard): string[] {
  switch (key) {
    case 'country':
      return [d.country]
    case 'region':
      return d.region ? [d.region.slug] : []
    case 'type':
      return [d.type]
    case 'price':
      return d.priceLevel === null ? [] : PRICE_LEVELS.filter((n) => n >= d.priceLevel!).map(String)
    case 'diet':
      return d.dietary
  }
}

/**
 * Filters the catalog and counts every facet (same rule as Eat & Drink: a facet's counts drop that facet's own
 * filter, so picking a region does not zero the others). `count` drives the mobile "Show n dishes" button.
 */
export function filterDishes(list: DishCard[], f: DishFilter): { items: DishCard[]; facets: Facets; count: number } {
  const facets = Object.fromEntries(FACET_KEYS.map((k) => [k, {}])) as Facets
  for (const key of FACET_KEYS) {
    const counts: Record<string, number> = {}
    for (const d of list) for (const v of facetValues(key, d)) counts[v] ??= 0
    for (const d of list) {
      if (!passes(d, f, key)) continue
      for (const v of facetValues(key, d)) counts[v] += 1
    }
    facets[key] = counts
  }
  const items = list.filter((d) => passes(d, f))
  return { items, facets, count: items.length }
}

// ---------------------------------------------------------------------------
// URL query <-> filter. Lenient: unknown or malformed values are dropped.
// ---------------------------------------------------------------------------

const SLUG = /^[a-z0-9_-]{1,60}$/

export function parseDishFilter(params: URLSearchParams): DishFilter {
  const country = params.get('country')
  const type = params.get('type')
  const region = params.get('region')
  const price = Number(params.get('price_max'))
  const diet = [...new Set([...params.getAll('diet[]'), ...params.getAll('diet')].flatMap((s) => s.split(',')))].filter((s) =>
    (DISH_DIETS as readonly string[]).includes(s),
  )
  return {
    ...(country === 'au' || country === 'nz' ? { country } : {}),
    ...(region && SLUG.test(region) ? { region } : {}),
    ...(type && (DISH_TYPES as readonly string[]).includes(type) ? { type } : {}),
    ...(Number.isInteger(price) && price >= 1 && price <= 4 ? { priceMax: price as 1 | 2 | 3 | 4 } : {}),
    diet,
  }
}

export function dishFilterToParams(f: DishFilter): URLSearchParams {
  const p = new URLSearchParams()
  if (f.country) p.set('country', f.country)
  if (f.region) p.set('region', f.region)
  if (f.type) p.set('type', f.type)
  if (f.priceMax !== undefined) p.set('price_max', String(f.priceMax))
  for (const d of f.diet) p.append('diet', d)
  return p
}

export const hasActiveFilters = (f: DishFilter): boolean =>
  Boolean(f.country || f.region || f.type || f.priceMax !== undefined || f.diet.length)

// ---------------------------------------------------------------------------
// Where to try it
// ---------------------------------------------------------------------------

export type DishVenue = {
  slug: string
  name: string
  area: string
  priceText: string | null
  note: string
  stop: { name: string; walkMin: number } | null
}

export type RegionVenues = { region: { slug: string; name: string }; venues: DishVenue[] }

/**
 * The region whose venues "Where to try it" shows: the requested one if it has venues, else the dish's home
 * region, else the region with the most venues. Regions carry no coordinates, so "nearest" (spec §9) is
 * approximated by the dish's own region.
 */
export function pickVenueRegion(groups: RegionVenues[], requested: string | undefined, home: string | null): RegionVenues | null {
  const withVenues = groups.filter((g) => g.venues.length > 0)
  return (
    withVenues.find((g) => g.region.slug === requested) ??
    withVenues.find((g) => g.region.slug === home) ??
    [...withVenues].sort((a, b) => b.venues.length - a.venues.length)[0] ??
    null
  )
}

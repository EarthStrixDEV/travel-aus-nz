import type { PlaceHours } from '@/lib/content/places'
import type { Locale } from '@/lib/i18n/t'
import { localizedUrl } from './metadata'

/** What the structured data needs from a place; loaded by `lib/content/seo.ts`. */
export type SeoPlace = {
  slug: string
  type: 'attraction' | 'restaurant' | 'bar' | 'cafe' | 'station' | 'village'
  name: string
  description: string
  /** Neighbourhood / area label. */
  area: string
  city: string
  country: 'au' | 'nz' | null
  lng: number
  lat: number
  hours: PlaceHours[]
  /** 0-4, null when unknown. */
  priceLevel: number | null
  website: string | null
}

export type JsonLd = Record<string, unknown>

const SCHEMA_TYPE: Record<SeoPlace['type'], string> = {
  attraction: 'TouristAttraction',
  restaurant: 'Restaurant',
  bar: 'BarOrPub',
  cafe: 'CafeOrCoffeeShop',
  station: 'TouristAttraction',
  village: 'TouristAttraction',
}

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

const isVenue = (type: SeoPlace['type']) => type === 'restaurant' || type === 'bar' || type === 'cafe'

/** Per-place URL: venues deep-link into /eat-drink, everything else into /map (ruling R9). */
function placePath(p: Pick<SeoPlace, 'type' | 'slug'>): string {
  return isVenue(p.type) ? `/eat-drink?venue=${encodeURIComponent(p.slug)}` : `/map?place=${encodeURIComponent(p.slug)}`
}

/** Rows sharing open/close collapse into one specification. `closes` < `opens` means after midnight, as schema.org allows. */
function hoursSpec(hours: PlaceHours[]): JsonLd[] {
  const groups = new Map<string, { opens: string; closes: string; days: string[] }>()
  for (const h of hours) {
    const key = `${h.open}-${h.close}`
    const g = groups.get(key) ?? { opens: h.open, closes: h.close, days: [] }
    g.days.push(DAYS[h.weekday])
    groups.set(key, g)
  }
  return [...groups.values()].map((g) => ({
    '@type': 'OpeningHoursSpecification',
    dayOfWeek: g.days.length === 1 ? g.days[0] : g.days,
    opens: g.opens,
    closes: g.closes,
  }))
}

/** schema.org `TouristAttraction` | `Restaurant` | `BarOrPub` | `CafeOrCoffeeShop` for one place. */
export function placeJsonLd(p: SeoPlace, locale: Locale): JsonLd {
  const locality = p.area || p.city
  const address: JsonLd = { '@type': 'PostalAddress' }
  if (locality) address.addressLocality = locality
  if (p.country) address.addressCountry = p.country.toUpperCase()

  const ld: JsonLd = {
    '@type': SCHEMA_TYPE[p.type],
    name: p.name,
    url: localizedUrl(locale, placePath(p)),
  }
  if (p.description) ld.description = p.description
  ld.geo = { '@type': 'GeoCoordinates', latitude: p.lat, longitude: p.lng }
  ld.address = address
  if (p.hours.length > 0) ld.openingHoursSpecification = hoursSpec(p.hours)
  if (p.priceLevel !== null && p.priceLevel >= 1 && p.priceLevel <= 4) ld.priceRange = '$'.repeat(p.priceLevel)
  if (p.website) ld.sameAs = [p.website]
  return ld
}

/** One `ItemList` for a whole catalog, so a static page can carry every place without per-place routes. */
export function placesJsonLd(places: SeoPlace[], locale: Locale) {
  return {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    itemListElement: places.map((p, i) => ({ '@type': 'ListItem', position: i + 1, item: placeJsonLd(p, locale) })),
  }
}

/** For `<script type="application/ld+json">`: `<` is escaped so no value can close the tag or open a comment. */
export function serializeJsonLd(data: unknown): string {
  return JSON.stringify(data).replace(/</g, '\\u003c')
}

import { cachedContent } from '@/lib/content/cache'
import type { Locale } from '@/lib/i18n/t'
import type { Json } from '@/lib/supabase/database.types'
import { createPublicClient } from '@/lib/supabase/public'
import type { VenueCard, VenueKind } from '@/lib/venues/filter'
import { mapHours } from './places'
import { text, type Client } from './shared'

export type { VenueCard, VenueKind } from '@/lib/venues/filter'

// `venues!inner` keeps only places that have a venue row; `cities!inner` lets us filter by city slug.
const VENUE_SELECT =
  'id, slug, type, name_i18n, area_i18n, desc_i18n, price_level, hours_note_i18n, ' +
  'city:cities!inner(slug, name_i18n, timezone), neighbourhood:neighbourhoods(name), ' +
  'venue:venues!inner(dietary, menu_highlights_i18n, drinks_i18n, cuisine:cuisines(slug, name_i18n), drinks:venue_drinks(drink)), ' +
  'tags:place_tags(tag:tags(slug, kind, name_i18n)), hours:place_hours(weekday, open_time, close_time), ' +
  'stops:place_stop_links(rank, walk_min, stop:transit_stops(name))'

type VenueData = {
  dietary: string[] | null
  menu_highlights_i18n: Json | null
  drinks_i18n: Json | null
  cuisine: { slug: string; name_i18n: Json } | null
  drinks: { drink: string }[] | null
}

type VenueRow = {
  id: string
  slug: string
  type: 'restaurant' | 'bar' | 'cafe'
  name_i18n: Json
  area_i18n: Json | null
  desc_i18n: Json | null
  price_level: number | null
  hours_note_i18n: Json | null
  city: { slug: string; name_i18n: Json; timezone: string }
  neighbourhood?: { name: string } | null
  // PostgREST embeds a 1:1 relation as an object; tolerate a one-element array too.
  venue: VenueData | VenueData[] | null
  tags: { tag: { slug: string; kind: string; name_i18n: Json } | null }[] | null
  hours: { weekday: number; open_time: string; close_time: string }[] | null
  stops: { rank: number; walk_min: number; stop: { name: string } | null }[] | null
}

function toCard(r: VenueRow, locale: Locale): VenueCard | null {
  const venue = Array.isArray(r.venue) ? r.venue[0] : r.venue
  if (!venue) return null
  const stop = [...(r.stops ?? [])].sort((a, b) => a.rank - b.rank).find((s) => s.stop)
  return {
    id: r.id,
    slug: r.slug,
    kind: (r.type === 'bar' ? 'bar' : 'restaurant') satisfies VenueKind,
    name: text(r.name_i18n, locale),
    city: { slug: r.city.slug, name: text(r.city.name_i18n, locale) },
    hood: text(r.area_i18n, locale) || r.neighbourhood?.name || '',
    cuisine: venue.cuisine ? { slug: venue.cuisine.slug, name: text(venue.cuisine.name_i18n, locale) } : null,
    priceLevel: r.price_level,
    dietary: venue.dietary ?? [],
    drinks: (venue.drinks ?? []).map((d) => d.drink),
    tags: (r.tags ?? []).flatMap((x) =>
      x.tag?.kind === 'atmosphere' ? [{ slug: x.tag.slug, name: text(x.tag.name_i18n, locale) }] : [],
    ),
    description: text(r.desc_i18n, locale),
    menuHighlights: text(venue.menu_highlights_i18n, locale),
    signatureDrinks: text(venue.drinks_i18n, locale),
    hours: mapHours(r.hours),
    hoursNote: text(r.hours_note_i18n, locale),
    stop: stop?.stop ? { name: stop.stop.name, walkMin: stop.walk_min } : null,
  }
}

/** Published, open restaurants / cafes / bars with a venue row; a closed or unpublished place never leaves the database query. */
export async function loadVenues(client: Client, locale: Locale, opts: { city?: string; slug?: string } = {}): Promise<VenueCard[]> {
  let q = client
    .from('places')
    .select(VENUE_SELECT)
    .in('type', ['restaurant', 'bar', 'cafe'])
    .eq('status', 'published')
    .eq('is_closed', false)
  if (opts.city) q = q.eq('city.slug', opts.city)
  if (opts.slug) q = q.eq('slug', opts.slug)
  const { data, error } = await q.order('slug')
  if (error) throw error
  return ((data ?? []) as unknown as VenueRow[]).flatMap((r) => toCard(r, locale) ?? [])
}

/**
 * The venue catalog shipped with /eat-drink (spec §8: <= 300 per city, filtered on the client).
 * Cached under the `venues` tag. Ordered by slug.
 */
export function getVenues(locale: Locale, city?: string): Promise<VenueCard[]> {
  return cachedContent(['venues', locale, city ?? 'all'], 'venues', () => loadVenues(createPublicClient(), locale, { city }))()
}

/** One venue for `GET /api/v1/venues/:slug`; null when unknown, closed or unpublished. */
export function getVenue(slug: string, locale: Locale): Promise<VenueCard | null> {
  return cachedContent(['venue', locale, slug], 'venues', async () => {
    const [venue] = await loadVenues(createPublicClient(), locale, { slug })
    return venue ?? null
  })()
}

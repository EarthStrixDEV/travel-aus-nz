import { cachedContent } from '@/lib/content/cache'
import type { Locale } from '@/lib/i18n/t'
import { createPublicClient } from '@/lib/supabase/public'
import type { Json } from '@/lib/supabase/database.types'
import type { SeoPlace } from '@/lib/seo/jsonld'
import { ewkbToGeometry } from './geo'
import { mapHours } from './places'
import { text, toCountry, type Client } from './shared'

export type SeoGroup = 'attractions' | 'venues'

const SELECT =
  'slug, type, geom, name_i18n, area_i18n, desc_i18n, price_level, website, ' +
  'city:cities(name_i18n, region:regions(country)), neighbourhood:neighbourhoods(name), ' +
  'hours:place_hours(weekday, open_time, close_time)'

type Row = {
  slug: string
  type: SeoPlace['type']
  geom: string
  name_i18n: Json
  area_i18n: Json | null
  desc_i18n: Json | null
  price_level: number | null
  website: string | null
  city: { name_i18n: Json; region: { country: string } | null } | null
  neighbourhood?: { name: string } | null
  hours: { weekday: number; open_time: string; close_time: string }[] | null
}

/**
 * Published, open places for sitemaps and structured data. Venues use the same inner join as the
 * /eat-drink catalog, so every URL listed opens a real drawer.
 */
export async function loadSeoPlaces(client: Client, group: SeoGroup, locale: Locale): Promise<SeoPlace[]> {
  const venues = group === 'venues'
  const { data, error } = await client
    .from('places')
    .select(venues ? `${SELECT}, venue:venues!inner(place_id)` : SELECT)
    .in('type', venues ? ['restaurant', 'bar', 'cafe'] : ['attraction'])
    .eq('status', 'published')
    .eq('is_closed', false)
    .order('slug')
  if (error) throw error
  return ((data ?? []) as unknown as Row[]).flatMap((r) => {
    const point = ewkbToGeometry(r.geom)
    if (point?.type !== 'Point') return []
    return [
      {
        slug: r.slug,
        type: r.type,
        name: text(r.name_i18n, locale),
        description: text(r.desc_i18n, locale),
        area: text(r.area_i18n, locale) || r.neighbourhood?.name || '',
        city: r.city ? text(r.city.name_i18n, locale) : '',
        country: toCountry(r.city?.region?.country),
        lng: point.coordinates[0],
        lat: point.coordinates[1],
        hours: mapHours(r.hours),
        priceLevel: r.price_level,
        website: r.website,
      },
    ]
  })
}

/** Cached under the same tag as the page it feeds (`map` for attractions, `venues` for venues). */
export function getSeoPlaces(group: SeoGroup, locale: Locale): Promise<SeoPlace[]> {
  return cachedContent(['seo-places', group, locale], group === 'venues' ? 'venues' : 'map', () =>
    loadSeoPlaces(createPublicClient(), group, locale),
  )()
}

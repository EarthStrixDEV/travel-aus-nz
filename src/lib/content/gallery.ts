import { cachedContent } from '@/lib/content/cache'
import {
  compareGallery,
  isSeason,
  typeSlug,
  type GalleryNearby,
  type GalleryPhoto,
} from '@/lib/gallery/filter'
import type { Locale } from '@/lib/i18n/t'
import { blurDataUrl, mediaUrl } from '@/lib/media/path'
import type { Json } from '@/lib/supabase/database.types'
import { createPublicClient } from '@/lib/supabase/public'
import { text, type Client } from './shared'

export type { GalleryPhoto } from '@/lib/gallery/filter'

/** Most venues the lightbox lists under "Nearby dining". */
const MAX_NEARBY = 3

// `place_nearby_venues` has two foreign keys to `places`, so both embeds name theirs.
const GALLERY_SELECT =
  'id, season, title_i18n, sort, ' +
  'media:media_assets!inner(path, width, height, blurhash, alt_i18n), ' +
  'region:regions(slug, name_i18n), ' +
  'place:places!inner(id, slug, category, name_i18n, desc_i18n, best_time_i18n, access_i18n, ' +
  'nearby:place_nearby_venues!place_nearby_venues_place_id_fkey(sort, ' +
  'venue:places!place_nearby_venues_venue_id_fkey(slug, name_i18n, area_i18n, status, is_closed)))'

type VenueRow = { slug: string; name_i18n: Json; area_i18n: Json | null; status: string; is_closed: boolean }

type GalleryRow = {
  id: string
  season: string | null
  title_i18n: Json | null
  sort: number | null
  media: { path: string; width: number; height: number; blurhash: string | null; alt_i18n: Json | null } | null
  region: { slug: string; name_i18n: Json } | null
  place: {
    id: string
    slug: string
    category: string | null
    name_i18n: Json
    desc_i18n: Json | null
    best_time_i18n: Json | null
    access_i18n: Json | null
    nearby: { sort: number | null; venue: VenueRow | null }[] | null
  } | null
}

/** Published, open venues only, in `place_nearby_venues.sort` order, capped for the lightbox. */
function nearbyVenues(rows: NonNullable<GalleryRow['place']>['nearby'], locale: Locale): GalleryNearby[] {
  return [...(rows ?? [])]
    .flatMap((r) => (r.venue && r.venue.status === 'published' && !r.venue.is_closed ? [{ sort: r.sort ?? 0, venue: r.venue }] : []))
    .sort((a, b) => a.sort - b.sort)
    .slice(0, MAX_NEARBY)
    .map(({ venue }) => ({ slug: venue.slug, name: text(venue.name_i18n, locale), area: text(venue.area_i18n, locale) }))
}

/** One row -> photo + place summary; null when the media or the place is not readable. */
export function toGalleryPhoto(row: GalleryRow, locale: Locale): GalleryPhoto | null {
  const { media, place } = row
  if (!media || !place) return null
  const title = text(row.title_i18n, locale) || text(place.name_i18n, locale)
  return {
    id: row.id,
    title,
    sort: row.sort ?? 0,
    season: isSeason(row.season) ? row.season : null,
    region: row.region ? { slug: row.region.slug, name: text(row.region.name_i18n, locale) } : null,
    type: place.category ? typeSlug(place.category) : null,
    typeLabel: place.category,
    image: {
      url: mediaUrl(media.path),
      alt: text(media.alt_i18n, locale) || title,
      width: media.width,
      height: media.height,
      blurDataURL: blurDataUrl(media.blurhash),
    },
    place: {
      id: place.id,
      slug: place.slug,
      name: text(place.name_i18n, locale),
      description: text(place.desc_i18n, locale),
      bestTime: text(place.best_time_i18n, locale),
      access: text(place.access_i18n, locale),
      nearby: nearbyVenues(place.nearby, locale),
    },
  }
}

/** Every published photo of a published place, ordered by `sort`. A draft never leaves the database query. */
export async function loadGallery(client: Client, locale: Locale): Promise<GalleryPhoto[]> {
  const { data, error } = await client
    .from('gallery_photos')
    .select(GALLERY_SELECT)
    .eq('status', 'published')
    .eq('place.status', 'published')
    .order('sort')
    .order('id')
  if (error) throw error
  return ((data ?? []) as unknown as GalleryRow[]).flatMap((r) => toGalleryPhoto(r, locale) ?? []).sort(compareGallery)
}

/** The gallery for `/gallery` and `GET /api/v1/gallery`, cached under the `gallery` tag. */
export function getGallery(locale: Locale): Promise<GalleryPhoto[]> {
  return cachedContent(['gallery', locale], 'gallery', () => loadGallery(createPublicClient(), locale))()
}

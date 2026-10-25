import { encodeCursor, type Cursor } from '@/lib/api/cursor'

/** Pure gallery model + filter logic: shared by the page (client), the API and tests. No server imports at runtime. */

export const SEASONS = ['summer', 'autumn', 'winter', 'spring'] as const
export type Season = (typeof SEASONS)[number]

/** `places.category` slugs the UI has translations for (spec §6). Other categories fall back to their stored label. */
export const TYPE_SLUGS = ['beach', 'mountain', 'city', 'wildlife', 'wine-region', 'heritage'] as const

export type GalleryNearby = { slug: string; name: string; area: string }

export type GalleryPhoto = {
  id: string
  title: string
  sort: number
  season: Season | null
  region: { slug: string; name: string } | null
  /** Slug of `places.category` ("Wine region" -> "wine-region"); null when the place has none. */
  type: string | null
  /** `places.category` as stored; the label when the slug has no translation. */
  typeLabel: string | null
  image: { url: string; alt: string; width: number; height: number; blurDataURL?: string }
  /** The place the photo is of; the lightbox needs nothing else. */
  place: {
    id: string
    slug: string
    name: string
    description: string
    bestTime: string
    access: string
    /** At most 3 published, open venues, by `place_nearby_venues.sort`. */
    nearby: GalleryNearby[]
  }
}

export type GalleryFilter = { region?: string; type?: string; season?: Season }

export const typeSlug = (category: string): string => category.trim().toLowerCase().replace(/\s+/g, '-')

/** The order the API and the page list photos in. */
export function compareGallery(a: { sort: number; id: string }, b: { sort: number; id: string }): number {
  return a.sort - b.sort || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0)
}

/** Intersection of the three filters; a photo missing a field never matches a filter on it. Keeps the input order. */
export function filterGallery(list: GalleryPhoto[], f: GalleryFilter): GalleryPhoto[] {
  return list.filter(
    (p) =>
      (!f.region || p.region?.slug === f.region) &&
      (!f.type || p.type === f.type) &&
      (!f.season || p.season === f.season),
  )
}

/** The regions and types that actually occur, so every chip leads somewhere. Types: known ones in spec order first. */
export function galleryOptions(list: GalleryPhoto[]): {
  regions: { slug: string; name: string }[]
  types: { slug: string; label: string }[]
} {
  const regions = new Map<string, { slug: string; name: string }>()
  const types = new Map<string, { slug: string; label: string }>()
  for (const p of list) {
    if (p.region) regions.set(p.region.slug, p.region)
    if (p.type) types.set(p.type, { slug: p.type, label: p.typeLabel ?? p.type })
  }
  const rank = (slug: string) => {
    const i = (TYPE_SLUGS as readonly string[]).indexOf(slug)
    return i === -1 ? TYPE_SLUGS.length : i
  }
  return {
    regions: [...regions.values()].sort((a, b) => a.name.localeCompare(b.name)),
    types: [...types.values()].sort((a, b) => rank(a.slug) - rank(b.slug) || a.label.localeCompare(b.label)),
  }
}

// ---------------------------------------------------------------------------
// URL query <-> filter. Lenient: unknown or malformed values are dropped.
// ---------------------------------------------------------------------------

export const SLUG_PATTERN = /^[a-z0-9_-]{1,60}$/

const slugOrUndefined = (s: string | null): string | undefined => (s && SLUG_PATTERN.test(s) ? s : undefined)

export const isSeason = (s: string | null | undefined): s is Season => (SEASONS as readonly string[]).includes(s ?? '')

export function parseGalleryFilter(params: URLSearchParams): GalleryFilter {
  const season = params.get('season')
  return {
    region: slugOrUndefined(params.get('region')),
    type: slugOrUndefined(params.get('type')),
    season: isSeason(season) ? season : undefined,
  }
}

/** Inverse of {@link parseGalleryFilter}; "no filters" serialises to nothing. */
export function galleryFilterToParams(f: GalleryFilter): URLSearchParams {
  const p = new URLSearchParams()
  if (f.region) p.set('region', f.region)
  if (f.type) p.set('type', f.type)
  if (f.season) p.set('season', f.season)
  return p
}

export const hasActiveFilters = (f: GalleryFilter): boolean => Boolean(f.region || f.type || f.season)

// ---------------------------------------------------------------------------
// Cursor paging for GET /api/v1/gallery. The list is already ordered by (sort, id).
// ---------------------------------------------------------------------------

export function paginateGallery(
  list: GalleryPhoto[],
  opts: { cursor?: Cursor; limit: number },
): { items: GalleryPhoto[]; nextCursor: string | null } {
  const { cursor, limit } = opts
  const from = cursor ? { sort: Number(cursor.sort), id: cursor.id } : null
  const after = from ? list.filter((p) => compareGallery(p, from) > 0) : list
  const items = after.slice(0, limit)
  const last = items[items.length - 1]
  return { items, nextCursor: after.length > limit && last ? encodeCursor({ sort: last.sort, id: last.id }) : null }
}

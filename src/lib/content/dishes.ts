import { cachedContent } from '@/lib/content/cache'
import type { DishCard, DishImage, DishVenue, RegionVenues } from '@/lib/dishes/filter'
import type { Locale } from '@/lib/i18n/t'
import { blurDataUrl, mediaUrl } from '@/lib/media/path'
import type { Json } from '@/lib/supabase/database.types'
import { createPublicClient } from '@/lib/supabase/public'
import { text, toCountry, type Client } from './shared'

export type { DishCard, DishVenue, RegionVenues } from '@/lib/dishes/filter'

export type DishCollection = { slug: string; title: string; sub: string; count: number; previews: DishCard[] }

export type DishesData = { dishes: DishCard[]; mustTry: DishCard[]; collections: DishCollection[] }

export type DishDetail = DishCard & {
  story: string
  disputeNote: string
  taste: string
  served: string
  allergy: string
  pairings: { k: string; v: string }[]
  /** Venues grouped by region (each sorted by rank, at most three); pick one with `pickVenueRegion`. */
  venuesByRegion: RegionVenues[]
}

/** Venues per region in "Where to try it" (spec §9: three per region). */
const VENUES_PER_REGION = 3

const CARD_SELECT =
  'id, slug, country, type, name_i18n, line_i18n, dietary, price_level, price_text, must_try_rank, sort, status, ' +
  'region:regions(slug, name_i18n), cover:media_assets(path, width, height, blurhash, alt_i18n)'

const DETAIL_SELECT =
  `${CARD_SELECT}, story_i18n, dispute_note_i18n, taste_i18n, served_i18n, allergy_i18n, ` +
  'pairings:dish_pairings(k_i18n, v_i18n, sort), ' +
  'venues:dish_venues(rank, price_text, note_i18n, region:regions(slug, name_i18n), ' +
  'place:places!inner(slug, name_i18n, area_i18n, status, is_closed, stops:place_stop_links(rank, walk_min, stop:transit_stops(name))))'

type CardRow = {
  id: string
  slug: string
  country: string
  type: string
  name_i18n: Json
  line_i18n: Json | null
  dietary: string[] | null
  price_level: number | null
  price_text: string | null
  must_try_rank: number | null
  sort: number | null
  status: string
  region: { slug: string; name_i18n: Json } | null
  cover: { path: string; width: number; height: number; blurhash: string | null; alt_i18n: Json | null } | null
}

type VenueRow = {
  rank: number
  price_text: string | null
  note_i18n: Json | null
  region: { slug: string; name_i18n: Json } | null
  place: {
    slug: string
    name_i18n: Json
    area_i18n: Json | null
    status: string
    is_closed: boolean
    stops: { rank: number; walk_min: number; stop: { name: string } | null }[] | null
  } | null
}

type DetailRow = CardRow & {
  story_i18n: Json | null
  dispute_note_i18n: Json | null
  taste_i18n: Json | null
  served_i18n: Json | null
  allergy_i18n: Json | null
  pairings: { k_i18n: Json | null; v_i18n: Json | null; sort: number }[] | null
  venues: VenueRow[] | null
}

function toImage(cover: CardRow['cover'], alt: string, locale: Locale): DishImage | null {
  if (!cover) return null
  return {
    url: mediaUrl(cover.path),
    alt: text(cover.alt_i18n, locale) || alt,
    width: cover.width,
    height: cover.height,
    blurDataURL: blurDataUrl(cover.blurhash),
  }
}

export function toDishCard(r: CardRow, locale: Locale): DishCard | null {
  const country = toCountry(r.country)
  if (!country) return null
  const name = text(r.name_i18n, locale)
  return {
    id: r.id,
    slug: r.slug,
    name,
    line: text(r.line_i18n, locale),
    country,
    region: r.region ? { slug: r.region.slug, name: text(r.region.name_i18n, locale) } : null,
    type: r.type,
    dietary: r.dietary ?? [],
    priceLevel: r.price_level,
    priceText: r.price_text,
    mustTryRank: r.must_try_rank,
    image: toImage(r.cover, name, locale),
  }
}

/** Editors' order: `sort`, then name. */
const bySort = (rows: CardRow[]) => [...rows].sort((a, b) => (a.sort ?? 0) - (b.sort ?? 0) || a.slug.localeCompare(b.slug))

/**
 * Venues of a dish grouped by region. A place that is closed or not published never appears (spec §9: it goes to
 * the editors' review queue instead).
 */
export function groupVenues(rows: VenueRow[] | null, locale: Locale): RegionVenues[] {
  const groups = new Map<string, RegionVenues & { ranks: number[] }>()
  for (const r of [...(rows ?? [])].sort((a, b) => a.rank - b.rank)) {
    const p = r.place
    if (!p || p.status !== 'published' || p.is_closed || !r.region) continue
    const g = groups.get(r.region.slug) ?? { region: { slug: r.region.slug, name: text(r.region.name_i18n, locale) }, venues: [], ranks: [] }
    groups.set(r.region.slug, g)
    if (g.venues.length >= VENUES_PER_REGION) continue
    const stop = [...(p.stops ?? [])].sort((a, b) => a.rank - b.rank).find((s) => s.stop)
    const venue: DishVenue = {
      slug: p.slug,
      name: text(p.name_i18n, locale),
      area: text(p.area_i18n, locale),
      priceText: r.price_text,
      note: text(r.note_i18n, locale),
      stop: stop?.stop ? { name: stop.stop.name, walkMin: stop.walk_min } : null,
    }
    g.venues.push(venue)
  }
  return [...groups.values()].map(({ region, venues }) => ({ region, venues }))
}

/** Published dishes (whole catalog, filtered on the client), the three must-try picks, and published dish collections. */
export async function loadDishes(client: Client, locale: Locale): Promise<DishesData> {
  const [dishes, collections] = await Promise.all([
    client.from('dishes').select(CARD_SELECT).eq('status', 'published'),
    client
      .from('collections')
      .select('slug, title_i18n, sub_i18n, status, items:collection_items(entity_id, position)')
      .eq('kind', 'dish')
      .eq('status', 'published')
      .order('slug'),
  ])
  if (dishes.error) throw dishes.error
  if (collections.error) throw collections.error

  const rows = bySort(((dishes.data ?? []) as unknown as CardRow[]).filter((r) => r.status === 'published'))
  const cards = rows.flatMap((r) => toDishCard(r, locale) ?? [])
  const byId = new Map(cards.map((d) => [d.id, d]))

  type CollectionRow = { slug: string; title_i18n: Json; sub_i18n: Json | null; status: string; items: { entity_id: string; position: number }[] | null }
  return {
    dishes: cards,
    mustTry: cards
      .filter((d) => d.mustTryRank !== null && d.mustTryRank >= 1 && d.mustTryRank <= 3)
      .sort((a, b) => a.mustTryRank! - b.mustTryRank!),
    collections: ((collections.data ?? []) as unknown as CollectionRow[])
      .filter((c) => c.status === 'published')
      .flatMap((c) => {
        // Only published dishes count; a collection left with none is hidden.
        const members = [...(c.items ?? [])].sort((a, b) => a.position - b.position).flatMap((i) => byId.get(i.entity_id) ?? [])
        if (!members.length) return []
        return [{ slug: c.slug, title: text(c.title_i18n, locale), sub: text(c.sub_i18n, locale), count: members.length, previews: members.slice(0, 3) }]
      }),
  }
}

/** One published dish with pairings and venues; null when unknown or unpublished. */
export async function loadDish(client: Client, slug: string, locale: Locale): Promise<DishDetail | null> {
  const { data, error } = await client.from('dishes').select(DETAIL_SELECT).eq('slug', slug).eq('status', 'published').maybeSingle()
  if (error) throw error
  const row = data as unknown as DetailRow | null
  if (!row || row.status !== 'published') return null
  const card = toDishCard(row, locale)
  if (!card) return null
  return {
    ...card,
    story: text(row.story_i18n, locale),
    disputeNote: text(row.dispute_note_i18n, locale),
    taste: text(row.taste_i18n, locale),
    served: text(row.served_i18n, locale),
    allergy: text(row.allergy_i18n, locale),
    pairings: [...(row.pairings ?? [])]
      .sort((a, b) => a.sort - b.sort)
      .map((p) => ({ k: text(p.k_i18n, locale), v: text(p.v_i18n, locale) }))
      .filter((p) => p.k || p.v),
    venuesByRegion: groupVenues(row.venues, locale),
  }
}

/** Slugs of published dishes (static params + sitemap). */
export async function loadDishSlugs(client: Client): Promise<string[]> {
  const { data, error } = await client.from('dishes').select('slug').eq('status', 'published').order('slug')
  if (error) throw error
  return (data ?? []).map((r) => r.slug)
}

export function getDishes(locale: Locale): Promise<DishesData> {
  return cachedContent(['dishes', locale], 'dishes', () => loadDishes(createPublicClient(), locale))()
}

export function getDish(slug: string, locale: Locale): Promise<DishDetail | null> {
  return cachedContent(['dish', locale, slug], 'dishes', () => loadDish(createPublicClient(), slug, locale))()
}

export function getDishSlugs(): Promise<string[]> {
  return cachedContent(['dish-slugs'], 'dishes', () => loadDishSlugs(createPublicClient()))()
}

import { cachedContent } from '@/lib/content/cache'
import type { Locale } from '@/lib/i18n/t'
import { createPublicClient } from '@/lib/supabase/public'
import type { Database, Json } from '@/lib/supabase/database.types'
import {
  JOURNEY_SELECT,
  LEG_SELECT,
  toJourneyCard,
  toLegs,
  type JourneyCard,
  type JourneyLeg,
} from './journeys'
import { text, toCountry, toMedia, type Client, type Country, type MediaRef } from './shared'

export type HomeSlide = {
  id: number
  image: MediaRef | null
  caption: string
  place: { slug: string; name: string } | null
}

export type HomeRegion = {
  slug: string
  country: Country
  name: string
  state: string
  lede: string
  /** 1-12, from `regions.best_months`. */
  bestMonths: number[]
  image: MediaRef | null
}

export type RouteShowcase = {
  slug: string
  title: string
  /** `journeys.line_i18n`, e.g. "Pay with myki · Ferry ticket separate". */
  line: string
  from: string
  to: string
  priceFrom: number | null
  currency: string | null
  legs: JourneyLeg[]
}

export type DiningVenue = {
  id: string
  slug: string
  name: string
  /** Cuisine name when the venue has one; otherwise render `type`. */
  cuisine: string | null
  type: Database['public']['Enums']['place_type']
  /** "Surry Hills, Sydney" */
  where: string
  /** 0-4, `places.price_level`. */
  priceLevel: number | null
  tags: string[]
}

export type DiningEdit = { slug: string; title: string; sub: string; venues: DiningVenue[] }

export type HomeData = {
  slides: HomeSlide[]
  /** Published, featured (`featured_rank` set) regions of the requested country, by rank: [0] large, [1] wide, rest small. */
  regions: HomeRegion[]
  journeys: JourneyCard[]
  routeShowcase: RouteShowcase | null
  diningEdit: DiningEdit | null
}

type MediaRow = { path: string; alt_i18n: Json | null }

const SLIDE_SELECT = 'id, sort, caption_i18n, media:media_assets(path, alt_i18n), place:places(slug, name_i18n)'
const REGION_SELECT =
  'slug, country, featured_rank, name_i18n, state_i18n, lede_i18n, best_months, cover:media_assets(path, alt_i18n)'
const PLACE_SELECT =
  'id, slug, type, is_closed, name_i18n, area_i18n, price_level, city:cities(name_i18n), venue:venues(cuisine:cuisines(name_i18n)), tags:place_tags(tag:tags(kind, slug, name_i18n))'

async function loadSlides(client: Client, locale: Locale): Promise<HomeSlide[]> {
  const { data, error } = await client.from('hero_slides').select(SLIDE_SELECT).eq('active', true).order('sort').limit(4)
  if (error) throw error
  type Row = { id: number; caption_i18n: Json | null; media: MediaRow | null; place: { slug: string; name_i18n: Json } | null }
  return ((data ?? []) as unknown as Row[]).map((s) => ({
    id: s.id,
    image: toMedia(s.media, locale),
    caption: text(s.caption_i18n, locale),
    place: s.place ? { slug: s.place.slug, name: text(s.place.name_i18n, locale) } : null,
  }))
}

async function loadRegions(client: Client, locale: Locale, country: Country): Promise<HomeRegion[]> {
  const { data, error } = await client
    .from('regions')
    .select(REGION_SELECT)
    .eq('status', 'published')
    .eq('country', country === 'au' ? 'AU' : 'NZ')
    .order('featured_rank')
  if (error) throw error
  type Row = {
    slug: string
    country: string
    featured_rank: number | null
    name_i18n: Json
    state_i18n: Json | null
    lede_i18n: Json | null
    best_months: number[] | null
    cover: MediaRow | null
  }
  return ((data ?? []) as unknown as Row[])
    .filter((r): r is Row & { featured_rank: number } => r.featured_rank !== null)
    .sort((a, b) => a.featured_rank - b.featured_rank || a.slug.localeCompare(b.slug))
    .map((r) => ({
      slug: r.slug,
      country: toCountry(r.country) ?? country,
      name: text(r.name_i18n, locale),
      state: text(r.state_i18n, locale),
      lede: text(r.lede_i18n, locale),
      bestMonths: r.best_months ?? [],
      image: toMedia(r.cover, locale),
    }))
}

type JourneyRows = Parameters<typeof toJourneyCard>[0]

async function loadJourneys(client: Client, locale: Locale): Promise<JourneyCard[]> {
  const { data, error } = await client
    .from('journeys')
    .select(JOURNEY_SELECT)
    .eq('status', 'published')
    .eq('kind', 'itinerary')
    .order('slug')
    .limit(3)
  if (error) throw error
  return ((data ?? []) as unknown as JourneyRows[]).map((r) => toJourneyCard(r, locale))
}

async function loadRouteShowcase(client: Client, locale: Locale): Promise<RouteShowcase | null> {
  const { data, error } = await client
    .from('journeys')
    .select(`${JOURNEY_SELECT}, legs:journey_legs(${LEG_SELECT})`)
    .eq('status', 'published')
    .eq('kind', 'route_showcase')
    .order('slug')
    .limit(1)
  if (error) throw error
  const row = ((data ?? []) as unknown as (JourneyRows & { legs: Parameters<typeof toLegs>[0] })[])[0]
  if (!row) return null
  const card = toJourneyCard(row, locale)
  return {
    slug: card.slug,
    title: card.title,
    line: card.line,
    from: card.from,
    to: card.to,
    priceFrom: card.priceFrom,
    currency: card.currency,
    legs: toLegs(row.legs),
  }
}

async function loadDiningEdit(client: Client, locale: Locale): Promise<DiningEdit | null> {
  const { data: cols, error: colErr } = await client
    .from('collections')
    .select('id, slug, title_i18n, sub_i18n')
    .eq('placement', 'home_dining')
    .eq('status', 'published')
    .order('slug')
    .limit(1)
  if (colErr) throw colErr
  const collection = cols?.[0]
  if (!collection) return null

  const { data: items, error: itemErr } = await client
    .from('collection_items')
    .select('entity_id, position')
    .eq('collection_id', collection.id)
    .order('position')
  if (itemErr) throw itemErr
  const order = new Map((items ?? []).map((i) => [i.entity_id, i.position]))

  const { data: places, error: placeErr } = await client
    .from('places')
    .select(PLACE_SELECT)
    .in('id', [...order.keys()])
    .eq('status', 'published')
    .eq('is_closed', false)
  if (placeErr) throw placeErr
  type Row = {
    id: string
    slug: string
    type: DiningVenue['type']
    name_i18n: Json
    area_i18n: Json | null
    price_level: number | null
    city: { name_i18n: Json } | null
    venue: { cuisine: { name_i18n: Json } | null } | null
    tags: { tag: { kind: string; slug: string; name_i18n: Json } | null }[]
  }
  const venues = ((places ?? []) as unknown as Row[])
    .sort((a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0))
    .map<DiningVenue>((p) => ({
      id: p.id,
      slug: p.slug,
      name: text(p.name_i18n, locale),
      cuisine: p.venue?.cuisine ? text(p.venue.cuisine.name_i18n, locale) || null : null,
      type: p.type,
      where: [text(p.area_i18n, locale), p.city ? text(p.city.name_i18n, locale) : ''].filter(Boolean).join(', '),
      priceLevel: p.price_level,
      tags: p.tags
        .flatMap((t) => (t.tag ? [t.tag] : []))
        .sort((a, b) => Number(b.kind === 'atmosphere') - Number(a.kind === 'atmosphere') || a.slug.localeCompare(b.slug))
        .slice(0, 2)
        .map((t) => text(t.name_i18n, locale)),
    }))

  return { slug: collection.slug, title: text(collection.title_i18n, locale), sub: text(collection.sub_i18n, locale), venues }
}

/** Uncached; `getHome` is the cached entry point. Throws on any query error so a failure never replaces cached content. */
export async function loadHome(client: Client, locale: Locale, country: Country): Promise<HomeData> {
  const [slides, regions, journeys, routeShowcase, diningEdit] = await Promise.all([
    loadSlides(client, locale),
    loadRegions(client, locale, country),
    loadJourneys(client, locale),
    loadRouteShowcase(client, locale),
    loadDiningEdit(client, locale),
  ])
  return { slides, regions, journeys, routeShowcase, diningEdit }
}

/** Published home content, ISR-cached under the `home` tag. */
export function getHome(locale: Locale, country: Country): Promise<HomeData> {
  return cachedContent(['home', locale, country], 'home', () => loadHome(createPublicClient(), locale, country))()
}

export type InterestTag = { slug: string; name: string }

/** Interest tags for the search bar. */
export function getInterestTags(locale: Locale): Promise<InterestTag[]> {
  return cachedContent(['home-interests', locale], 'home', async () => {
    const { data, error } = await createPublicClient().from('tags').select('slug, name_i18n').eq('kind', 'interest').order('slug')
    if (error) throw error
    return (data ?? []).map((t) => ({ slug: t.slug, name: text(t.name_i18n, locale) }))
  })()
}

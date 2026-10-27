import { cachedContent } from '@/lib/content/cache'
import type { Locale } from '@/lib/i18n/t'
import { Constants, type Json } from '@/lib/supabase/database.types'
import { createPublicClient } from '@/lib/supabase/public'
import { text, toCountry, toMedia, type Client, type Country, type MediaRef, type TransitMode } from './shared'

export type TransportCity = { slug: string; name: string; country: Country; timezone: string }

export type ScenicCard = {
  slug: string
  country: Country | null
  mode: TransitMode | null
  name: string
  from: string
  to: string
  line: string
  duration: string | null
  frequency: string | null
  fareFrom: number | null
  currency: string | null
  image: MediaRef | null
}

export type CardInfo = {
  name: string
  /** City slug; null for a card that is not tied to one city. */
  city: string | null
  cityName: string | null
  contactless: boolean | null
  howTo: string
  caps: string
  officialUrl: string | null
  verifiedAt: string | null
}

export type TransportContent = { cities: TransportCity[]; scenic: ScenicCard[]; cards: CardInfo[]; tips: string | null }

export type CityLine = {
  short_name: string | null
  long_name: string | null
  mode: TransitMode
  stops: string[]
  end_to_end_min: number | null
  headway_peak_min: number | null
  headway_offpeak_min: number | null
  fare_min: number | null
  fare_max: number | null
}

const num = (v: number | string | null | undefined): number | null => (v === null || v === undefined || v === '' ? null : Number(v))

// ---- page content ------------------------------------------------------------------------

type CityRow = { slug: string; name_i18n: Json; timezone: string; region: { country: string } | null }

type ScenicRow = {
  slug: string | null
  country: string | null
  mode: TransitMode | null
  name_i18n: Json | null
  from_name: string | null
  to_name: string | null
  line_i18n: Json | null
  duration_text: string | null
  frequency_text: string | null
  fare_from: number | string | null
  currency: string | null
  status: string
  cover: { path: string; alt_i18n: Json | null } | null
}

type CardRow = {
  name: string
  contactless: boolean | null
  how_to_i18n: Json | null
  caps_i18n: Json | null
  official_url: string | null
  verified_at: string | null
  city: { slug: string; name_i18n: Json } | null
}

export function toScenicCard(row: ScenicRow, locale: Locale): ScenicCard | null {
  if (!row.slug) return null
  return {
    slug: row.slug,
    country: toCountry(row.country),
    mode: row.mode,
    name: text(row.name_i18n, locale) || row.slug,
    from: row.from_name ?? '',
    to: row.to_name ?? '',
    line: text(row.line_i18n, locale),
    duration: row.duration_text,
    frequency: row.frequency_text,
    fareFrom: num(row.fare_from),
    currency: row.currency,
    image: toMedia(row.cover, locale),
  }
}

/** Cities, published scenic routes, transit cards and the `transport_tips` block for `/transport`. */
export async function loadTransport(client: Client, locale: Locale): Promise<TransportContent> {
  const [cities, scenic, cards, tips] = await Promise.all([
    client.from('cities').select('slug, name_i18n, timezone, region:regions(country)').eq('status', 'published').order('id'),
    client
      .from('scenic_routes')
      .select(
        'slug, country, mode, name_i18n, from_name, to_name, line_i18n, duration_text, frequency_text, fare_from, currency, status, cover:media_assets(path, alt_i18n)',
      )
      .eq('status', 'published')
      .order('slug'),
    client
      .from('transit_cards')
      .select('name, contactless, how_to_i18n, caps_i18n, official_url, verified_at, city:cities(slug, name_i18n)')
      .order('id'),
    client.from('content_blocks').select('body_i18n').eq('key', 'transport_tips').maybeSingle(),
  ])
  for (const r of [cities, scenic, cards, tips]) if (r.error) throw r.error

  return {
    cities: ((cities.data ?? []) as unknown as CityRow[]).flatMap((c) => {
      const country = toCountry(c.region?.country)
      return country ? [{ slug: c.slug, name: text(c.name_i18n, locale) || c.slug, country, timezone: c.timezone }] : []
    }),
    scenic: ((scenic.data ?? []) as unknown as ScenicRow[])
      .filter((r) => r.status === 'published')
      .flatMap((r) => toScenicCard(r, locale) ?? [])
      .sort((a, b) => (a.slug < b.slug ? -1 : a.slug > b.slug ? 1 : 0)),
    cards: ((cards.data ?? []) as unknown as CardRow[]).map((k) => ({
      name: k.name,
      city: k.city?.slug ?? null,
      cityName: k.city ? text(k.city.name_i18n, locale) || k.city.slug : null,
      contactless: k.contactless,
      howTo: text(k.how_to_i18n, locale),
      caps: text(k.caps_i18n, locale),
      officialUrl: k.official_url,
      verifiedAt: k.verified_at,
    })),
    tips: text((tips.data as { body_i18n: Json } | null)?.body_i18n, locale) || null,
  }
}

/** `/transport` content, cached under the `transport` tag. */
export function getTransport(locale: Locale): Promise<TransportContent> {
  return cachedContent(['transport', locale], 'transport', () => loadTransport(createPublicClient(), locale))()
}

// ---- route explorer ----------------------------------------------------------------------

type SummaryRow = {
  end_to_end_min: number | null
  headway_peak_min: number | null
  headway_offpeak_min: number | null
  fare_min: number | string | null
  fare_max: number | string | null
}

type LineRow = {
  mode: TransitMode
  short_name: string | null
  long_name: string | null
  // One-to-one embed: PostgREST returns an object, but tolerate a one-element array too.
  summary: SummaryRow | SummaryRow[] | null
  stops: { seq: number; stop: { name: string } | null }[] | null
}

const MODE_ORDER: readonly TransitMode[] = Constants.public.Enums.transit_mode
const byName = new Intl.Collator('en', { numeric: true, sensitivity: 'base' })

export function compareLines(a: CityLine, b: CityLine): number {
  return (
    MODE_ORDER.indexOf(a.mode) - MODE_ORDER.indexOf(b.mode) ||
    byName.compare(a.short_name ?? a.long_name ?? '', b.short_name ?? b.long_name ?? '')
  )
}

export function toCityLine(row: LineRow): CityLine {
  const s = (Array.isArray(row.summary) ? row.summary[0] : row.summary) ?? null
  return {
    short_name: row.short_name,
    long_name: row.long_name,
    mode: row.mode,
    stops: [...(row.stops ?? [])].sort((a, b) => a.seq - b.seq).flatMap((r) => (r.stop ? [r.stop.name] : [])),
    end_to_end_min: s?.end_to_end_min ?? null,
    headway_peak_min: s?.headway_peak_min ?? null,
    headway_offpeak_min: s?.headway_offpeak_min ?? null,
    fare_min: num(s?.fare_min),
    fare_max: num(s?.fare_max),
  }
}

/**
 * Lines of a published city (optionally one mode) with their stops in order and the editorial service summary.
 * A line with no `line_service_summary` row is still listed, with null figures. Null when the city is unknown.
 */
export async function loadCityLines(client: Client, citySlug: string, mode?: TransitMode): Promise<{ lines: CityLine[] } | null> {
  const { data: city, error } = await client.from('cities').select('id').eq('slug', citySlug).eq('status', 'published').maybeSingle()
  if (error) throw error
  if (!city) return null

  let q = client
    .from('transit_lines')
    .select(
      'id, mode, short_name, long_name, ' +
        'summary:line_service_summary(end_to_end_min, headway_peak_min, headway_offpeak_min, fare_min, fare_max), ' +
        'stops:line_stops(seq, stop:transit_stops(name))',
    )
    .eq('city_id', (city as { id: number }).id)
  if (mode) q = q.eq('mode', mode)
  const { data, error: linesError } = await q.order('id')
  if (linesError) throw linesError

  return { lines: ((data ?? []) as unknown as LineRow[]).map(toCityLine).sort(compareLines) }
}

/** Route explorer lines for one city, cached under the `transport` tag for a day. */
export function getCityLines(citySlug: string, mode?: TransitMode): Promise<{ lines: CityLine[] } | null> {
  return cachedContent(['transit-lines', citySlug, mode ?? 'all'], 'transport', () => loadCityLines(createPublicClient(), citySlug, mode), 86400)()
}

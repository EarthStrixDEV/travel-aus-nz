import { encodeCursor, type Cursor } from '@/lib/api/cursor'
import type { Locale } from '@/lib/i18n/t'
import type { Json } from '@/lib/supabase/database.types'
import { toCountry, toMedia, text, type Client, type Country, type MediaRef, type TransitMode } from './shared'

export type JourneyLeg = {
  seq: number
  day: number
  mode: TransitMode
  from: string
  to: string
  operator: string | null
  durationMin: number | null
  frequency: string | null
}

export type JourneyCard = {
  slug: string
  country: Country | null
  title: string
  line: string
  from: string
  to: string
  days: number | null
  priceFrom: number | null
  currency: string | null
  modes: TransitMode[]
  image: MediaRef | null
}

export type JourneyDetail = JourneyCard & { itinerary: { day: number; legs: JourneyLeg[] }[] }

export const JOURNEY_SELECT =
  'id, slug, kind, country, title_i18n, line_i18n, from_name, to_name, days, price_from, currency, modes, cover:media_assets(path, alt_i18n)'

export const LEG_SELECT = 'seq, day, mode, from_name, to_name, operator, duration_min, frequency_text'

type JourneyRow = {
  slug: string
  country: string | null
  title_i18n: Json | null
  line_i18n: Json | null
  from_name: string | null
  to_name: string | null
  days: number | null
  price_from: number | null
  currency: string | null
  modes: TransitMode[] | null
  cover: { path: string; alt_i18n: Json | null } | null
}

type LegRow = {
  seq: number
  day: number | null
  mode: TransitMode
  from_name: string | null
  to_name: string | null
  operator: string | null
  duration_min: number | null
  frequency_text: string | null
}

export function toJourneyCard(row: JourneyRow, locale: Locale): JourneyCard {
  return {
    slug: row.slug,
    country: toCountry(row.country),
    title: text(row.title_i18n, locale),
    line: text(row.line_i18n, locale),
    from: row.from_name ?? '',
    to: row.to_name ?? '',
    days: row.days,
    priceFrom: row.price_from === null ? null : Number(row.price_from),
    currency: row.currency,
    modes: row.modes ?? [],
    image: toMedia(row.cover, locale),
  }
}

export function toLegs(rows: LegRow[] | null | undefined): JourneyLeg[] {
  return [...(rows ?? [])]
    .sort((a, b) => a.seq - b.seq)
    .map((l) => ({
      seq: l.seq,
      day: l.day ?? 1,
      mode: l.mode,
      from: l.from_name ?? '',
      to: l.to_name ?? '',
      operator: l.operator,
      durationMin: l.duration_min,
      frequency: l.frequency_text,
    }))
}

export async function listJourneys(
  client: Client,
  locale: Locale,
  opts: { country?: Country; modes?: TransitMode[]; cursor?: Cursor; limit: number },
): Promise<{ items: JourneyCard[]; nextCursor: string | null }> {
  let q = client.from('journeys').select(JOURNEY_SELECT).eq('status', 'published').eq('kind', 'itinerary')
  if (opts.country) q = q.eq('country', opts.country === 'au' ? 'AU' : 'NZ')
  if (opts.modes?.length) q = q.overlaps('modes', opts.modes)
  if (opts.cursor) q = q.gt('slug', String(opts.cursor.sort))
  const { data, error } = await q.order('slug').limit(opts.limit + 1)
  if (error) throw error

  const rows = (data ?? []) as unknown as (JourneyRow & { id: string })[]
  const page = rows.slice(0, opts.limit)
  const last = page[page.length - 1]
  return {
    items: page.map((r) => toJourneyCard(r, locale)),
    nextCursor: rows.length > opts.limit && last ? encodeCursor({ sort: last.slug, id: last.id }) : null,
  }
}

export async function getJourneyDetail(client: Client, locale: Locale, slug: string): Promise<JourneyDetail | null> {
  const { data, error } = await client
    .from('journeys')
    .select(`${JOURNEY_SELECT}, legs:journey_legs(${LEG_SELECT})`)
    .eq('slug', slug)
    .eq('status', 'published')
    .maybeSingle()
  if (error) throw error
  if (!data) return null

  const row = data as unknown as JourneyRow & { legs: LegRow[] }
  const legs = toLegs(row.legs)
  const days = new Map<number, JourneyLeg[]>()
  for (const leg of legs) days.set(leg.day, [...(days.get(leg.day) ?? []), leg])
  return {
    ...toJourneyCard(row, locale),
    itinerary: [...days.entries()].sort(([a], [b]) => a - b).map(([day, l]) => ({ day, legs: l })),
  }
}

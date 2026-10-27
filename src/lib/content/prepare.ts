import { cachedContent } from '@/lib/content/cache'
import type { Locale } from '@/lib/i18n/t'
import {
  MOMENTS,
  SEASONS,
  type AirportTransfers,
  type ChecklistTemplate,
  type Moment,
  type PrepareData,
  type RegionMonths,
  type Season,
  type TitledItem,
} from '@/lib/prepare/data'
import type { Json } from '@/lib/supabase/database.types'
import { createPublicClient } from '@/lib/supabase/public'
import { text, toCountry, type Client } from './shared'

export type { PrepareData } from '@/lib/prepare/data'

const num = (v: number | string | null | undefined): number | null => (v === null || v === undefined || v === '' ? null : Number(v))

/**
 * `content_blocks.{facts,health}.body_i18n` is `{ en: [{ title, text, icon? }], th: [...] }`. The shipped `{}`
 * (or anything unreadable) yields no items; malformed entries are skipped.
 */
export function parseTitledItems(body: Json | null | undefined, locale: Locale): TitledItem[] {
  const map = body && typeof body === 'object' && !Array.isArray(body) ? (body as Record<string, unknown>) : {}
  const raw = map[locale] ?? map.en
  if (!Array.isArray(raw)) return []
  return raw.flatMap((x) => {
    const o = x as { title?: unknown; text?: unknown; icon?: unknown } | null
    if (!o || typeof o.title !== 'string' || typeof o.text !== 'string') return []
    return [{ title: o.title, text: o.text, ...(typeof o.icon === 'string' ? { icon: o.icon } : {}) }]
  })
}

type RegionRow = {
  slug: string
  name_i18n: Json
  country: string
  best_months: number[] | null
  featured_rank: number | null
  status: string
  months: { month: number; comfort: number | null; crowds: number | null; recommended: boolean | null }[] | null
}

type TransferRow = {
  airport_code: string | null
  option_name: string | null
  mode: string | null
  duration_min: number | null
  fare_min: number | string | null
  fare_max: number | string | null
  currency: string | null
  verified_at: string | null
  city: { slug: string; name_i18n: Json; region: { country: string } | null } | null
}

function toRegion(r: RegionRow, locale: Locale): RegionMonths | null {
  const country = toCountry(r.country)
  if (!country || !r.months?.length) return null
  const byMonth = new Map(r.months.map((m) => [m.month, m]))
  return {
    slug: r.slug,
    name: text(r.name_i18n, locale),
    country,
    bestMonths: r.best_months ?? [],
    months: Array.from({ length: 12 }, (_, i) => {
      const m = byMonth.get(i + 1)
      return m ? { comfort: m.comfort, crowds: m.crowds, recommended: !!m.recommended } : null
    }),
  }
}

/** Airport options grouped by airport code, in first-seen order. */
function groupTransfers(rows: TransferRow[], locale: Locale): AirportTransfers[] {
  const out = new Map<string, AirportTransfers>()
  for (const r of rows) {
    if (!r.airport_code) continue
    const g =
      out.get(r.airport_code) ??
      {
        airport: r.airport_code,
        country: toCountry(r.city?.region?.country),
        city: r.city ? { slug: r.city.slug, name: text(r.city.name_i18n, locale) } : null,
        options: [],
      }
    out.set(r.airport_code, g)
    g.options.push({
      name: r.option_name ?? '',
      mode: r.mode,
      durationMin: r.duration_min,
      fareMin: num(r.fare_min),
      fareMax: num(r.fare_max),
      currency: r.currency,
      verified: r.verified_at !== null,
    })
  }
  return [...out.values()]
}

/** Everything `/prepare` reads (spec §12), all countries at once: the AU / NZ / Both tab filters on the client. */
export async function loadPrepare(client: Client, locale: Locale): Promise<PrepareData> {
  const [templates, regions, packing, blocks, connectivity, transfers] = await Promise.all([
    client.from('checklist_templates').select('id, moment, title_i18n, note_i18n, applies_to, sort').order('sort').order('id'),
    client
      .from('regions')
      .select('slug, name_i18n, country, best_months, featured_rank, status, months:region_months(month, comfort, crowds, recommended)')
      .eq('status', 'published')
      .order('featured_rank', { ascending: true, nullsFirst: false }),
    client.from('packing_items').select('id, season, grp, title_i18n, sort').order('sort').order('id'),
    client.from('content_blocks').select('key, body_i18n').in('key', ['facts', 'health']),
    client.from('connectivity_options').select('id, name_i18n, setup_i18n, cost_text, best_i18n, watch_i18n, verified_at').order('id'),
    client
      .from('airport_transfers')
      .select('airport_code, option_name, mode, duration_min, fare_min, fare_max, currency, verified_at, city:cities(slug, name_i18n, region:regions(country))')
      .order('airport_code')
      .order('duration_min'),
  ])
  for (const r of [templates, regions, packing, blocks, connectivity, transfers]) if (r.error) throw r.error

  const block = (key: string) => (blocks.data ?? []).find((b) => b.key === key)?.body_i18n

  return {
    templates: (templates.data ?? []).flatMap((r): ChecklistTemplate[] => {
      if (!(MOMENTS as readonly string[]).includes(r.moment)) return []
      const appliesTo = (r.applies_to ?? ['AU', 'NZ']).flatMap((c) => toCountry(c) ?? [])
      return [{ id: r.id, moment: r.moment as Moment, title: text(r.title_i18n, locale), note: text(r.note_i18n, locale), appliesTo }]
    }),
    regions: ((regions.data ?? []) as unknown as RegionRow[]).filter((r) => r.status === 'published').flatMap((r) => toRegion(r, locale) ?? []),
    packing: (packing.data ?? []).flatMap((r) =>
      r.season && (SEASONS as readonly string[]).includes(r.season)
        ? [{ id: r.id, season: r.season as Season, group: r.grp ?? '', title: text(r.title_i18n, locale) }]
        : [],
    ),
    facts: parseTitledItems(block('facts'), locale),
    health: parseTitledItems(block('health'), locale),
    connectivity: (connectivity.data ?? []).map((c) => ({
      id: c.id,
      name: text(c.name_i18n, locale),
      setup: text(c.setup_i18n, locale),
      cost: c.cost_text,
      best: text(c.best_i18n, locale),
      watch: text(c.watch_i18n, locale),
      verified: c.verified_at !== null,
    })),
    transfers: groupTransfers((transfers.data ?? []) as unknown as TransferRow[], locale),
  }
}

/** `/prepare` content, cached under the `prepare` tag. */
export function getPrepare(locale: Locale): Promise<PrepareData> {
  return cachedContent(['prepare', locale], 'prepare', () => loadPrepare(createPublicClient(), locale))()
}

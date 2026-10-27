import { JOURNEY_SELECT, toJourneyCard, type JourneyCard } from '@/lib/content/journeys'
import { asI18n, text, type Client } from '@/lib/content/shared'
import { ewkbToGeometry, geometryBbox } from '@/lib/content/geo'
import type { Locale } from '@/lib/i18n/t'
import type { Json } from '@/lib/supabase/database.types'
import { routeCacheKey, type RouteCache } from './cache'
import { applyFares, type AgencyRow, type CardRow, type FareRuleRow } from './fares'
import type { RoutingProvider } from './provider'
import type { Point, RouteOption, TransitMode } from './types'

export type PlanInput = {
  /** Place slug or `lat,lng`. */
  from: string
  to: string
  /** City-local `YYYY-MM-DDTHH:mm`. */
  depart: string
  modes?: TransitMode[]
  stepFree?: boolean
  locale?: Locale
}

export type PlanDeps = { provider: RoutingProvider; db: Client; cache: RouteCache; now?: () => Date }

export type PlanResult =
  | { options: RouteOption[] }
  | { error: 'ROUTING_UNAVAILABLE'; message: string; fallback: JourneyCard | null }
  | { error: 'NOT_FOUND'; message: string }

const DEFAULT_TIMEZONE = 'Australia/Sydney'
const STEP_FREE_RADIUS_M = 75

// ---- points ------------------------------------------------------------------------------

/** Rough boxes around mainland AU + Tasmania and the NZ main islands. */
const ENVELOPES: [minLat: number, maxLat: number, minLng: number, maxLng: number][] = [
  [-44, -10, 112, 154],
  [-48, -34, 166, 179],
]

/** `"lat,lng"` inside the AU/NZ envelopes → Point; anything else → null. */
export function parsePointParam(s: string): Point | null {
  const m = /^\s*(-?\d{1,2}(?:\.\d+)?)\s*,\s*(-?\d{1,3}(?:\.\d+)?)\s*$/.exec(s)
  if (!m) return null
  const lat = Number(m[1])
  const lng = Number(m[2])
  return ENVELOPES.some(([a, b, c, d]) => lat >= a && lat <= b && lng >= c && lng <= d) ? { lat, lng } : null
}

function haversineM(a: Point, b: Point): number {
  const rad = (d: number) => (d * Math.PI) / 180
  const dLat = rad(b.lat - a.lat)
  const dLng = rad(b.lng - a.lng)
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2
  return 2 * 6371000 * Math.asin(Math.sqrt(h))
}

const pointFromEwkb = (hex: string | null | undefined): Point | null => {
  const g = ewkbToGeometry(hex)
  return g?.type === 'Point' ? { lat: g.coordinates[1], lng: g.coordinates[0] } : null
}

// ---- time --------------------------------------------------------------------------------

/** Offset of `tz` from UTC at `at`, in ms (positive east of Greenwich). */
function tzOffsetMs(tz: string, at: number): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: tz,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).formatToParts(new Date(at))
  const n = (type: string) => Number(parts.find((p) => p.type === type)?.value)
  const wall = Date.UTC(n('year'), n('month') - 1, n('day'), n('hour'), n('minute'), n('second'))
  return wall - (at - (at % 1000))
}

/** City-local `YYYY-MM-DDTHH:mm` in `tz` → UTC instant. A time skipped by a DST jump resolves to the post-jump offset. */
export function localToUtc(local: string, tz: string): Date {
  const [date, hm] = local.split('T')
  const [y, mo, d] = date.split('-').map(Number)
  const [h, mi] = hm.split(':').map(Number)
  const wall = Date.UTC(y, mo - 1, d, h, mi)
  const first = wall - tzOffsetMs(tz, wall)
  const second = tzOffsetMs(tz, first)
  return new Date(wall - second)
}

const QUARTER_MS = 15 * 60 * 1000
export const floorTo15 = (d: Date): Date => new Date(Math.floor(d.getTime() / QUARTER_MS) * QUARTER_MS)

// ---- data --------------------------------------------------------------------------------

type Endpoint = { point: Point; label: string; names: string[]; timezone: string | null }

async function resolveEndpoint(db: Client, raw: string, locale: Locale): Promise<Endpoint | null> {
  const point = parsePointParam(raw)
  if (point) return { point, label: raw, names: [], timezone: null }

  const { data, error } = await db
    .from('places')
    .select('slug, name_i18n, geom, city:cities(timezone)')
    .eq('slug', raw)
    .eq('status', 'published')
    .maybeSingle()
  if (error) throw error
  if (!data) return null
  const row = data as unknown as { slug: string; name_i18n: Json; geom: string; city: { timezone: string } | null }
  const at = pointFromEwkb(row.geom)
  if (!at) return null
  const names = Object.values(asI18n(row.name_i18n)).filter((v): v is string => typeof v === 'string' && v !== '')
  return { point: at, label: text(row.name_i18n, locale) || row.slug, names, timezone: row.city?.timezone ?? null }
}

/** Timezone of the published city whose bbox contains `p`, or null. */
async function cityTimezoneAt(db: Client, p: Point): Promise<string | null> {
  const { data, error } = await db.from('cities').select('timezone, bbox').eq('status', 'published')
  if (error) throw error
  for (const c of (data ?? []) as unknown as { timezone: string; bbox: string | null }[]) {
    const g = ewkbToGeometry(c.bbox)
    const b = g ? geometryBbox(g) : null
    if (b && p.lng >= b[0] && p.lat >= b[1] && p.lng <= b[2] && p.lat <= b[3]) return c.timezone
  }
  return null
}

async function withFares(db: Client, options: RouteOption[], departLocal: string): Promise<RouteOption[]> {
  const [rules, agencies, cards] = await Promise.all([
    db.from('fare_rules').select('agency_id, mode, rule'),
    db.from('transit_agencies').select('id, name, country, card_id'),
    db.from('transit_cards').select('id, name, contactless'),
  ])
  for (const r of [rules, agencies, cards]) if (r.error) throw r.error
  return applyFares(
    options,
    (rules.data ?? []) as FareRuleRow[],
    (agencies.data ?? []) as AgencyRow[],
    (cards.data ?? []) as CardRow[],
    departLocal,
  )
}

/**
 * Keeps options whose every transit leg boards and alights within 75 m of a `step_free = true`
 * stop (plan Deviation 1). Unknown stops count as not step-free. No PostGIS RPC exists for this,
 * so step-free stops are fetched once and matched with haversine here.
 */
async function filterStepFree(db: Client, options: RouteOption[]): Promise<RouteOption[]> {
  if (options.length === 0) return options
  const { data, error } = await db.from('transit_stops').select('geom').eq('step_free', true)
  if (error) throw error
  const stops = ((data ?? []) as { geom: string }[]).map((s) => pointFromEwkb(s.geom)).filter((p): p is Point => p !== null)
  const ok = (p: Point | undefined) => !!p && stops.some((s) => haversineM(p, s) <= STEP_FREE_RADIUS_M)
  return options.filter((o) => o.legs.every((l) => l.mode === 'walk' || (ok(l.board) && ok(l.alight))))
}

/** A published journey whose from/to names equal (case-insensitive) one of the resolved place names. */
async function findFallback(db: Client, from: string[], to: string[], locale: Locale): Promise<JourneyCard | null> {
  if (from.length === 0 || to.length === 0) return null
  const norm = (s: string | null) => (s ?? '').trim().toLowerCase()
  const fromSet = new Set(from.map(norm))
  const toSet = new Set(to.map(norm))
  const { data, error } = await db.from('journeys').select(JOURNEY_SELECT).eq('status', 'published')
  if (error) {
    console.error('[routing] fallback journey lookup failed', error)
    return null
  }
  type Row = Parameters<typeof toJourneyCard>[0]
  const hit = ((data ?? []) as unknown as Row[]).find((j) => fromSet.has(norm(j.from_name)) && toSet.has(norm(j.to_name)))
  return hit ? toJourneyCard(hit, locale) : null
}

/** The provider leaves the outermost walk ends unnamed; label them with what the user searched for. */
function labelEnds(o: RouteOption, from: string, to: string): RouteOption {
  const legs = o.legs.map((l, i) => ({
    ...l,
    from: i === 0 && !l.from ? from : l.from,
    to: i === o.legs.length - 1 && !l.to ? to : l.to,
  }))
  return { ...o, legs }
}

// ---- entry -------------------------------------------------------------------------------

/**
 * §7 routing flow. Cache key is from/to + 15-minute bucket only; `modes` and `stepFree` filter
 * after the cache so they never cost an upstream call. Cached options already carry fares/cards.
 */
export async function planRoute(input: PlanInput, deps: PlanDeps): Promise<PlanResult> {
  const locale = input.locale ?? 'th'
  const [from, to] = await Promise.all([resolveEndpoint(deps.db, input.from, locale), resolveEndpoint(deps.db, input.to, locale)])
  if (!from) return { error: 'NOT_FOUND', message: `Unknown place: ${input.from}` }
  if (!to) return { error: 'NOT_FOUND', message: `Unknown place: ${input.to}` }

  const tz = from.timezone ?? (await cityTimezoneAt(deps.db, from.point)) ?? DEFAULT_TIMEZONE
  const bucket = floorTo15(localToUtc(input.depart, tz))
  const key = routeCacheKey(from.point, to.point, bucket)

  let options = await deps.cache.get(key)
  if (!options) {
    // Flooring can put the bucket a few minutes in the past; ask upstream for "now" instead.
    const now = deps.now?.() ?? new Date()
    let raw: RouteOption[]
    try {
      raw = await deps.provider.plan({ from: from.point, to: to.point, departUtc: bucket < now ? now : bucket })
    } catch (err) {
      // Any provider failure (RoutingUnavailable or an unexpected mapping error) is a 503, never a 500.
      console.error(`[routing] ${deps.provider.name} unavailable`, err)
      return {
        error: 'ROUTING_UNAVAILABLE',
        message: 'Route planning is temporarily unavailable',
        fallback: await findFallback(deps.db, from.names, to.names, locale),
      }
    }
    options = await withFares(deps.db, raw, input.depart)
    await deps.cache.set(key, options)
  }

  const modes = input.modes ?? []
  if (modes.length) options = options.filter((o) => o.legs.every((l) => l.mode === 'walk' || modes.includes(l.mode)))
  if (input.stepFree) options = await filterStepFree(deps.db, options)
  return { options: options.map((o) => labelEnds(o, from.label, to.label)) }
}

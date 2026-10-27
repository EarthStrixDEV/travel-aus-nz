import { ewkbToGeometry } from '@/lib/content/geo'
import { text, type Client, type TransitMode } from '@/lib/content/shared'
import type { PlanInput, PlanResult } from '@/lib/routing/plan'
import type { Json } from '@/lib/supabase/database.types'

/**
 * Leg recompute (spec §13 / §15 `leg-recompute`, plan deviation 5). A leg is computed from the stop before it:
 * depart = that stop's time (09:00 when unset) + a 60-minute stay, on the day's date. Short hops are walked
 * without a routing call; otherwise the fastest routed option wins, and a walk-only option of 15 min or less
 * is recorded as `walk`. Three failures in a row leave the leg `failed` (the UI offers a retry).
 */

export const STAY_MIN = 60
export const DEFAULT_TIME = '09:00'
/** Straight-line distance under which a leg is walked without asking the router. */
export const WALK_STRAIGHT_MAX_M = 1200
/** ~4.8 km/h. */
export const WALK_M_PER_MIN = 80
export const WALK_PREFERRED_MAX_MIN = 15
export const MAX_ATTEMPTS = 3

export type LegEnd = { name: string; lng: number; lat: number }
export type LegJob = { fromStop: string; toStop: string; attempts: number; from: LegEnd; to: LegEnd; date: string | null; fromTime: string | null }
export type LegUpdate = {
  mode: TransitMode | null
  duration_min: number | null
  summary: string | null
  fare_min: number | null
  fare_max: number | null
  status: 'ok' | 'failed' | 'stale'
  attempts: number
  computed_at: string
}

export type Planner = (input: PlanInput) => Promise<PlanResult>

export function haversineM(a: { lng: number; lat: number }, b: { lng: number; lat: number }): number {
  const R = 6_371_000
  const rad = (d: number) => (d * Math.PI) / 180
  const dLat = rad(b.lat - a.lat)
  const dLng = rad(b.lng - a.lng)
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(h))
}

/** City-local `YYYY-MM-DDTHH:mm` for leaving the previous stop. Undated days use `today` (UTC date). */
export function departFor(job: Pick<LegJob, 'date' | 'fromTime'>, today: Date): string {
  const date = job.date ?? today.toISOString().slice(0, 10)
  const [h, m] = (job.fromTime ?? DEFAULT_TIME).slice(0, 5).split(':').map(Number)
  // Naive wall-clock arithmetic in UTC so a late stop rolls over to the next date.
  const at = new Date(`${date}T00:00:00Z`)
  at.setUTCMinutes(h * 60 + m + STAY_MIN)
  return at.toISOString().slice(0, 16)
}

const point = (e: LegEnd) => `${e.lat.toFixed(6)},${e.lng.toFixed(6)}`

/** One leg -> the row update. Never throws: a planner error counts as a failed attempt. */
export async function recomputeLeg(job: LegJob, plan: Planner, now: Date): Promise<LegUpdate> {
  const computed_at = now.toISOString()
  const metres = haversineM(job.from, job.to)
  if (metres <= WALK_STRAIGHT_MAX_M) {
    const min = Math.max(1, Math.ceil(metres / WALK_M_PER_MIN))
    return { mode: 'walk', duration_min: min, summary: `${job.from.name} → ${job.to.name}, ${min} min`, fare_min: null, fare_max: null, status: 'ok', attempts: 0, computed_at }
  }

  const attempts = job.attempts + 1
  const failure: LegUpdate = {
    mode: null,
    duration_min: null,
    summary: null,
    fare_min: null,
    fare_max: null,
    status: attempts >= MAX_ATTEMPTS ? 'failed' : 'stale',
    attempts,
    computed_at,
  }
  let result: PlanResult
  try {
    result = await plan({ from: point(job.from), to: point(job.to), depart: departFor(job, now) })
  } catch {
    return failure
  }
  if (!('options' in result) || result.options.length === 0) return failure

  const best = [...result.options].sort((a, b) => a.duration_min - b.duration_min)[0]
  const transit = best.legs.find((l) => l.mode !== 'walk')
  if (!transit) {
    const min = best.duration_min
    if (min > WALK_PREFERRED_MAX_MIN) return failure
    return { mode: 'walk', duration_min: min, summary: `${job.from.name} → ${job.to.name}, ${min} min`, fare_min: null, fare_max: null, status: 'ok', attempts: 0, computed_at }
  }
  return {
    mode: transit.mode,
    duration_min: best.duration_min,
    summary: `${transit.from} → ${transit.to}, ${best.duration_min} min`,
    fare_min: best.fare_min,
    fare_max: best.fare_max,
    status: 'ok',
    attempts: 0,
    computed_at,
  }
}

// ---- database ----------------------------------------------------------------------------

type EndRow = { slug: string; name_i18n: Json; geom: string | null } | null
type JobRow = {
  from_stop: string
  to_stop: string
  attempts: number
  from: { time: string | null; day: { date: string | null; trip_id: string } | null; place: EndRow } | null
  to: { place: EndRow } | null
}

const JOB_SELECT =
  'from_stop, to_stop, attempts, ' +
  'from:trip_stops!trip_legs_from_stop_fkey(time, day:trip_days(date, trip_id), place:places(slug, name_i18n, geom)), ' +
  'to:trip_stops!trip_legs_to_stop_fkey(place:places(slug, name_i18n, geom))'

function toEnd(p: EndRow): LegEnd | null {
  const g = p ? ewkbToGeometry(p.geom) : null
  if (!p || g?.type !== 'Point') return null
  // Summaries are stored once for every reader, so they use the English name.
  return { name: text(p.name_i18n, 'en') || p.slug, lng: g.coordinates[0], lat: g.coordinates[1] }
}

export type RecomputeSummary = { checked: number; ok: number; failed: number }

/**
 * Recomputes `stale` legs: one trip's (right after a change, from `after()`), or every trip's older than
 * `olderThanMs` (the cron sweep). Runs on the service client; writes only `trip_legs`.
 */
export async function recomputeStaleLegs(
  db: Client,
  plan: Planner,
  opts: { tripId?: string; olderThanMs?: number; limit?: number; now?: Date } = {},
): Promise<RecomputeSummary> {
  const now = opts.now ?? new Date()
  let q = db.from('trip_legs').select(JOB_SELECT).eq('status', 'stale')
  if (opts.olderThanMs !== undefined) {
    q = q.or(`computed_at.is.null,computed_at.lt.${new Date(now.getTime() - opts.olderThanMs).toISOString()}`)
  }
  const { data, error } = await q.limit(opts.tripId ? 500 : (opts.limit ?? 50))
  if (error) throw error

  const summary: RecomputeSummary = { checked: 0, ok: 0, failed: 0 }
  for (const row of (data ?? []) as unknown as JobRow[]) {
    if (opts.tripId && row.from?.day?.trip_id !== opts.tripId) continue
    const from = toEnd(row.from?.place ?? null)
    const to = toEnd(row.to?.place ?? null)
    if (!from || !to) continue
    summary.checked++
    const update = await recomputeLeg(
      { fromStop: row.from_stop, toStop: row.to_stop, attempts: row.attempts, from, to, date: row.from?.day?.date ?? null, fromTime: row.from?.time ?? null },
      plan,
      now,
    )
    // Only overwrite a leg that is still stale: a concurrent edit may have reset it meanwhile.
    const { error: writeError } = await db.from('trip_legs').update(update).eq('from_stop', row.from_stop).eq('to_stop', row.to_stop).eq('status', 'stale')
    if (writeError) throw writeError
    if (update.status === 'ok') summary.ok++
    else if (update.status === 'failed') summary.failed++
  }
  return summary
}

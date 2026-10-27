import type { Client, TransitMode } from '@/lib/content/shared'
import type { Locale } from '@/lib/i18n/t'
import { loadDays } from './load'

/** Read-only shared trip (spec §13 `GET /shared/:token`). Deliberately narrow: no ids, owner or notes. */
export type SharedTrip = {
  title: string
  startDate: string | null
  endDate: string | null
  days: {
    dayNo: number
    date: string | null
    title: string
    offMap: boolean
    transitMin: number
    stops: {
      time: string | null
      place: { slug: string; name: string; type: string; area: string }
      leg: { mode: TransitMode | null; durationMin: number | null; summary: string | null } | null
    }[]
  }[]
}

export const SHARE_TOKEN = /^[0-9a-f]{32}$/

/**
 * Resolves a live share token (not revoked, trip not deleted) to the shared view. `db` is the service client:
 * the visitor has no session, so the token check here is the only gate, and the payload is built field by field.
 */
export async function loadSharedTrip(db: Client, token: string, locale: Locale): Promise<SharedTrip | null> {
  if (!SHARE_TOKEN.test(token)) return null
  const { data: share, error } = await db
    .from('trip_shares')
    .select('trip:trips!inner(id, title, start_date, end_date, deleted_at)')
    .eq('token', token)
    .is('revoked_at', null)
    .maybeSingle()
  if (error) throw error
  const trip = (share as { trip: { id: string; title: string; start_date: string | null; end_date: string | null; deleted_at: string | null } | null } | null)?.trip
  if (!trip || trip.deleted_at) return null

  const days = await loadDays(db, trip.id, locale)
  return {
    title: trip.title,
    startDate: trip.start_date,
    endDate: trip.end_date,
    days: days.map((d) => ({
      dayNo: d.dayNo,
      date: d.date,
      title: d.title,
      offMap: d.offMap,
      transitMin: d.transitMin,
      stops: d.stops.map((s) => ({
        time: s.time,
        place: { slug: s.place.slug, name: s.place.name, type: s.place.type, area: s.place.area },
        leg: s.legToNext?.status === 'ok' ? { mode: s.legToNext.mode, durationMin: s.legToNext.durationMin, summary: s.legToNext.summary } : null,
      })),
    })),
  }
}

/** The trip's live token, creating one when there is none. Session client: RLS limits it to the owner. */
export async function ensureShareToken(db: Client, tripId: string): Promise<string> {
  const { data: live, error } = await db.from('trip_shares').select('token').eq('trip_id', tripId).is('revoked_at', null).limit(1).maybeSingle()
  if (error) throw error
  if (live) return live.token
  const { data, error: insertError } = await db.from('trip_shares').insert({ trip_id: tripId }).select('token').single()
  if (insertError) throw insertError
  return data.token
}

export async function revokeShares(db: Client, tripId: string, now = new Date()): Promise<void> {
  const { error } = await db.from('trip_shares').update({ revoked_at: now.toISOString() }).eq('trip_id', tripId).is('revoked_at', null)
  if (error) throw error
}

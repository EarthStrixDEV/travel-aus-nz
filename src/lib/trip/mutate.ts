import { NotFound } from '@/lib/api/session'
import type { Client } from '@/lib/content/shared'

/**
 * Writes for My Trip through the user's session client. Ownership is enforced twice: RLS hides other users'
 * rows, and every lookup here also checks `trips.user_id` and `deleted_at`, so a foreign id is "not found".
 * Positions and legs are kept consistent by the `normalize_trip_day` / `move_trip_stop` functions.
 */

export type OwnedStop = { id: string; dayId: string; tripId: string; placeId: string }

export async function ownedDay(db: Client, userId: string, tripId: string, dayNo: number): Promise<string> {
  const { data, error } = await db
    .from('trip_days')
    .select('id, trip:trips!inner(user_id, deleted_at)')
    .eq('trip_id', tripId)
    .eq('day_no', dayNo)
    .maybeSingle()
  if (error) throw error
  const trip = (data as { trip: { user_id: string; deleted_at: string | null } | null } | null)?.trip
  if (!data || !trip || trip.user_id !== userId || trip.deleted_at) throw new NotFound()
  return data.id
}

export async function ownedStop(db: Client, userId: string, stopId: string): Promise<OwnedStop> {
  const { data, error } = await db
    .from('trip_stops')
    .select('id, day_id, place_id, day:trip_days!inner(trip_id, trip:trips!inner(user_id, deleted_at))')
    .eq('id', stopId)
    .maybeSingle()
  if (error) throw error
  type Row = { id: string; day_id: string; place_id: string; day: { trip_id: string; trip: { user_id: string; deleted_at: string | null } | null } | null }
  const row = data as Row | null
  if (!row?.day?.trip || row.day.trip.user_id !== userId || row.day.trip.deleted_at) throw new NotFound()
  return { id: row.id, dayId: row.day_id, tripId: row.day.trip_id, placeId: row.place_id }
}

async function normalize(db: Client, dayId: string) {
  const { error } = await db.rpc('normalize_trip_day', { p_day: dayId })
  if (error) throw error
}

/** Appends a published place to a day; the new leg(s) start `stale`. */
export async function addStop(db: Client, dayId: string, input: { place_id: string; time?: string; note?: string }): Promise<string> {
  const { data: place, error: placeError } = await db.from('places').select('id').eq('id', input.place_id).eq('status', 'published').maybeSingle()
  if (placeError) throw placeError
  if (!place) throw new NotFound()

  const { count, error: countError } = await db.from('trip_stops').select('id', { count: 'exact', head: true }).eq('day_id', dayId)
  if (countError) throw countError
  const { data, error } = await db
    .from('trip_stops')
    .insert({ day_id: dayId, place_id: input.place_id, position: (count ?? 0) + 1, time: input.time ?? null, note: input.note ?? null })
    .select('id')
    .single()
  if (error) throw error
  await normalize(db, dayId)
  return data.id
}

/** Time / note edits and moves. A new time changes when the next leg departs, so that leg goes `stale`. */
export async function patchStop(
  db: Client,
  stop: OwnedStop,
  input: { time?: string | null; note?: string | null; day_id?: string; position?: number },
): Promise<void> {
  const fields = {
    ...(input.time !== undefined ? { time: input.time } : {}),
    ...(input.note !== undefined ? { note: input.note || null } : {}),
  }
  if (Object.keys(fields).length) {
    const { error } = await db.from('trip_stops').update(fields).eq('id', stop.id)
    if (error) throw error
  }
  if (input.time !== undefined) {
    const { error } = await db.from('trip_legs').update({ status: 'stale', attempts: 0 }).eq('from_stop', stop.id)
    if (error) throw error
  }
  if (input.position !== undefined) {
    const { error } = await db.rpc('move_trip_stop', { p_stop: stop.id, p_day: input.day_id ?? stop.dayId, p_position: input.position })
    if (error) throw error.code === 'P0002' ? new NotFound() : error
  }
}

/** Removes a stop; its place goes back to "Saved, not scheduled" (spec §13). */
export async function deleteStop(db: Client, userId: string, stop: OwnedStop): Promise<void> {
  const { error } = await db.from('trip_stops').delete().eq('id', stop.id)
  if (error) throw error
  await normalize(db, stop.dayId)
  const { error: saveError } = await db
    .from('saved_items')
    .upsert({ user_id: userId, entity_type: 'place', entity_id: stop.placeId }, { onConflict: 'user_id,entity_type,entity_id', ignoreDuplicates: true })
  if (saveError) throw saveError
}

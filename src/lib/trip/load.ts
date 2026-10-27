import { ewkbToGeometry, geometryBbox } from '@/lib/content/geo'
import { text, type Client, type TransitMode } from '@/lib/content/shared'
import type { Locale } from '@/lib/i18n/t'
import type { Json } from '@/lib/supabase/database.types'
import { isOffMap, transitMinutes, type LegStatus, type SavedPlace, type TripData, type TripDay, type TripLeg, type TripPlace, type TripSummary } from './model'

/** Reads for My Trip through the user's session client (RLS: owner only). */

type PlaceRow = {
  id: string
  slug: string
  type: string
  geom: string | null
  name_i18n: Json
  area_i18n: Json | null
  city: { slug: string; bbox: string | null; timezone: string } | null
}

type DayRow = {
  id: string
  day_no: number
  date: string | null
  title: string | null
  stops: { id: string; position: number; time: string | null; note: string | null; place: PlaceRow | null }[] | null
}

type LegRow = {
  from_stop: string
  to_stop: string
  mode: TransitMode | null
  duration_min: number | null
  summary: string | null
  fare_min: number | string | null
  fare_max: number | string | null
  status: string | null
}

const num = (v: number | string | null): number | null => (v === null || v === '' ? null : Number(v))

function toPlace(r: PlaceRow, locale: Locale): TripPlace {
  const point = ewkbToGeometry(r.geom)
  const bbox = ewkbToGeometry(r.city?.bbox)
  return {
    id: r.id,
    slug: r.slug,
    type: r.type,
    name: text(r.name_i18n, locale),
    area: text(r.area_i18n, locale),
    lng: point?.type === 'Point' ? point.coordinates[0] : null,
    lat: point?.type === 'Point' ? point.coordinates[1] : null,
    citySlug: r.city?.slug ?? null,
    cityBbox: bbox ? geometryBbox(bbox) : null,
    cityTimezone: r.city?.timezone ?? null,
  }
}

function toLeg(r: LegRow): TripLeg {
  const status: LegStatus = r.status === 'ok' || r.status === 'failed' ? r.status : 'stale'
  return { mode: r.mode, durationMin: r.duration_min, summary: r.summary, fareMin: num(r.fare_min), fareMax: num(r.fare_max), status }
}

export async function listTrips(db: Client, userId: string): Promise<TripSummary[]> {
  const { data, error } = await db
    .from('trips')
    .select('id, title, start_date, end_date')
    .eq('user_id', userId)
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
  if (error) throw error
  return (data ?? []).map((t) => ({ id: t.id, title: t.title, startDate: t.start_date, endDate: t.end_date }))
}

/** A trip's days with stops in order and each stop's leg to the next. `db` decides visibility (session or service). */
export async function loadDays(db: Client, tripId: string, locale: Locale): Promise<TripDay[]> {
  const { data: dayRows, error } = await db
    .from('trip_days')
    .select('id, day_no, date, title, stops:trip_stops(id, position, time, note, place:places(id, slug, type, geom, name_i18n, area_i18n, city:cities(slug, bbox, timezone)))')
    .eq('trip_id', tripId)
    .order('day_no')
  if (error) throw error
  const days = (dayRows ?? []) as unknown as DayRow[]

  const stopIds = days.flatMap((d) => (d.stops ?? []).map((s) => s.id))
  const { data: legs, error: legsError } = stopIds.length
    ? await db.from('trip_legs').select('from_stop, to_stop, mode, duration_min, summary, fare_min, fare_max, status').in('from_stop', stopIds)
    : { data: [] as LegRow[], error: null }
  if (legsError) throw legsError
  const legByPair = new Map(((legs ?? []) as LegRow[]).map((l) => [`${l.from_stop}>${l.to_stop}`, toLeg(l)]))

  return days.map((d) => {
    const ordered = [...(d.stops ?? [])].filter((s) => s.place).sort((a, b) => a.position - b.position)
    const stops = ordered.map((s, i) => ({
      id: s.id,
      position: s.position,
      time: s.time ? s.time.slice(0, 5) : null,
      note: s.note ?? '',
      place: toPlace(s.place!, locale),
      legToNext: ordered[i + 1] ? (legByPair.get(`${s.id}>${ordered[i + 1].id}`) ?? null) : null,
    }))
    return { id: d.id, dayNo: d.day_no, date: d.date, title: d.title ?? '', stops, transitMin: transitMinutes(stops), offMap: isOffMap(stops) }
  })
}

/** Days, legs and saved places not yet on this trip. Null when not the user's live trip. */
export async function loadTrip(db: Client, userId: string, tripId: string, locale: Locale): Promise<TripData | null> {
  const { data: trip, error } = await db
    .from('trips')
    .select('id, title, start_date, end_date')
    .eq('id', tripId)
    .eq('user_id', userId)
    .is('deleted_at', null)
    .maybeSingle()
  if (error) throw error
  if (!trip) return null

  const [days, saved] = await Promise.all([
    loadDays(db, tripId, locale),
    db.from('saved_items').select('entity_id').eq('user_id', userId).eq('entity_type', 'place').order('created_at', { ascending: false }),
  ])
  if (saved.error) throw saved.error

  const scheduled = new Set(days.flatMap((d) => d.stops.map((s) => s.place.id)))
  const unscheduledIds = (saved.data ?? []).map((s) => s.entity_id).filter((id) => !scheduled.has(id))
  let savedUnscheduled: SavedPlace[] = []
  if (unscheduledIds.length) {
    const { data: places, error: placesError } = await db
      .from('places')
      .select('id, slug, type, name_i18n, area_i18n')
      .in('id', unscheduledIds)
      .eq('status', 'published')
    if (placesError) throw placesError
    const byId = new Map((places ?? []).map((p) => [p.id, p]))
    savedUnscheduled = unscheduledIds.flatMap((id) => {
      const p = byId.get(id)
      return p ? [{ id: p.id, slug: p.slug, type: p.type, name: text(p.name_i18n, locale), area: text(p.area_i18n, locale) }] : []
    })
  }

  return { id: trip.id, title: trip.title, startDate: trip.start_date, endDate: trip.end_date, days, savedUnscheduled }
}
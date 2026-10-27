import type { Bbox } from '@/lib/content/geo'
import type { TransitMode } from '@/lib/content/shared'

/** Pure My Trip model (spec §13): shared by the page (client), the API and tests. No server imports at runtime. */

export type TripSummary = { id: string; title: string; startDate: string | null; endDate: string | null }

export type TripPlace = {
  id: string
  slug: string
  type: string
  name: string
  area: string
  lng: number | null
  lat: number | null
  citySlug: string | null
  cityBbox: Bbox | null
  /** IANA zone of the place's city (ICS export); null when the place has no city. */
  cityTimezone: string | null
}

export type LegStatus = 'stale' | 'ok' | 'failed'

export type TripLeg = {
  mode: TransitMode | null
  durationMin: number | null
  summary: string | null
  fareMin: number | null
  fareMax: number | null
  status: LegStatus
}

export type TripStop = {
  id: string
  position: number
  /** `HH:MM`, or null when unscheduled within the day. */
  time: string | null
  note: string
  place: TripPlace
  /** Leg from this stop to the next one; null on the last stop (or before normalize ran). */
  legToNext: TripLeg | null
}

export type TripDay = {
  id: string
  dayNo: number
  date: string | null
  title: string
  stops: TripStop[]
  /** Sum of the day's computed legs. */
  transitMin: number
  /** A stop lies outside the main city's bbox (spec §13: show a summary card instead of the city map). */
  offMap: boolean
}

export type SavedPlace = { id: string; slug: string; type: string; name: string; area: string }

export type TripData = TripSummary & { days: TripDay[]; savedUnscheduled: SavedPlace[] }

const inBbox = ([minLng, minLat, maxLng, maxLat]: Bbox, lng: number, lat: number) => lng >= minLng && lng <= maxLng && lat >= minLat && lat <= maxLat

/**
 * Off-map day: the day's main city is the first stop's city; any stop outside that city's bbox (or with no
 * position) means the day can't be drawn on one city map. A day with no stops, or no main-city bbox, is on-map.
 */
export function isOffMap(stops: Pick<TripStop, 'place'>[]): boolean {
  const bbox = stops[0]?.place.cityBbox
  if (!bbox) return false
  return stops.some((s) => s.place.lng === null || s.place.lat === null || !inBbox(bbox, s.place.lng, s.place.lat))
}

/** "n min in transit": computed legs only (stale / failed legs are not counted yet). */
export function transitMinutes(stops: Pick<TripStop, 'legToNext'>[]): number {
  return stops.reduce((sum, s) => sum + (s.legToNext?.status === 'ok' ? (s.legToNext.durationMin ?? 0) : 0), 0)
}

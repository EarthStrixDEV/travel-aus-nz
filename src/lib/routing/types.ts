import type { TransitMode } from '@/lib/content/shared'

export type { TransitMode }

export type Point = { lat: number; lng: number }

/** Times are ISO 8601 UTC (`2026-11-01T22:04:00.000Z`); the caller formats them in the city's timezone. */
export type RouteLeg = {
  mode: TransitMode
  from: string
  to: string
  depart: string
  arrive: string
  duration_min: number
  /** e.g. "T4 towards Bondi Junction · 4 stops" or "Walk 220 m". */
  detail: string
  /** Operator name as the provider reports it; matched to `transit_agencies.name` for fares. */
  agency?: string
  distance_m: number
  board?: Point
  alight?: Point
}

export type Currency = 'AUD' | 'NZD'

export type RouteOption = {
  depart: string
  arrive: string
  duration_min: number
  summary: string
  fare_min: number | null
  fare_max: number | null
  currency: Currency
  card: string | null
  legs: RouteLeg[]
}

/** Within the AU/NZ envelopes `plan.ts` accepts, NZ is east of 165°E and AU west of it, so longitude picks the currency. */
export const currencyAt = (p: Point): Currency => (p.lng >= 165 ? 'NZD' : 'AUD')

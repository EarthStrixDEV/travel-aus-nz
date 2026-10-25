import type { Bbox } from '@/lib/content/geo'
import type { PlaceCounts, PlaceType } from '@/lib/content/places'

/** Map layers from Map.dc.html; each is drawn with its own icon shape, never by colour alone. */
export type LayerKey = 'attraction' | 'restaurant' | 'bar' | 'transport'
export type LayerState = Record<LayerKey, boolean>

export const LAYER_TYPES: Record<LayerKey, PlaceType[]> = {
  attraction: ['attraction', 'village'],
  restaurant: ['restaurant', 'cafe'],
  bar: ['bar'],
  transport: ['station'],
}
export const LAYER_KEYS = Object.keys(LAYER_TYPES) as LayerKey[]
export const ALL_LAYERS: LayerState = { attraction: true, restaurant: true, bar: true, transport: true }

export function layerOf(type: PlaceType): LayerKey {
  return LAYER_KEYS.find((k) => LAYER_TYPES[k].includes(type)) ?? 'attraction'
}

/** `types[]` for the API: [] = every type (all layers on). */
export function typesFor(layers: LayerState): PlaceType[] {
  if (LAYER_KEYS.every((k) => layers[k])) return []
  return LAYER_KEYS.filter((k) => layers[k]).flatMap((k) => LAYER_TYPES[k])
}

export function layerCount(counts: PlaceCounts, key: LayerKey): number {
  return LAYER_TYPES[key].reduce((n, t) => n + (counts[t] ?? 0), 0)
}

/** Zoom used for "city detail": individual places (API level >= 13) and walk routes. */
export const CITY_ZOOM = 14
export const PLACES_ZOOM = 13

export const COUNTRY_BOUNDS: Record<'au' | 'nz', Bbox> = {
  au: [112.9, -43.7, 153.7, -10.6],
  nz: [166.4, -47.3, 178.6, -34.4],
}

const MAX_SPAN = 39.9

/**
 * Viewport -> a bbox the places API accepts: clamped to valid ranges, shrunk around its
 * centre to under 40 degrees, rounded outward to 3 decimals (stable CDN cache keys).
 */
export function apiBbox([w, s, e, n]: Bbox): Bbox {
  const clampSpan = (lo: number, hi: number, min: number, max: number): [number, number] => {
    lo = Math.max(min, lo)
    hi = Math.min(max, hi)
    if (hi - lo > MAX_SPAN) {
      const mid = (lo + hi) / 2
      lo = mid - MAX_SPAN / 2
      hi = mid + MAX_SPAN / 2
    }
    return [Math.max(min, Math.floor(lo * 1000) / 1000), Math.min(max, Math.ceil(hi * 1000) / 1000)]
  }
  const [minLng, maxLng] = clampSpan(w, e, -180, 180)
  const [minLat, maxLat] = clampSpan(s, n, -90, 90)
  return [minLng, minLat, maxLng, maxLat]
}

export function containsPoint([w, s, e, n]: Bbox, [lng, lat]: [number, number]): boolean {
  return lng >= w && lng <= e && lat >= s && lat <= n
}

/** Case- and accent-insensitive match for the client-side place search. */
export function matchesQuery(name: string, query: string): boolean {
  const fold = (v: string) => v.normalize('NFD').replace(/\p{M}/gu, '').toLocaleLowerCase()
  const q = fold(query.trim())
  return q === '' || fold(name).includes(q)
}

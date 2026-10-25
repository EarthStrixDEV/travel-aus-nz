import { cachedContent } from '@/lib/content/cache'
import type { Locale } from '@/lib/i18n/t'
import type { Database, Json } from '@/lib/supabase/database.types'
import { createPublicClient } from '@/lib/supabase/public'
import {
  ewkbToGeometry,
  geometryBbox,
  type Bbox,
  type FeatureCollection,
  type LineString,
  type MultiLineString,
  type Point,
  type Position,
} from './geo'
import { text, toCountry, type Client, type Country, type TransitMode } from './shared'

export type PlaceType = Database['public']['Enums']['place_type']
export const PLACE_TYPES = ['attraction', 'restaurant', 'bar', 'cafe', 'station', 'village'] as const satisfies readonly PlaceType[]

/** Widest viewport the places API accepts, in degrees on either axis. */
export const MAX_BBOX_SPAN = 40

/**
 * `minLng,minLat,maxLng,maxLat` -> tuple, or null when a part is missing / non-numeric,
 * out of range, `min >= max`, or the span exceeds {@link MAX_BBOX_SPAN} degrees.
 */
export function parseBbox(s: string): Bbox | null {
  const parts = s.split(',')
  if (parts.length !== 4 || parts.some((p) => p.trim() === '')) return null
  const [minLng, minLat, maxLng, maxLat] = parts.map(Number)
  if (![minLng, minLat, maxLng, maxLat].every(Number.isFinite)) return null
  if (minLng < -180 || maxLng > 180 || minLat < -90 || maxLat > 90) return null
  if (minLng >= maxLng || minLat >= maxLat) return null
  if (maxLng - minLng > MAX_BBOX_SPAN || maxLat - minLat > MAX_BBOX_SPAN) return null
  return [minLng, minLat, maxLng, maxLat]
}

export const DEMO_MAP_STYLE = 'https://demotiles.maplibre.org/style.json'

/** Ruling R7: configured style, else the MapLibre demo style outside production, else null (list view only). */
export function resolveMapStyle(configured: string | undefined, nodeEnv: string | undefined): string | null {
  if (configured) return configured
  return nodeEnv !== 'production' ? DEMO_MAP_STYLE : null
}

// ---------------------------------------------------------------------------
// GET /api/v1/map/places
// ---------------------------------------------------------------------------

export type PlaceCounts = Partial<Record<PlaceType, number>>

export type MapCluster = {
  /** null for a city-level cluster (places with no neighbourhood). */
  neighbourhoodId: number | null
  /** Neighbourhood name, or the city name for a city-level cluster. */
  name: string
  city: string | null
  cityName: string
  lng: number
  lat: number
  count: number
}

export type MapPinProps = { slug: string; type: PlaceType; name: string }

export type MapPlaces =
  | { level: 'clusters'; clusters: MapCluster[]; counts: PlaceCounts }
  | { level: 'places'; features: FeatureCollection<Point, MapPinProps>; counts: PlaceCounts }

type RpcCluster = {
  neighbourhood_id: number | null
  neighbourhood: string | null
  city: string | null
  city_name: Json | null
  lng: number
  lat: number
  count: number
}
type RpcFeature = { type: 'Feature'; geometry: Point; properties: { slug: string; type: PlaceType; name_i18n: Json } }
type RpcResult =
  | { clusters: RpcCluster[]; counts: PlaceCounts }
  | { features: { type: 'FeatureCollection'; features: RpcFeature[] }; counts: PlaceCounts }

/** Localise the `map_places` RPC payload. */
export function normaliseMapPlaces(raw: RpcResult, locale: Locale): MapPlaces {
  const counts = raw.counts ?? {}
  if ('clusters' in raw) {
    return {
      level: 'clusters',
      clusters: raw.clusters.map((c) => {
        const cityName = text(c.city_name, locale)
        return {
          neighbourhoodId: c.neighbourhood_id,
          name: c.neighbourhood ?? cityName,
          city: c.city,
          cityName,
          lng: c.lng,
          lat: c.lat,
          count: c.count,
        }
      }),
      counts,
    }
  }
  return {
    level: 'places',
    features: {
      type: 'FeatureCollection',
      features: raw.features.features.map((f) => ({
        type: 'Feature',
        geometry: f.geometry,
        properties: { slug: f.properties.slug, type: f.properties.type, name: text(f.properties.name_i18n, locale) },
      })),
    },
    counts,
  }
}

export async function getMapPlaces(
  client: Client,
  q: { bbox: Bbox; zoom: number; types: PlaceType[]; locale: Locale },
): Promise<MapPlaces> {
  const [min_lng, min_lat, max_lng, max_lat] = q.bbox
  const { data, error } = await client.rpc('map_places', {
    min_lng,
    min_lat,
    max_lng,
    max_lat,
    p_zoom: q.zoom,
    p_types: q.types.length ? q.types : undefined,
  })
  if (error) throw error
  return normaliseMapPlaces(data as unknown as RpcResult, q.locale)
}

// ---------------------------------------------------------------------------
// GET /api/v1/map/transit
// ---------------------------------------------------------------------------

export type TransitLineProps = { id: number; mode: TransitMode; short_name: string | null; long_name: string | null }
export type TransitStationProps = { id: number; name: string; step_free: boolean | null }
export type MapTransit = {
  lines: FeatureCollection<MultiLineString, TransitLineProps>
  stations: FeatureCollection<Point, TransitStationProps>
}

export async function loadTransit(client: Client, cityId: number, modes: TransitMode[]): Promise<MapTransit> {
  let lineQuery = client.from('transit_lines').select('id, mode, short_name, long_name, shape').eq('city_id', cityId)
  if (modes.length) lineQuery = lineQuery.in('mode', modes)
  const { data: lineRows, error } = await lineQuery.order('id')
  if (error) throw error

  const lines: MapTransit['lines'] = { type: 'FeatureCollection', features: [] }
  for (const l of lineRows ?? []) {
    const g = ewkbToGeometry(l.shape as string | null)
    if (g?.type !== 'MultiLineString') continue
    lines.features.push({
      type: 'Feature',
      geometry: g,
      properties: { id: l.id, mode: l.mode, short_name: l.short_name, long_name: l.long_name },
    })
  }

  const stations: MapTransit['stations'] = { type: 'FeatureCollection', features: [] }
  const ids = (lineRows ?? []).map((l) => l.id)
  if (ids.length) {
    const { data: stopRows, error: stopError } = await client
      .from('line_stops')
      .select('stop:transit_stops(id, name, geom, step_free)')
      .in('line_id', ids)
    if (stopError) throw stopError
    type StopRow = { stop: { id: number; name: string; geom: string; step_free: boolean | null } | null }
    const seen = new Set<number>()
    for (const { stop } of (stopRows ?? []) as unknown as StopRow[]) {
      if (!stop || seen.has(stop.id)) continue
      const g = ewkbToGeometry(stop.geom)
      if (g?.type !== 'Point') continue
      seen.add(stop.id)
      stations.features.push({
        type: 'Feature',
        geometry: g,
        properties: { id: stop.id, name: stop.name, step_free: stop.step_free },
      })
    }
  }
  return { lines, stations }
}

// ---------------------------------------------------------------------------
// Place detail: drawer + GET /api/v1/places/:slug
// ---------------------------------------------------------------------------

export type PlaceStop = {
  name: string
  walkMin: number
  lng: number
  lat: number
  /** Precomputed walk path (`place_stop_links.walk_geom`); null until computed. */
  walk: LineString | null
}

export type PlaceHours = { weekday: number; open: string; close: string }

export type PlaceDetail = {
  id: string
  slug: string
  type: PlaceType
  name: string
  area: string
  description: string
  city: { slug: string; name: string; timezone: string } | null
  country: Country | null
  neighbourhood: string
  lng: number
  lat: number
  tags: string[]
  /** weekday 0 = Sunday, in the city's time zone; close < open means after midnight. */
  hours: PlaceHours[]
  hoursNote: string
  /** 0-4, null when not applicable. */
  priceLevel: number | null
  priceNote: string
  website: string | null
  /** Nearest stops by rank, at most 3. */
  stops: PlaceStop[]
}

export type PlaceWithStatus = PlaceDetail & { isOpenNow: boolean }

const PLACE_SELECT =
  'id, slug, type, geom, name_i18n, area_i18n, desc_i18n, price_level, price_note_i18n, hours_note_i18n, website, ' +
  'city:cities(slug, name_i18n, timezone, region:regions(country)), neighbourhood:neighbourhoods(name), ' +
  'tags:place_tags(tag:tags(slug, name_i18n)), hours:place_hours(weekday, open_time, close_time), ' +
  'stops:place_stop_links(rank, walk_min, walk_geom, stop:transit_stops(name, geom))'

type PlaceRow = {
  id: string
  slug: string
  type: PlaceType
  geom: string
  name_i18n: Json
  area_i18n: Json | null
  desc_i18n: Json | null
  price_level: number | null
  price_note_i18n: Json | null
  hours_note_i18n: Json | null
  website: string | null
  city: { slug: string; name_i18n: Json; timezone: string; region: { country: string } | null } | null
  neighbourhood?: { name: string } | null
  tags: { tag: { slug: string; name_i18n: Json } | null }[] | null
  hours: { weekday: number; open_time: string; close_time: string }[] | null
  stops: { rank: number; walk_min: number; walk_geom: string | null; stop: { name: string; geom: string } | null }[] | null
}

const hhmm = (t: string) => t.slice(0, 5)

/** `place_hours` rows -> HH:MM ranges, ordered by weekday then opening time. Shared with the venue catalog. */
export function mapHours(rows: { weekday: number; open_time: string; close_time: string }[] | null | undefined): PlaceHours[] {
  return (rows ?? [])
    .map((h) => ({ weekday: h.weekday, open: hhmm(h.open_time), close: hhmm(h.close_time) }))
    .sort((a, b) => a.weekday - b.weekday || a.open.localeCompare(b.open))
}

export async function loadPlace(client: Client, slug: string, locale: Locale): Promise<PlaceDetail | null> {
  const { data, error } = await client
    .from('places')
    .select(PLACE_SELECT)
    .eq('slug', slug)
    .eq('status', 'published')
    .eq('is_closed', false)
    .maybeSingle()
  if (error) throw error
  if (!data) return null
  const r = data as unknown as PlaceRow
  const point = ewkbToGeometry(r.geom)
  if (point?.type !== 'Point') return null

  const stops: PlaceStop[] = []
  for (const s of [...(r.stops ?? [])].sort((a, b) => a.rank - b.rank)) {
    if (stops.length === 3) break
    const at = s.stop ? ewkbToGeometry(s.stop.geom) : null
    if (!s.stop || at?.type !== 'Point') continue
    const walk = ewkbToGeometry(s.walk_geom)
    stops.push({
      name: s.stop.name,
      walkMin: s.walk_min,
      lng: at.coordinates[0],
      lat: at.coordinates[1],
      walk: walk?.type === 'LineString' ? walk : null,
    })
  }

  return {
    id: r.id,
    slug: r.slug,
    type: r.type,
    name: text(r.name_i18n, locale),
    area: text(r.area_i18n, locale),
    description: text(r.desc_i18n, locale),
    city: r.city ? { slug: r.city.slug, name: text(r.city.name_i18n, locale), timezone: r.city.timezone } : null,
    country: toCountry(r.city?.region?.country),
    neighbourhood: r.neighbourhood?.name ?? '',
    lng: point.coordinates[0],
    lat: point.coordinates[1],
    tags: (r.tags ?? []).flatMap((x) => (x.tag ? [text(x.tag.name_i18n, locale)] : [])).filter(Boolean),
    hours: mapHours(r.hours),
    hoursNote: text(r.hours_note_i18n, locale),
    priceLevel: r.price_level,
    priceNote: text(r.price_note_i18n, locale),
    website: r.website,
    stops,
  }
}

async function isOpenNow(client: Client, placeId: string): Promise<boolean> {
  const { data, error } = await client.rpc('is_open_now', { p_place: placeId, p_at: new Date().toISOString() })
  if (error) throw error
  return data === true
}

/**
 * Place detail for the drawer and `GET /api/v1/places/:slug`. The detail is cached under the
 * `map` tag; `isOpenNow` is evaluated per request so a cached detail never shows a stale status.
 */
export async function getPlace(slug: string, locale: Locale): Promise<PlaceWithStatus | null> {
  const detail = await cachedContent(['place', locale, slug], 'map', () => loadPlace(createPublicClient(), slug, locale))()
  if (!detail) return null
  return { ...detail, isOpenNow: await isOpenNow(createPublicClient(), detail.id) }
}

// ---------------------------------------------------------------------------
// Cities for the breadcrumb / country switch
// ---------------------------------------------------------------------------

export type MapCity = {
  id: number
  slug: string
  name: string
  country: Country
  center: Position
  /** From `cities.bbox`; null when unset. */
  bbox: Bbox | null
}

export async function loadMapCities(client: Client, locale: Locale): Promise<MapCity[]> {
  const { data, error } = await client
    .from('cities')
    .select('id, slug, name_i18n, center, bbox, region:regions(country)')
    .eq('status', 'published')
    .order('id')
  if (error) throw error
  type Row = { id: number; slug: string; name_i18n: Json; center: string; bbox: string | null; region: { country: string } | null }
  return ((data ?? []) as unknown as Row[]).flatMap((c) => {
    const center = ewkbToGeometry(c.center)
    const country = toCountry(c.region?.country)
    if (center?.type !== 'Point' || !country) return []
    const poly = ewkbToGeometry(c.bbox)
    return [
      {
        id: c.id,
        slug: c.slug,
        name: text(c.name_i18n, locale) || c.slug,
        country,
        center: center.coordinates,
        bbox: poly ? geometryBbox(poly) : null,
      },
    ]
  })
}

export function getMapCities(locale: Locale): Promise<MapCity[]> {
  return cachedContent(['map-cities', locale], 'map', () => loadMapCities(createPublicClient(), locale))()
}

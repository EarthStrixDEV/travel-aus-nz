import 'server-only'
import { ROUTING_TIMEOUT_MS, RoutingUnavailable, type RoutingProvider } from './provider'
import { currencyAt, type Point, type RouteLeg, type RouteOption, type TransitMode } from './types'

const ENDPOINT = 'https://routes.googleapis.com/directions/v2:computeRoutes'

/** Only the fields `toOption` reads; Google bills by field mask tier and returns nothing else. */
const FIELD_MASK = [
  'routes.legs.steps.travelMode',
  'routes.legs.steps.distanceMeters',
  'routes.legs.steps.staticDuration',
  'routes.legs.steps.transitDetails.stopDetails',
  'routes.legs.steps.transitDetails.headsign',
  'routes.legs.steps.transitDetails.stopCount',
  'routes.legs.steps.transitDetails.transitLine.name',
  'routes.legs.steps.transitDetails.transitLine.nameShort',
  'routes.legs.steps.transitDetails.transitLine.vehicle.type',
  'routes.legs.steps.transitDetails.transitLine.agencies.name',
].join(',')

/** Walks shorter than this (after merging consecutive walk steps) are dropped (spec §7 step 4). */
const MIN_WALK_S = 120

type GLatLng = { latitude?: number; longitude?: number }
type GStop = { name?: string; location?: { latLng?: GLatLng } }
type GStep = {
  travelMode?: string
  distanceMeters?: number
  staticDuration?: string
  transitDetails?: {
    stopDetails?: { departureStop?: GStop; arrivalStop?: GStop; departureTime?: string; arrivalTime?: string }
    headsign?: string
    stopCount?: number
    transitLine?: { name?: string; nameShort?: string; vehicle?: { type?: string }; agencies?: { name?: string }[] }
  }
}
type GResponse = { routes?: { legs?: { steps?: GStep[] }[] }[] }

/** Google vehicle type → our `transit_mode` (plan Deviation 1); anything unlisted counts as bus. */
const VEHICLE_MODE: Record<string, TransitMode> = {
  BUS: 'bus',
  INTERCITY_BUS: 'bus',
  TROLLEYBUS: 'bus',
  HEAVY_RAIL: 'train',
  COMMUTER_TRAIN: 'train',
  HIGH_SPEED_TRAIN: 'train',
  LONG_DISTANCE_TRAIN: 'train',
  RAIL: 'train',
  SUBWAY: 'metro',
  METRO_RAIL: 'metro',
  TRAM: 'tram',
  LIGHT_RAIL: 'tram',
  FERRY: 'ferry',
}

const seconds = (d: string | undefined): number => Number.parseFloat(d ?? '0') || 0
const toPoint = (s: GStop | undefined): Point | undefined => {
  const ll = s?.location?.latLng
  return ll?.latitude !== undefined && ll.longitude !== undefined ? { lat: ll.latitude, lng: ll.longitude } : undefined
}
const time = (s: string | undefined): number | undefined => {
  const ms = s ? Date.parse(s) : NaN
  return Number.isNaN(ms) ? undefined : ms
}

/** A leg before times are chained: transit legs carry their scheduled times, walks only a duration. */
type Draft = Omit<RouteLeg, 'depart' | 'arrive' | 'duration_min'> & { line?: string; seconds: number; dep?: number; arr?: number }

function toDrafts(steps: GStep[]): Draft[] {
  const drafts: Draft[] = []
  for (const step of steps) {
    const td = step.transitDetails
    if (step.travelMode === 'TRANSIT' && td) {
      const line = td.transitLine
      const name = line?.nameShort || line?.name || ''
      const stops = td.stopCount ? ` · ${td.stopCount} stops` : ''
      drafts.push({
        mode: VEHICLE_MODE[line?.vehicle?.type ?? ''] ?? 'bus',
        line: name,
        from: td.stopDetails?.departureStop?.name ?? '',
        to: td.stopDetails?.arrivalStop?.name ?? '',
        detail: `${name}${td.headsign ? ` towards ${td.headsign}` : ''}${stops}`.trim(),
        agency: line?.agencies?.[0]?.name,
        distance_m: step.distanceMeters ?? 0,
        board: toPoint(td.stopDetails?.departureStop),
        alight: toPoint(td.stopDetails?.arrivalStop),
        seconds: seconds(step.staticDuration),
        dep: time(td.stopDetails?.departureTime),
        arr: time(td.stopDetails?.arrivalTime),
      })
      continue
    }
    const prev = drafts[drafts.length - 1]
    if (prev?.mode === 'walk') {
      prev.seconds += seconds(step.staticDuration)
      prev.distance_m += step.distanceMeters ?? 0
    } else {
      drafts.push({ mode: 'walk', from: '', to: '', detail: '', distance_m: step.distanceMeters ?? 0, seconds: seconds(step.staticDuration) })
    }
  }
  // Walks are named after the stops around them; the very first/last end stays '' for the caller to label.
  drafts.forEach((d, i) => {
    if (d.mode !== 'walk') return
    d.from = drafts[i - 1]?.to ?? ''
    d.to = drafts[i + 1]?.from ?? ''
    d.detail = `Walk ${d.distance_m} m`
  })
  return drafts
}

/** Fills dep/arr on walks: backwards from the first scheduled departure, then forwards from each arrival. */
function chainTimes(drafts: Draft[], departUtc: Date): void {
  const first = drafts.findIndex((d) => d.dep !== undefined)
  let t = first === -1 ? departUtc.getTime() : drafts[first].dep!
  for (let i = first - 1; i >= 0; i--) {
    drafts[i].arr = t
    t -= drafts[i].seconds * 1000
    drafts[i].dep = t
  }
  t = first === -1 ? t : drafts[first].dep!
  for (let i = Math.max(first, 0); i < drafts.length; i++) {
    const d = drafts[i]
    d.dep ??= t
    d.arr ??= d.dep + d.seconds * 1000
    t = d.arr
  }
}

const iso = (ms: number) => new Date(ms).toISOString()
const minutes = (ms: number) => Math.round(ms / 60000)

function toOption(steps: GStep[], input: { from: Point; departUtc: Date }): RouteOption | null {
  const drafts = toDrafts(steps)
  if (drafts.length === 0) return null
  chainTimes(drafts, input.departUtc)
  const depart = drafts[0].dep!
  const arrive = drafts[drafts.length - 1].arr!

  const legs: RouteLeg[] = drafts
    .filter((d) => d.mode !== 'walk' || d.seconds >= MIN_WALK_S)
    .map((d) => ({
      mode: d.mode,
      from: d.from,
      to: d.to,
      depart: iso(d.dep!),
      arrive: iso(d.arr!),
      duration_min: d.mode === 'walk' ? minutes(d.seconds * 1000) : minutes(d.arr! - d.dep!),
      detail: d.detail,
      ...(d.agency ? { agency: d.agency } : {}),
      distance_m: d.distance_m,
      ...(d.board ? { board: d.board } : {}),
      ...(d.alight ? { alight: d.alight } : {}),
    }))
  const lines = drafts.filter((d) => d.mode !== 'walk').map((d) => d.line || d.mode)

  return {
    depart: iso(depart),
    arrive: iso(arrive),
    duration_min: minutes(arrive - depart),
    summary: lines.length ? lines.join(' → ') : 'Walk',
    fare_min: null,
    fare_max: null,
    currency: currencyAt(input.from),
    card: null,
    legs,
  }
}

const latLng = (p: Point) => ({ location: { latLng: { latitude: p.lat, longitude: p.lng } } })

/** Google Routes API (transit). The only reader of `GOOGLE_ROUTES_API_KEY`. */
export const googleRoutes: RoutingProvider = {
  name: 'google-routes',
  async plan(input) {
    const key = process.env.GOOGLE_ROUTES_API_KEY
    if (!key) throw new RoutingUnavailable('GOOGLE_ROUTES_API_KEY is not set')

    let res: Response
    try {
      res = await fetch(ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Goog-Api-Key': key, 'X-Goog-FieldMask': FIELD_MASK },
        body: JSON.stringify({
          origin: latLng(input.from),
          destination: latLng(input.to),
          travelMode: 'TRANSIT',
          computeAlternativeRoutes: true,
          departureTime: input.departUtc.toISOString(),
        }),
        cache: 'no-store',
        signal: AbortSignal.timeout(ROUTING_TIMEOUT_MS),
      })
    } catch (err) {
      // Network failure or the 8 s timeout (TimeoutError).
      throw new RoutingUnavailable('Google Routes request failed', { cause: err })
    }
    if (!res.ok) throw new RoutingUnavailable(`Google Routes responded ${res.status}`)

    let body: GResponse
    try {
      body = (await res.json()) as GResponse
    } catch (err) {
      throw new RoutingUnavailable('Google Routes returned invalid JSON', { cause: err })
    }
    return (body.routes ?? []).flatMap((route) => {
      const option = toOption(route.legs?.flatMap((l) => l.steps ?? []) ?? [], input)
      return option ? [option] : []
    })
  },
}

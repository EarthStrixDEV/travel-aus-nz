import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import fixture from './__fixtures__/google-central-to-bondi.json'

vi.mock('server-only', () => ({}))

import { googleRoutes } from './google'
import { RoutingUnavailable } from './provider'

const fetchMock = vi.fn()
const json = (body: unknown, status = 200) => Promise.resolve(new Response(JSON.stringify(body), { status }))

const input = {
  from: { lat: -33.8832, lng: 151.207 },
  to: { lat: -33.8915, lng: 151.2767 },
  departUtc: new Date('2026-11-01T22:00:00Z'),
}

beforeEach(() => {
  fetchMock.mockReset()
  vi.stubGlobal('fetch', fetchMock)
  vi.stubEnv('GOOGLE_ROUTES_API_KEY', 'test-key')
})
afterEach(() => {
  vi.unstubAllGlobals()
  vi.unstubAllEnvs()
})

describe('googleRoutes.plan', () => {
  it('sends a TRANSIT computeRoutes request with key, field mask and RFC3339 UTC departure', async () => {
    fetchMock.mockReturnValue(json({ routes: [] }))
    await googleRoutes.plan(input)
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(url).toBe('https://routes.googleapis.com/directions/v2:computeRoutes')
    expect(init.method).toBe('POST')
    const headers = new Headers(init.headers)
    expect(headers.get('X-Goog-Api-Key')).toBe('test-key')
    expect(headers.get('X-Goog-FieldMask')).toMatch(/routes\.legs\.steps\.transitDetails/)
    expect(init.signal).toBeInstanceOf(AbortSignal)
    expect(JSON.parse(String(init.body))).toEqual({
      origin: { location: { latLng: { latitude: -33.8832, longitude: 151.207 } } },
      destination: { location: { latLng: { latitude: -33.8915, longitude: 151.2767 } } },
      travelMode: 'TRANSIT',
      computeAlternativeRoutes: true,
      departureTime: '2026-11-01T22:00:00.000Z',
    })
  })

  it('maps the fixture to 2 options, merging walk steps and dropping walks under 2 min', async () => {
    fetchMock.mockReturnValue(json(fixture))
    const options = await googleRoutes.plan(input)
    expect(options).toHaveLength(2)

    const [first, second] = options
    expect(first).toMatchObject({
      depart: '2026-11-01T22:01:00.000Z',
      arrive: '2026-11-01T22:35:00.000Z',
      duration_min: 34,
      summary: 'T4 → 333',
      fare_min: null,
      fare_max: null,
      currency: 'AUD',
      card: null,
    })
    expect(first.legs.map((l) => [l.mode, l.duration_min, l.distance_m])).toEqual([
      ['walk', 3, 220],
      ['train', 10, 6100],
      ['bus', 12, 3200],
      ['walk', 3, 200],
    ])
    expect(first.legs[0]).toMatchObject({ from: '', to: 'Central Station', depart: '2026-11-01T22:01:00.000Z', arrive: '2026-11-01T22:04:00.000Z' })
    expect(first.legs[1]).toMatchObject({
      from: 'Central Station',
      to: 'Bondi Junction Station',
      agency: 'Sydney Trains',
      detail: 'T4 towards Bondi Junction · 4 stops',
      board: { lat: -33.88306, lng: 151.20629 },
      alight: { lat: -33.89148, lng: 151.24778 },
    })
    expect(first.legs[3]).toMatchObject({ from: 'Bondi Beach, Campbell Pde', to: '', depart: '2026-11-01T22:32:00.000Z' })

    expect(second).toMatchObject({ depart: '2026-11-01T21:59:00.000Z', arrive: '2026-11-01T22:42:00.000Z', duration_min: 43, summary: '333' })
    expect(second.legs.map((l) => l.mode)).toEqual(['walk', 'bus', 'walk'])
  })

  it.each([
    ['FERRY', 'ferry'],
    ['LIGHT_RAIL', 'tram'],
    ['SUBWAY', 'metro'],
    ['COMMUTER_TRAIN', 'train'],
    ['INTERCITY_BUS', 'bus'],
    ['CABLE_CAR', 'bus'],
  ])('maps vehicle type %s to %s', async (type, mode) => {
    type TransitStep = { transitDetails: { transitLine: { vehicle: { type: string } } } }
    const step = structuredClone(fixture.routes[1].legs[0].steps[1]) as TransitStep
    step.transitDetails.transitLine.vehicle.type = type
    fetchMock.mockReturnValue(json({ routes: [{ legs: [{ steps: [step] }] }] }))
    const [option] = await googleRoutes.plan(input)
    expect(option.legs[0].mode).toBe(mode)
  })

  it('NZ origin -> NZD', async () => {
    fetchMock.mockReturnValue(json(fixture))
    const [option] = await googleRoutes.plan({ ...input, from: { lat: -36.8442, lng: 174.7676 } })
    expect(option.currency).toBe('NZD')
  })

  it('no routes -> empty list, not an error', async () => {
    fetchMock.mockReturnValue(json({}))
    expect(await googleRoutes.plan(input)).toEqual([])
  })

  it('missing key -> RoutingUnavailable without a network call', async () => {
    vi.stubEnv('GOOGLE_ROUTES_API_KEY', '')
    await expect(googleRoutes.plan(input)).rejects.toBeInstanceOf(RoutingUnavailable)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('non-2xx -> RoutingUnavailable', async () => {
    fetchMock.mockReturnValue(json({ error: { message: 'quota' } }, 500))
    await expect(googleRoutes.plan(input)).rejects.toBeInstanceOf(RoutingUnavailable)
  })

  it('network error -> RoutingUnavailable', async () => {
    fetchMock.mockRejectedValue(new TypeError('fetch failed'))
    await expect(googleRoutes.plan(input)).rejects.toBeInstanceOf(RoutingUnavailable)
  })

  it('timeout -> RoutingUnavailable', async () => {
    fetchMock.mockRejectedValue(new DOMException('The operation was aborted due to timeout', 'TimeoutError'))
    await expect(googleRoutes.plan(input)).rejects.toBeInstanceOf(RoutingUnavailable)
  })
})

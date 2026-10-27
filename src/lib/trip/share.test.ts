import { describe, expect, it, vi } from 'vitest'

const loadDays = vi.hoisted(() => vi.fn())
vi.mock('./load', () => ({ loadDays }))

import { loadSharedTrip } from './share'

const TOKEN = 'a'.repeat(32)

function fakeDb(share: unknown) {
  const q: Record<string, unknown> = {}
  Object.assign(q, { select: () => q, eq: () => q, is: () => q, maybeSingle: async () => ({ data: share, error: null }) })
  return { from: () => q } as never
}

const trip = (over: Record<string, unknown> = {}) => ({ trip: { id: 'trip-uuid', title: 'Sydney', start_date: '2026-11-01', end_date: '2026-11-02', deleted_at: null, ...over } })

const DAY = {
  id: 'day-uuid',
  dayNo: 1,
  date: '2026-11-01',
  title: 'Harbour',
  transitMin: 4,
  offMap: false,
  stops: [
    {
      id: 'stop-uuid',
      position: 1,
      time: '09:00',
      note: 'secret note',
      place: { id: 'place-uuid', slug: 'opera-house', type: 'attraction', name: 'Opera House', area: 'The Rocks', lng: 1, lat: 2, citySlug: 'sydney', cityBbox: null, cityTimezone: 'Australia/Sydney' },
      legToNext: { mode: 'walk', durationMin: 4, summary: 'A → B, 4 min', fareMin: null, fareMax: null, status: 'ok' },
    },
  ],
}

function keysDeep(v: unknown, out = new Set<string>()): Set<string> {
  if (Array.isArray(v)) v.forEach((x) => keysDeep(x, out))
  else if (v && typeof v === 'object') {
    for (const [k, x] of Object.entries(v)) {
      out.add(k)
      keysDeep(x, out)
    }
  }
  return out
}

describe('loadSharedTrip', () => {
  it('unknown, malformed, revoked (no row) or deleted -> null', async () => {
    expect(await loadSharedTrip(fakeDb(null), TOKEN, 'en')).toBeNull()
    expect(await loadSharedTrip(fakeDb(trip()), 'not-a-token', 'en')).toBeNull()
    expect(await loadSharedTrip(fakeDb(trip({ deleted_at: '2026-10-01' })), TOKEN, 'en')).toBeNull()
  })

  it('carries no ids, owner, notes or coordinates anywhere in the payload', async () => {
    loadDays.mockResolvedValue([DAY])
    const shared = await loadSharedTrip(fakeDb(trip()), TOKEN, 'en')
    const keys = keysDeep(shared)
    for (const k of ['id', 'user_id', 'note', 'lng', 'lat', 'cityBbox', 'fareMin']) expect(keys.has(k)).toBe(false)
    expect(JSON.stringify(shared)).not.toContain('secret note')
    expect(JSON.stringify(shared)).not.toContain('uuid')
    expect(shared?.days[0].stops[0]).toEqual({
      time: '09:00',
      place: { slug: 'opera-house', name: 'Opera House', type: 'attraction', area: 'The Rocks' },
      leg: { mode: 'walk', durationMin: 4, summary: 'A → B, 4 min' },
    })
  })
})

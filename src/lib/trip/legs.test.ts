import { describe, expect, it, vi } from 'vitest'
import type { RouteOption } from '@/lib/routing/types'
import { departFor, recomputeLeg, type LegJob } from './legs'

const NOW = new Date('2026-10-27T03:00:00Z')

const job = (over: Partial<LegJob> = {}): LegJob => ({
  fromStop: 'a',
  toStop: 'b',
  attempts: 0,
  from: { name: 'Circular Quay', lng: 151.2108, lat: -33.8615 },
  to: { name: 'Bondi Beach', lng: 151.2743, lat: -33.8915 },
  date: '2026-11-02',
  fromTime: '09:00',
  ...over,
})

const option = (duration_min: number, legs: Partial<RouteOption['legs'][number]>[]): RouteOption =>
  ({
    depart: '',
    arrive: '',
    duration_min,
    summary: '',
    fare_min: 3.2,
    fare_max: 5.1,
    currency: 'AUD',
    card: 'Opal',
    legs: legs.map((l) => ({ mode: 'walk', from: '', to: '', depart: '', arrive: '', duration_min: 1, detail: '', distance_m: 0, ...l })),
  }) as RouteOption

describe('recomputeLeg', () => {
  it('two stops 600 m apart are walked without calling the router', async () => {
    const plan = vi.fn()
    const near = job({ to: { name: 'Opera House', lng: 151.2153, lat: -33.8568 } })
    const u = await recomputeLeg(near, plan, NOW)
    expect(plan).not.toHaveBeenCalled()
    expect(u).toMatchObject({ mode: 'walk', status: 'ok', attempts: 0 })
    expect(u.duration_min).toBeGreaterThanOrEqual(7)
    expect(u.duration_min).toBeLessThanOrEqual(9)
  })

  it('takes the fastest option and summarises its first transit leg', async () => {
    const plan = vi.fn(async () => ({
      options: [
        option(40, [{ mode: 'bus', from: 'Circular Quay', to: 'Bondi Beach' }]),
        option(28, [{ mode: 'walk' }, { mode: 'train', from: 'Circular Quay', to: 'Bondi Junction' }, { mode: 'bus', from: 'Bondi Junction', to: 'Bondi Beach' }]),
      ],
    }))
    const u = await recomputeLeg(job(), plan, NOW)
    expect(plan).toHaveBeenCalledWith({ from: '-33.861500,151.210800', to: '-33.891500,151.274300', depart: '2026-11-02T10:00' })
    expect(u).toMatchObject({ mode: 'train', duration_min: 28, summary: 'Circular Quay → Bondi Junction, 28 min', fare_min: 3.2, status: 'ok' })
  })

  it('a walk-only option of 15 min or less is a walk; longer walk-only results count as a failure', async () => {
    expect(await recomputeLeg(job(), async () => ({ options: [option(14, [{ mode: 'walk' }])] }), NOW)).toMatchObject({ mode: 'walk', duration_min: 14, status: 'ok' })
    expect(await recomputeLeg(job(), async () => ({ options: [option(40, [{ mode: 'walk' }])] }), NOW)).toMatchObject({ status: 'stale', attempts: 1 })
  })

  it('router failures count up and the third leaves the leg failed', async () => {
    const plan = vi.fn(async () => {
      throw new Error('down')
    })
    let j = job()
    const seen: string[] = []
    for (let i = 0; i < 3; i++) {
      const u = await recomputeLeg(j, plan, NOW)
      seen.push(`${u.status}:${u.attempts}`)
      j = { ...j, attempts: u.attempts }
    }
    expect(seen).toEqual(['stale:1', 'stale:2', 'failed:3'])
    expect(await recomputeLeg(job(), async () => ({ error: 'ROUTING_UNAVAILABLE', message: 'x', fallback: null }), NOW)).toMatchObject({ status: 'stale', attempts: 1 })
  })
})

describe('departFor', () => {
  it('adds the 60-minute stay, defaults to 09:00 and rolls past midnight', () => {
    expect(departFor({ date: '2026-11-02', fromTime: '09:30' }, NOW)).toBe('2026-11-02T10:30')
    expect(departFor({ date: '2026-11-02', fromTime: null }, NOW)).toBe('2026-11-02T10:00')
    expect(departFor({ date: '2026-11-02', fromTime: '23:30' }, NOW)).toBe('2026-11-03T00:30')
    expect(departFor({ date: null, fromTime: '12:00:00' }, NOW)).toBe('2026-10-27T13:00')
  })
})

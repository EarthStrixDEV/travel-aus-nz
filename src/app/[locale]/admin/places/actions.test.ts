import { beforeEach, describe, expect, it, vi } from 'vitest'

type Result = { data?: unknown; error: { code?: string; message?: string } | null }

// A chainable PostgREST stand-in: records every call and resolves `${table}.${op}` from `results`.
const { requireRole, createClient, revalidateTag, calls, results } = vi.hoisted(() => {
  const calls: { table: string; op: string; args: unknown[] }[] = []
  const results: Record<string, Result> = {}
  function builder(table: string) {
    let op = 'select'
    const b: Record<string, unknown> = {}
    for (const m of ['select', 'upsert', 'insert', 'update', 'delete', 'eq', 'in', 'single', 'maybeSingle']) {
      b[m] = (...args: unknown[]) => {
        if (['upsert', 'insert', 'update', 'delete'].includes(m)) op = m
        calls.push({ table, op: m, args })
        return b
      }
    }
    b.then = (resolve: (r: Result) => unknown) => resolve(results[`${table}.${op}`] ?? { data: null, error: null })
    return b
  }
  return {
    requireRole: vi.fn(),
    createClient: vi.fn(async () => ({ from: (t: string) => builder(t) })),
    revalidateTag: vi.fn(),
    calls,
    results,
  }
})

vi.mock('@/lib/auth/profile', () => ({ requireRole }))
vi.mock('@/lib/supabase/server', () => ({ createClient }))
vi.mock('next/cache', () => ({ revalidateTag }))
vi.mock('next-intl/server', () => ({ getTranslations: async () => (key: string) => key }))

import { savePlace } from './actions'

const ID = '11111111-1111-4111-8111-111111111111'

function form(over: Record<string, string> = {}) {
  const fd = new FormData()
  const base: Record<string, string> = {
    city_id: '1',
    slug: 'kin-noodle-bar',
    type: 'restaurant',
    name_th: 'คิน',
    name_en: 'Kin Noodle Bar',
    lng: '151.2',
    lat: '-33.8',
    status: 'published',
    booking: 'walk_in',
  }
  for (const [k, v] of Object.entries({ ...base, ...over })) fd.set(k, v)
  fd.append('tags[]', '3')
  fd.append('drinks[]', 'beer')
  fd.append('hour_weekday[]', '1')
  fd.append('hour_open_time[]', '11:00')
  fd.append('hour_close_time[]', '21:30')
  fd.append('hour_weekday[]', '2')
  fd.append('hour_open_time[]', '')
  fd.append('hour_close_time[]', '')
  fd.append('stop_stop_id[]', '7')
  fd.append('stop_walk_min[]', '4')
  return fd
}

const tags = () => revalidateTag.mock.calls.map((c) => c[0]).sort()

beforeEach(() => {
  vi.clearAllMocks()
  calls.length = 0
  for (const k of Object.keys(results)) delete results[k]
  requireRole.mockResolvedValue({ id: 'u1', role: 'editor' })
  results['places.upsert'] = { data: { id: ID }, error: null }
  results['gallery_photos.select'] = { data: [], error: null }
})

describe('savePlace', () => {
  it('unauthorized -> rethrows before any DB access', async () => {
    requireRole.mockRejectedValue(new Error('NEXT_NOT_FOUND'))
    await expect(savePlace(ID, form())).rejects.toThrow('NEXT_NOT_FOUND')
    expect(requireRole).toHaveBeenCalledWith(['editor', 'admin'])
    expect(createClient).not.toHaveBeenCalled()
  })

  it('valid venue -> upserts place + children through the session, then revalidates map, venues, home', async () => {
    expect(await savePlace(ID, form())).toEqual({})
    const placeUpsert = calls.find((c) => c.table === 'places' && c.op === 'upsert')!
    expect(placeUpsert.args[0]).toMatchObject({
      id: ID,
      city_id: 1,
      slug: 'kin-noodle-bar',
      type: 'restaurant',
      name_i18n: { th: 'คิน', en: 'Kin Noodle Bar' },
      geom: 'SRID=4326;POINT(151.2 -33.8)',
      status: 'published',
    })
    expect(calls.find((c) => c.table === 'place_hours' && c.op === 'insert')!.args[0]).toEqual([
      { place_id: ID, weekday: 1, open_time: '11:00', close_time: '21:30' },
    ])
    expect(calls.find((c) => c.table === 'place_tags' && c.op === 'insert')!.args[0]).toEqual([{ place_id: ID, tag_id: 3 }])
    expect(calls.find((c) => c.table === 'place_stop_links' && c.op === 'insert')!.args[0]).toEqual([
      { place_id: ID, stop_id: 7, rank: 1, walk_min: 4 },
    ])
    expect(calls.find((c) => c.table === 'venues' && c.op === 'upsert')!.args[0]).toMatchObject({ place_id: ID, booking: 'walk_in' })
    expect(calls.find((c) => c.table === 'venue_drinks' && c.op === 'insert')!.args[0]).toEqual([{ place_id: ID, drink: 'beer' }])

    expect(tags()).toEqual(['home', 'map', 'venues'])
  })

  it('non-venue type -> removes any venue row instead of writing one', async () => {
    await savePlace(ID, form({ type: 'attraction' }))
    expect(calls.some((c) => c.table === 'venues' && c.op === 'delete')).toBe(true)
    expect(calls.some((c) => c.table === 'venues' && c.op === 'upsert')).toBe(false)
    expect(tags()).toEqual(['home', 'map', 'venues'])
  })

  it('publishing while a linked gallery asset lacks a license -> field error, no write, no revalidate', async () => {
    results['gallery_photos.select'] = { data: [{ media: { credit: 'x', license: '' } }], error: null }
    const r = await savePlace(ID, form())
    expect(r.fieldErrors?.status).toBe('errors.license')
    expect(calls.some((c) => c.op === 'upsert')).toBe(false)
    expect(revalidateTag).not.toHaveBeenCalled()
  })

  it('invalid fields -> field errors, no write', async () => {
    const r = await savePlace(ID, form({ slug: 'Bad Slug', name_en: '' }))
    expect(r.fieldErrors).toMatchObject({ slug: 'errors.slug', name_en: 'errors.required' })
    expect(calls.some((c) => c.op === 'upsert')).toBe(false)
  })

  it('duplicate slug -> translated error, no revalidate', async () => {
    results['places.upsert'] = { data: null, error: { code: '23505', message: 'dup' } }
    expect(await savePlace(null, form())).toEqual({ error: 'errors.duplicate' })
    expect(revalidateTag).not.toHaveBeenCalled()
  })

  it('a child-table failure after the place write -> error, but caches still revalidate', async () => {
    results['place_tags.insert'] = { data: null, error: { code: '42501', message: 'rls' } }
    expect(await savePlace(ID, form())).toEqual({ error: 'errors.forbidden' })
    expect(tags()).toEqual(['home', 'map', 'venues'])
  })

  it('a malformed id is rejected before the DB', async () => {
    expect(await savePlace('not-a-uuid', form())).toEqual({ error: 'errors.invalidId' })
    expect(createClient).not.toHaveBeenCalled()
  })
})

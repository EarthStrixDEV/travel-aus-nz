import { beforeEach, describe, expect, it, vi } from 'vitest'

const { requireRole, upsert, from, createClient, revalidateTag } = vi.hoisted(() => {
  const upsert = vi.fn()
  const from = vi.fn(() => ({ upsert }))
  return {
    requireRole: vi.fn(),
    upsert,
    from,
    createClient: vi.fn(async () => ({ from })),
    revalidateTag: vi.fn(),
  }
})

vi.mock('@/lib/auth/profile', () => ({ requireRole }))
vi.mock('@/lib/supabase/server', () => ({ createClient }))
vi.mock('next/cache', () => ({ revalidateTag }))
vi.mock('next-intl/server', () => ({ getTranslations: async () => (key: string) => key }))

import { saveCity } from './actions'

function form(over: Record<string, string> = {}) {
  const fd = new FormData()
  const base: Record<string, string> = {
    region_id: '1',
    slug: 'sydney',
    name_th: 'ซิดนีย์',
    name_en: 'Sydney',
    timezone: 'Australia/Sydney',
    lng: '151.2093',
    lat: '-33.8688',
    status: 'published',
  }
  for (const [k, v] of Object.entries({ ...base, ...over })) fd.set(k, v)
  return fd
}

beforeEach(() => {
  vi.clearAllMocks()
  requireRole.mockResolvedValue({ id: 'u1', role: 'editor' })
  upsert.mockResolvedValue({ error: null })
})

describe('saveCity', () => {
  it('unauthorized -> rethrows and never touches the DB', async () => {
    requireRole.mockRejectedValue(new Error('NEXT_NOT_FOUND'))
    await expect(saveCity(1, form())).rejects.toThrow('NEXT_NOT_FOUND')
    expect(requireRole).toHaveBeenCalledWith(['editor', 'admin'])
    expect(createClient).not.toHaveBeenCalled()
    expect(from).not.toHaveBeenCalled()
    expect(revalidateTag).not.toHaveBeenCalled()
  })

  it('valid input -> upserts i18n name + EWKT center, then revalidates home, map, venues, gallery', async () => {
    const r = await saveCity(1, form())
    expect(r).toEqual({})
    expect(from).toHaveBeenCalledWith('cities')
    expect(upsert).toHaveBeenCalledWith({
      id: 1,
      region_id: 1,
      slug: 'sydney',
      name_i18n: { th: 'ซิดนีย์', en: 'Sydney' },
      timezone: 'Australia/Sydney',
      center: 'SRID=4326;POINT(151.2093 -33.8688)',
      status: 'published',
    })
    expect(revalidateTag.mock.calls.map((c) => c[0]).sort()).toEqual(['gallery', 'home', 'map', 'venues'])
    expect(upsert.mock.invocationCallOrder[0]).toBeLessThan(revalidateTag.mock.invocationCallOrder[0])
  })

  it('create (id null) sends no id', async () => {
    await saveCity(null, form())
    expect(upsert.mock.calls[0][0]).not.toHaveProperty('id')
  })

  it('invalid id is rejected before the DB', async () => {
    const r = await saveCity(Number.NaN, form())
    expect(r.error).toBe('errors.invalidId')
    expect(createClient).not.toHaveBeenCalled()
  })

  it('invalid fields -> translated field errors, no DB write', async () => {
    const r = await saveCity(1, form({ slug: 'Sydney City', lat: '91' }))
    expect(r.fieldErrors).toEqual({ slug: 'errors.slug', lat: 'errors.lat' })
    expect(upsert).not.toHaveBeenCalled()
    expect(revalidateTag).not.toHaveBeenCalled()
  })

  it('blank coordinates are invalid, not coerced to 0', async () => {
    const r = await saveCity(1, form({ lng: '', lat: '  ' }))
    expect(r.fieldErrors).toEqual({ lng: 'errors.lng', lat: 'errors.lat' })
    expect(upsert).not.toHaveBeenCalled()
  })

  it('unique slug violation -> translated message, no raw backend text, no revalidate', async () => {
    upsert.mockResolvedValue({ error: { code: '23505', message: 'duplicate key value violates cities_slug_key' } })
    const r = await saveCity(null, form())
    expect(r).toEqual({ error: 'errors.duplicateSlug' })
    expect(revalidateTag).not.toHaveBeenCalled()
  })

  it('RLS violation -> forbidden message', async () => {
    upsert.mockResolvedValue({ error: { code: '42501', message: 'new row violates row-level security policy' } })
    expect(await saveCity(1, form())).toEqual({ error: 'errors.forbidden' })
  })

  it('any other DB error -> generic message', async () => {
    upsert.mockResolvedValue({ error: { code: 'XX000', message: 'secret internals' } })
    expect(await saveCity(1, form())).toEqual({ error: 'errors.saveFailed' })
  })
})

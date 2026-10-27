import { beforeEach, describe, expect, it, vi } from 'vitest'

const { requireRole, from, createClient, revalidateTag, syncChildren } = vi.hoisted(() => {
  const single = vi.fn(async () => ({ data: { id: 'dish-1' }, error: null }))
  const from = vi.fn(() => ({ upsert: vi.fn(() => ({ select: () => ({ single }) })) }))
  return {
    requireRole: vi.fn(),
    from,
    createClient: vi.fn(async () => ({ from })),
    revalidateTag: vi.fn(),
    syncChildren: vi.fn(async () => null),
  }
})

vi.mock('@/lib/auth/profile', () => ({ requireRole }))
vi.mock('@/lib/supabase/server', () => ({ createClient }))
vi.mock('next/cache', () => ({ revalidateTag }))
vi.mock('next-intl/server', () => ({ getTranslations: async () => (key: string) => key }))
vi.mock('../_lib/db', () => ({ mediaMetaFor: async () => ({ media: [], error: null }), syncChildren }))

import { saveDish } from './actions'

function form() {
  const fd = new FormData()
  for (const [k, v] of Object.entries({ slug: 'pavlova', country: 'AU', type: 'sweet', name_th: 'พาฟโลวา', name_en: 'Pavlova', status: 'draft' })) fd.set(k, v)
  fd.append('pairing_k_en[]', 'Wine')
  fd.append('pairing_v_en[]', 'Late-harvest riesling')
  return fd
}

beforeEach(() => {
  vi.clearAllMocks()
  requireRole.mockResolvedValue({ id: 'u1', role: 'editor' })
})

describe('saveDish', () => {
  it('saves the dish, syncs pairings and venues, then revalidates dishes', async () => {
    expect(await saveDish(null, form())).toEqual({})
    expect(syncChildren).toHaveBeenCalledWith(expect.anything(), 'dish_pairings', expect.objectContaining({ parent: ['dish_id', 'dish-1'] }))
    expect(syncChildren).toHaveBeenCalledWith(expect.anything(), 'dish_venues', expect.objectContaining({ rows: [] }))
    expect(revalidateTag).toHaveBeenCalledWith('dishes')
  })

  it('a malformed id is rejected before the DB', async () => {
    expect(await saveDish('nope', form())).toEqual({ error: 'errors.invalidId' })
    expect(from).not.toHaveBeenCalled()
  })
})

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

import { saveRegion } from './actions'

function form() {
  const fd = new FormData()
  const base: Record<string, string> = { country: 'AU', slug: 'sydney', name_th: 'ซิดนีย์', name_en: 'Sydney', status: 'draft' }
  for (const [k, v] of Object.entries(base)) fd.set(k, v)
  return fd
}

beforeEach(() => {
  vi.clearAllMocks()
  requireRole.mockResolvedValue({ id: 'u1', role: 'editor' })
  upsert.mockResolvedValue({ error: null })
})

describe('saveRegion', () => {
  it('unauthorized -> rethrows before any DB access', async () => {
    requireRole.mockRejectedValue(new Error('NEXT_NOT_FOUND'))
    await expect(saveRegion(1, form())).rejects.toThrow('NEXT_NOT_FOUND')
    expect(requireRole).toHaveBeenCalledWith(['editor', 'admin'])
    expect(createClient).not.toHaveBeenCalled()
  })

  it('valid input -> upserts, then revalidates home and gallery (gallery embeds region slug/name)', async () => {
    expect(await saveRegion(1, form())).toEqual({})
    expect(upsert).toHaveBeenCalledWith(expect.objectContaining({ id: 1, slug: 'sydney' }))
    expect(revalidateTag.mock.calls.map((c) => c[0]).sort()).toEqual(['gallery', 'home'])
  })

  it('DB error -> no revalidate', async () => {
    upsert.mockResolvedValue({ error: { code: 'XX000', message: 'x' } })
    expect(await saveRegion(1, form())).toEqual({ error: 'errors.saveFailed' })
    expect(revalidateTag).not.toHaveBeenCalled()
  })
})

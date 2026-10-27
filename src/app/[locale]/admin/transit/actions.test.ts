import { beforeEach, describe, expect, it, vi } from 'vitest'

const { requireRole, upsert, createClient, revalidateTag } = vi.hoisted(() => {
  const upsert = vi.fn()
  return {
    requireRole: vi.fn(),
    upsert,
    createClient: vi.fn(async () => ({ from: () => ({ upsert }) })),
    revalidateTag: vi.fn(),
  }
})

vi.mock('@/lib/auth/profile', () => ({ requireRole }))
vi.mock('@/lib/supabase/server', () => ({ createClient }))
vi.mock('next/cache', () => ({ revalidateTag }))
vi.mock('next-intl/server', () => ({ getTranslations: async () => (key: string) => key }))

import { saveAirport, saveFareRule } from './actions'

const form = (fields: Record<string, string>) => {
  const fd = new FormData()
  for (const [k, v] of Object.entries(fields)) fd.set(k, v)
  return fd
}

beforeEach(() => {
  vi.clearAllMocks()
  requireRole.mockResolvedValue({ id: 'u1', role: 'editor' })
  upsert.mockResolvedValue({ error: null })
})

describe('saveAirport', () => {
  it('upserts and revalidates transport and prepare (transfers appear on both pages)', async () => {
    expect(await saveAirport(null, form({ airport_code: 'syd', option_name: 'Airport Link', fare_min: '20.62', currency: 'AUD' }))).toEqual({})
    expect(upsert).toHaveBeenCalledWith(expect.objectContaining({ airport_code: 'SYD', option_name: 'Airport Link', fare_min: 20.62 }))
    expect(revalidateTag.mock.calls.map((c) => c[0]).sort()).toEqual(['prepare', 'transport'])
  })

  it('unauthorized -> rethrows before any DB access', async () => {
    requireRole.mockRejectedValue(new Error('NEXT_NOT_FOUND'))
    await expect(saveAirport(null, form({ airport_code: 'SYD', option_name: 'x' }))).rejects.toThrow('NEXT_NOT_FOUND')
    expect(createClient).not.toHaveBeenCalled()
  })
})

describe('saveFareRule', () => {
  it('stores the rule in the router shape and revalidates transport', async () => {
    const fd = form({ agency_id: '3', currency: 'AUD', kind: 'distance', daily_cap: '18.70' })
    for (const [k, v] of [['band_upto_km[]', '10'], ['band_peak[]', '4.20'], ['band_offpeak[]', '2.94']]) fd.append(k, v)
    expect(await saveFareRule(null, fd)).toEqual({})
    expect(upsert).toHaveBeenCalledWith({
      agency_id: 3,
      mode: null,
      currency: 'AUD',
      verified_at: null,
      rule: { kind: 'distance', bands: [{ upto_km: 10, peak: 4.2, offpeak: 2.94 }], daily_cap: 18.7 },
    })
    expect(revalidateTag).toHaveBeenCalledWith('transport')
  })

  it('an invalid rule never reaches the database', async () => {
    expect(await saveFareRule(null, form({ agency_id: '3', currency: 'AUD', kind: 'flat', peak: '5' }))).toMatchObject({ fieldErrors: { offpeak: expect.any(String) } })
    expect(upsert).not.toHaveBeenCalled()
  })
})

import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'
import { encodeCursor } from '@/lib/api/cursor'

const listJourneys = vi.fn()
vi.mock('@/lib/supabase/public', () => ({ createPublicClient: () => ({}) }))
vi.mock('@/lib/content/cache', () => ({ cachedContent: (_k: string[], _t: string, fn: () => unknown) => fn }))
vi.mock('@/lib/content/journeys', () => ({ listJourneys: (...a: unknown[]) => listJourneys(...a) }))

import { GET } from './route'

const call = (qs: string) => GET(new NextRequest(`http://localhost:3000/api/v1/journeys${qs}`))

beforeEach(() => {
  vi.clearAllMocks()
  vi.spyOn(console, 'error').mockImplementation(() => {})
  listJourneys.mockResolvedValue({ items: [], nextCursor: null })
})

describe('GET /api/v1/journeys', () => {
  it('folds mode[] and mode into one list and decodes the cursor', async () => {
    const cursor = encodeCursor({ sort: 'j-2', id: 'id-2' })
    const res = await call(`?country=au&mode[]=train&mode[]=ferry&mode=bus&limit=5&cursor=${cursor}&locale=en`)
    expect(res.status).toBe(200)
    expect(listJourneys).toHaveBeenCalledWith(expect.anything(), 'en', {
      country: 'au', modes: ['train', 'ferry', 'bus'], cursor: { sort: 'j-2', id: 'id-2' }, limit: 5,
    })
  })

  it('defaults: th, no modes, limit 20', async () => {
    await call('')
    expect(listJourneys).toHaveBeenCalledWith(expect.anything(), 'th', { country: undefined, modes: [], cursor: undefined, limit: 20 })
  })

  it.each(['?cursor=!!!notacursor', '?mode[]=hovercraft', '?country=fr', '?limit=0'])('%s -> 400 VALIDATION', async (qs) => {
    const res = await call(qs)
    expect(res.status).toBe(400)
    expect((await res.json()).error.code).toBe('VALIDATION')
    expect(listJourneys).not.toHaveBeenCalled()
  })

  it('loader error -> 500 INTERNAL envelope', async () => {
    listJourneys.mockRejectedValue(new Error('db down'))
    const res = await call('')
    expect(res.status).toBe(500)
    expect((await res.json()).error.code).toBe('INTERNAL')
  })
})

import { describe, expect, it } from 'vitest'
import { decodeCursor } from '@/lib/api/cursor'
import { getJourneyDetail, listJourneys } from './journeys'

type Row = Record<string, unknown>

function fakeClient(initial: Row[]) {
  let rows = initial
  const calls: Record<string, unknown[]> = {}
  const client = {
    from() {
      const q = {
        select: () => q,
        eq: () => q,
        overlaps: (...a: unknown[]) => ((calls.overlaps = a), q),
        gt: (...a: unknown[]) => ((calls.gt = a), q),
        order: () => q,
        limit: (n: number) => ((calls.limit = [n]), (rows = rows.slice(0, n)), q),
        maybeSingle: () => Promise.resolve({ data: rows[0] ?? null, error: null }),
        then: (resolve: (v: { data: Row[]; error: null }) => unknown) => resolve({ data: rows, error: null }),
      }
      return q
    },
  }
  return { client: client as never, calls }
}

const row = (n: number): Row => ({
  id: `id-${n}`, slug: `j-${n}`, country: 'AU', title_i18n: { en: `J${n}` }, line_i18n: null,
  from_name: 'A', to_name: 'B', days: 3, price_from: 100, currency: 'AUD', modes: ['train'], cover: null,
})

describe('listJourneys cursor boundary', () => {
  it('fetches limit+1 and sets nextCursor when more rows exist', async () => {
    const { client, calls } = fakeClient([row(1), row(2), row(3)])
    const page = await listJourneys(client, 'en', { limit: 2 })
    expect(calls.limit).toEqual([3])
    expect(page.items.map((i) => i.slug)).toEqual(['j-1', 'j-2'])
    expect(decodeCursor(page.nextCursor!)).toEqual({ sort: 'j-2', id: 'id-2' })
  })

  it('has no nextCursor when exactly limit rows come back', async () => {
    const { client } = fakeClient([row(1), row(2)])
    const page = await listJourneys(client, 'en', { limit: 2 })
    expect(page.items).toHaveLength(2)
    expect(page.nextCursor).toBeNull()
  })

  it('applies cursor (gt slug) and mode overlap filters', async () => {
    const { client, calls } = fakeClient([row(1)])
    await listJourneys(client, 'en', { limit: 5, cursor: { sort: 'j-2', id: 'id-2' }, modes: ['ferry', 'train'] })
    expect(calls.gt).toEqual(['slug', 'j-2'])
    expect(calls.overlaps).toEqual(['modes', ['ferry', 'train']])
  })
})

describe('getJourneyDetail', () => {
  it('returns null for an unknown slug', async () => {
    const { client } = fakeClient([])
    expect(await getJourneyDetail(client, 'en', 'nope')).toBeNull()
  })

  it('groups legs by day in seq order', async () => {
    const legs = [
      { seq: 3, day: 2, mode: 'bus', from_name: 'C', to_name: 'D', operator: null, duration_min: 10, frequency_text: null },
      { seq: 1, day: 1, mode: 'train', from_name: 'A', to_name: 'B', operator: null, duration_min: 20, frequency_text: null },
      { seq: 2, day: 1, mode: 'ferry', from_name: 'B', to_name: 'C', operator: null, duration_min: 30, frequency_text: null },
    ]
    const { client } = fakeClient([{ ...row(1), legs }])
    const d = await getJourneyDetail(client, 'en', 'j-1')
    expect(d?.itinerary.map((x) => [x.day, x.legs.map((l) => l.seq)])).toEqual([[1, [1, 2]], [2, [3]]])
  })
})

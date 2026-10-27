import { describe, expect, it, vi } from 'vitest'

vi.mock('server-only', () => ({}))
vi.mock('@/lib/supabase/server', () => ({ createClient: async () => ({}) }))

import { NotFound } from '@/lib/api/session'
import { deleteStop, ownedDay, ownedStop, patchStop } from './mutate'
import { newTripSchema, patchStopSchema } from './schema'

/** Records every call; `rows` answers maybeSingle by table. */
function fakeDb(rows: Record<string, unknown> = {}) {
  const calls: { table: string; op: string; args: unknown[] }[] = []
  const rpc = vi.fn(async () => ({ error: null }))
  const from = (table: string) => {
    const q: Record<string, unknown> = {}
    const rec = (op: string) => (...args: unknown[]) => (calls.push({ table, op, args }), q)
    Object.assign(q, {
      select: rec('select'),
      eq: rec('eq'),
      update: rec('update'),
      delete: rec('delete'),
      upsert: rec('upsert'),
      maybeSingle: async () => ({ data: rows[table] ?? null, error: null }),
      then: (resolve: (v: unknown) => unknown) => resolve({ error: null }),
    })
    return q
  }
  return { db: { from, rpc } as never, calls, rpc }
}

const stopRow = (userId: string, deleted: string | null = null) => ({
  id: 's1',
  day_id: 'd1',
  place_id: 'p1',
  day: { trip_id: 't1', trip: { user_id: userId, deleted_at: deleted } },
})

describe('ownership', () => {
  it("another user's stop or day is NotFound", async () => {
    await expect(ownedStop(fakeDb({ trip_stops: stopRow('u2') }).db, 'u1', 's1')).rejects.toBeInstanceOf(NotFound)
    await expect(ownedStop(fakeDb({}).db, 'u1', 's1')).rejects.toBeInstanceOf(NotFound)
    await expect(ownedDay(fakeDb({ trip_days: { id: 'd1', trip: { user_id: 'u2', deleted_at: null } } }).db, 'u1', 't1', 1)).rejects.toBeInstanceOf(NotFound)
  })
  it('a stop on a deleted trip is NotFound; an own stop resolves', async () => {
    await expect(ownedStop(fakeDb({ trip_stops: stopRow('u1', '2026-10-01') }).db, 'u1', 's1')).rejects.toBeInstanceOf(NotFound)
    expect(await ownedStop(fakeDb({ trip_stops: stopRow('u1') }).db, 'u1', 's1')).toEqual({ id: 's1', dayId: 'd1', tripId: 't1', placeId: 'p1' })
  })
})

describe('deleteStop', () => {
  it('re-normalizes the day and puts the place back in saved items', async () => {
    const f = fakeDb()
    await deleteStop(f.db, 'u1', { id: 's1', dayId: 'd1', tripId: 't1', placeId: 'p1' })
    expect(f.calls.some((c) => c.table === 'trip_stops' && c.op === 'delete')).toBe(true)
    expect(f.rpc).toHaveBeenCalledWith('normalize_trip_day', { p_day: 'd1' })
    expect(f.calls).toContainEqual(
      expect.objectContaining({ table: 'saved_items', op: 'upsert', args: [{ user_id: 'u1', entity_type: 'place', entity_id: 'p1' }, expect.anything()] }),
    )
  })
})

describe('patchStop', () => {
  const stop = { id: 's1', dayId: 'd1', tripId: 't1', placeId: 'p1' }
  it('a new time marks the next leg stale; a move calls move_trip_stop on the same day by default', async () => {
    const f = fakeDb()
    await patchStop(f.db, stop, { time: '10:30', position: 2 })
    expect(f.calls).toContainEqual(expect.objectContaining({ table: 'trip_legs', op: 'update', args: [{ status: 'stale', attempts: 0 }] }))
    expect(f.rpc).toHaveBeenCalledWith('move_trip_stop', { p_stop: 's1', p_day: 'd1', p_position: 2 })
  })
  it('a note-only edit touches no legs', async () => {
    const f = fakeDb()
    await patchStop(f.db, stop, { note: 'Book ahead' })
    expect(f.calls.some((c) => c.table === 'trip_legs')).toBe(false)
    expect(f.rpc).not.toHaveBeenCalled()
  })
})

describe('schemas', () => {
  it('end before start, one date only, or > 60 days -> invalid', () => {
    expect(newTripSchema.safeParse({ title: 'T', start_date: '2026-11-03', end_date: '2026-11-01' }).success).toBe(false)
    expect(newTripSchema.safeParse({ title: 'T', start_date: '2026-11-03' }).success).toBe(false)
    expect(newTripSchema.safeParse({ title: 'T', start_date: '2026-01-01', end_date: '2026-03-15' }).success).toBe(false)
    expect(newTripSchema.safeParse({ title: 'T', start_date: '2026-11-01', end_date: '2026-11-03' }).success).toBe(true)
    expect(newTripSchema.safeParse({ title: '  ' }).success).toBe(false)
  })
  it('a move to another day needs a position; an empty patch is invalid', () => {
    expect(patchStopSchema.safeParse({ day_id: '11111111-1111-4111-8111-111111111111' }).success).toBe(false)
    expect(patchStopSchema.safeParse({}).success).toBe(false)
    expect(patchStopSchema.safeParse({ time: null }).success).toBe(true)
  })
})

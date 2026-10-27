import { describe, expect, it } from 'vitest'
import { currentTripId, ownedTripId } from './current-trip'

type Row = Record<string, unknown>

/** `trips` stand-in: eq / is filters, order by created_at desc, limit, maybeSingle; insert ... select ... single. */
function fakeDb(seed: Row[]) {
  const rows = [...seed]
  let inserts = 0
  const db = {
    from: () => {
      const filters: ((r: Row) => boolean)[] = []
      let pending: Row | null = null
      const q = {
        select: () => q,
        eq: (c: string, v: unknown) => (filters.push((r) => r[c] === v), q),
        is: (c: string, v: unknown) => (filters.push((r) => (r[c] ?? null) === v), q),
        order: () => q,
        limit: () => q,
        insert: (v: Row) => ((pending = v), q),
        maybeSingle: async () => {
          const hit = rows.filter((r) => filters.every((f) => f(r))).sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)))[0]
          return { data: hit ?? null, error: null }
        },
        single: async () => {
          inserts++
          const row = { id: `new-${inserts}`, created_at: `2026-10-27T00:00:0${inserts}Z`, deleted_at: null, ...pending }
          rows.push(row)
          return { data: row, error: null }
        },
      }
      return q
    },
  }
  return { db: db as never, inserts: () => inserts }
}

const trip = (id: string, user_id: string, over: Row = {}): Row => ({ id, user_id, created_at: '2026-10-01T00:00:00Z', deleted_at: null, ...over })

describe('currentTripId', () => {
  it('no trip and create: false -> null, nothing inserted', async () => {
    const f = fakeDb([])
    expect(await currentTripId(f.db, 'u1', { create: false })).toBeNull()
    expect(f.inserts()).toBe(0)
  })

  it('create: true inserts "My trip" once; a second call reuses it', async () => {
    const f = fakeDb([])
    const first = await currentTripId(f.db, 'u1', { create: true })
    const second = await currentTripId(f.db, 'u1', { create: true })
    expect(first).toBe('new-1')
    expect(second).toBe('new-1')
    expect(f.inserts()).toBe(1)
  })

  it('picks the newest non-deleted trip of this user', async () => {
    const f = fakeDb([
      trip('old', 'u1'),
      trip('newer', 'u1', { created_at: '2026-10-10T00:00:00Z' }),
      trip('deleted', 'u1', { created_at: '2026-10-20T00:00:00Z', deleted_at: '2026-10-21T00:00:00Z' }),
      trip('theirs', 'u2', { created_at: '2026-10-25T00:00:00Z' }),
    ])
    expect(await currentTripId(f.db, 'u1', { create: false })).toBe('newer')
  })
})

describe('ownedTripId', () => {
  it('another user\'s trip or a deleted one -> null', async () => {
    const f = fakeDb([trip('t1', 'u1'), trip('gone', 'u1', { deleted_at: '2026-10-02T00:00:00Z' })])
    expect(await ownedTripId(f.db, 'u1', 't1')).toBe('t1')
    expect(await ownedTripId(f.db, 'u2', 't1')).toBeNull()
    expect(await ownedTripId(f.db, 'u1', 'gone')).toBeNull()
  })
})

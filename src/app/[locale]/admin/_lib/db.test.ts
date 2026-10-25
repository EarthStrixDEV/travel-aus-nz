import { describe, expect, it } from 'vitest'
import { syncChildren } from './db'

type Result = { data?: unknown; error: { code?: string } | null }

function fakeDb(results: Record<string, Result>) {
  const calls: { table: string; op: string; args: unknown[] }[] = []
  const from = (table: string) => {
    let op = 'select'
    const b: Record<string, unknown> = {}
    for (const m of ['select', 'upsert', 'delete', 'eq', 'match']) {
      b[m] = (...args: unknown[]) => {
        if (m === 'upsert' || m === 'delete') op = m
        calls.push({ table, op: m, args })
        return b
      }
    }
    b.then = (resolve: (r: Result) => unknown) => resolve(results[`${table}.${op}`] ?? { data: null, error: null })
    return b
  }
  return { db: { from } as never, calls }
}

const J = 'j0000000-0000-4000-8000-000000000001'

describe('syncChildren', () => {
  it('journey legs: upserts on (journey_id, seq), then deletes only the trailing seqs', async () => {
    const { db, calls } = fakeDb({ 'journey_legs.select': { data: [{ seq: 1 }, { seq: 2 }, { seq: 3 }], error: null } })
    const rows = [1, 2].map((seq) => ({ journey_id: J, seq, mode: 'train' as const }))
    expect(await syncChildren(db, 'journey_legs', { parent: ['journey_id', J], keys: ['seq'], rows })).toBeNull()
    expect(calls.find((c) => c.op === 'upsert')!.args).toEqual([rows, { onConflict: 'journey_id,seq' }])
    expect(calls.filter((c) => c.op === 'match').map((c) => c.args[0])).toEqual([{ journey_id: J, seq: 3 }])
  })

  it('collection items: an empty new set deletes every existing item (no upsert)', async () => {
    const { db, calls } = fakeDb({ 'collection_items.select': { data: [{ entity_id: 'a' }, { entity_id: 'b' }], error: null } })
    expect(await syncChildren(db, 'collection_items', { parent: ['collection_id', J], keys: ['entity_id'], rows: [] })).toBeNull()
    expect(calls.some((c) => c.op === 'upsert')).toBe(false)
    expect(calls.filter((c) => c.op === 'match')).toHaveLength(2)
  })

  it('a failed upsert returns the error before reading or deleting anything', async () => {
    const { db, calls } = fakeDb({ 'collection_items.upsert': { error: { code: '23503' } } })
    const rows = [{ collection_id: J, entity_id: 'a', position: 1 }]
    expect(await syncChildren(db, 'collection_items', { parent: ['collection_id', J], keys: ['entity_id'], rows })).toEqual({ code: '23503' })
    expect(calls.map((c) => c.op)).toEqual(['upsert'])
  })
})

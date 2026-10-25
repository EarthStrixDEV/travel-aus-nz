import { beforeEach, describe, expect, it, vi } from 'vitest'
import { FX_CODES } from './constants'
import { ingestFx, rollDailyCloses } from './ingest'
import type { FxProvider } from './provider'

const USD: Record<string, number> = { AUD: 1.5, NZD: 1.65, THB: 33, EUR: 0.9, GBP: 0.77, JPY: 150, SGD: 1.3, CNY: 7.2 }

const ok = (name: string, rates = USD): FxProvider => ({ name, fetchUsdRates: vi.fn().mockResolvedValue(rates) })
const boom = (name: string): FxProvider => ({ name, fetchUsdRates: vi.fn().mockRejectedValue(new Error('down')) })

const insert = vi.fn()
const from = vi.fn(() => ({ insert }))
const db = { from } as never

beforeEach(() => {
  vi.clearAllMocks()
  vi.spyOn(console, 'error').mockImplementation(() => {})
  insert.mockResolvedValue({ error: null })
})

describe('ingestFx', () => {
  it('asks providers for the 8 codes and writes an AUD-based snapshot', async () => {
    const primary = ok('primary')
    const res = await ingestFx([primary], db, new Date('2026-10-25T01:00:00Z'))
    expect(primary.fetchUsdRates).toHaveBeenCalledWith([...FX_CODES])
    expect(res).toEqual({ written: true, source: 'primary' })
    expect(from).toHaveBeenCalledWith('fx_snapshots')
    const row = insert.mock.calls[0][0]
    expect(row).toMatchObject({ fetched_at: '2026-10-25T01:00:00.000Z', base: 'AUD', source: 'primary' })
    expect(row.rates.THB).toBeCloseTo(22, 6)
    expect(row.rates.AUD).toBe(1)
  })

  it('primary throws, backup ok -> written with the backup source', async () => {
    const res = await ingestFx([boom('primary'), ok('backup')], db)
    expect(res).toEqual({ written: true, source: 'backup' })
    expect(insert).toHaveBeenCalledTimes(1)
    expect(insert.mock.calls[0][0].source).toBe('backup')
  })

  it('a provider that omits a code is skipped for the next one', async () => {
    const partial = { ...USD }
    delete partial.JPY
    const res = await ingestFx([ok('partial', partial), ok('backup')], db)
    expect(res.source).toBe('backup')
  })

  it('rejects non-positive or non-finite rates', async () => {
    const res = await ingestFx([ok('bad', { ...USD, THB: 0 }), ok('nan', { ...USD, THB: NaN }), ok('good')], db)
    expect(res.source).toBe('good')
  })

  it('both throw -> written false and no insert', async () => {
    const res = await ingestFx([boom('primary'), boom('backup')], db)
    expect(res).toEqual({ written: false })
    expect(insert).not.toHaveBeenCalled()
  })

  it('a failed insert surfaces as an error (the cron must not report success)', async () => {
    insert.mockResolvedValue({ error: { message: 'rls' } })
    await expect(ingestFx([ok('primary')], db)).rejects.toThrow(/rls/)
  })
})

describe('rollDailyCloses', () => {
  function makeDb(snapshots: { fetched_at: string; rates: Record<string, number> }[]) {
    const upsert = vi.fn().mockResolvedValue({ error: null })
    const delLt = vi.fn().mockResolvedValue({ error: null })
    const gte = vi.fn()
    const lt = vi.fn()
    const order = vi.fn().mockResolvedValue({ data: snapshots, error: null })
    const select = () => ({
      gte: (...a: unknown[]) => {
        gte(...a)
        return {
          lt: (...b: unknown[]) => {
            lt(...b)
            return { order }
          },
        }
      },
    })
    const from = vi.fn((table: string) => (table === 'fx_snapshots' ? { select, delete: () => ({ lt: delLt }) } : { upsert }))
    return { db: { from } as never, upsert, delLt, gte, lt }
  }

  it('upserts the last snapshot of the previous UTC day per quote and prunes >30 days', async () => {
    // Ordered newest first, as the query asks for.
    const m = makeDb([
      { fetched_at: '2026-10-24T23:00:00Z', rates: { AUD: 1, NZD: 1.12, THB: 22 } },
      { fetched_at: '2026-10-24T05:00:00Z', rates: { AUD: 1, NZD: 1.1, THB: 21, USD: 0.66 } },
    ])
    const res = await rollDailyCloses(m.db, new Date('2026-10-25T00:10:00Z'))
    expect(m.gte).toHaveBeenCalledWith('fetched_at', '2026-10-24T00:00:00.000Z')
    expect(m.lt).toHaveBeenCalledWith('fetched_at', '2026-10-25T00:00:00.000Z')
    const [rows, opts] = m.upsert.mock.calls[0]
    expect(opts).toEqual({ onConflict: 'day,quote' })
    expect(rows).toHaveLength(3)
    expect(rows).toEqual(
      expect.arrayContaining([
        { day: '2026-10-24', quote: 'NZD', close: 1.12 },
        { day: '2026-10-24', quote: 'THB', close: 22 },
        { day: '2026-10-24', quote: 'USD', close: 0.66 }, // only present in the earlier snapshot
      ]),
    )
    expect(m.delLt).toHaveBeenCalledWith('fetched_at', '2026-09-25T00:10:00.000Z')
    expect(res).toEqual({ day: '2026-10-24', quotes: 3 })
  })

  it('no snapshots yesterday -> nothing upserted, still prunes', async () => {
    const m = makeDb([])
    const res = await rollDailyCloses(m.db, new Date('2026-10-25T00:10:00Z'))
    expect(m.upsert).not.toHaveBeenCalled()
    expect(m.delLt).toHaveBeenCalled()
    expect(res).toEqual({ day: '2026-10-24', quotes: 0 })
  })
})

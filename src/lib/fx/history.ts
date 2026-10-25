import { z } from 'zod'
import type { Client } from '@/lib/content/shared'
import { ALL_CODES } from './constants'
import { getCloses, type FxClose } from './queries'

export const RANGE_DAYS = { '7d': 7, '1m': 30, '3m': 90, '1y': 365 } as const
export type HistoryRange = keyof typeof RANGE_DAYS

export type HistoryPoint = { day: string; close: number }
export type History = { points: HistoryPoint[]; high: number | null; low: number | null; change: number | null }

/** `AUD-THB` / `NZD-THB`: base is AUD or NZD, quote any other known currency. */
export const pairSchema = z
  .string()
  .regex(/^(AUD|NZD)-[A-Z]{3}$/, 'pair must be AUD-XXX or NZD-XXX')
  .refine((p) => {
    const [base, quote] = p.split('-')
    return base !== quote && (ALL_CODES as readonly string[]).includes(quote)
  }, 'unknown or identical quote currency')

export const historyQuerySchema = z.object({
  pair: pairSchema,
  range: z.enum(Object.keys(RANGE_DAYS) as [HistoryRange, ...HistoryRange[]], 'range must be 7d, 1m, 3m or 1y'),
})

/** Quotes whose `fx_daily` rows a pair needs (`fx_daily` has no AUD row: AUD is the base). */
export function quotesFor(base: string, quote: string): string[] {
  const needed = [quote, ...(base === 'NZD' ? ['NZD'] : [])]
  return needed.filter((c) => c !== 'AUD')
}

/** AUD base: `close(Q)`. NZD base: `close(Q) / close(NZD)` per day (a day missing either side is dropped). */
export function buildHistory(base: string, quote: string, closes: FxClose[]): History {
  const byDay = new Map<string, Record<string, number>>()
  for (const c of closes) byDay.set(c.day, { ...byDay.get(c.day), [c.quote]: c.close })

  const points: HistoryPoint[] = []
  for (const [day, q] of [...byDay].sort(([a], [b]) => a.localeCompare(b))) {
    const per = (c: string) => (c === 'AUD' ? 1 : q[c]) // units of `c` per 1 AUD that day
    const num = per(quote)
    const den = base === 'NZD' ? per('NZD') : 1
    if (num > 0 && den > 0) points.push({ day, close: num / den })
  }
  if (!points.length) return { points, high: null, low: null, change: null }

  const values = points.map((p) => p.close)
  return {
    points,
    high: Math.max(...values),
    low: Math.min(...values),
    change: ((values[values.length - 1] - values[0]) / values[0]) * 100,
  }
}

export async function loadHistory(db: Client, base: string, quote: string, range: HistoryRange): Promise<History> {
  return buildHistory(base, quote, await getCloses(db, quotesFor(base, quote), RANGE_DAYS[range]))
}

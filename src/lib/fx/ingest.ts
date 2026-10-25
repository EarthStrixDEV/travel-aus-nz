import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/supabase/database.types'
import { FX_CODES } from './constants'
import type { FxProvider } from './provider'
import { rebaseToAud } from './rebase'

type Db = SupabaseClient<Database>

const DAY_MS = 86_400_000
const RETAIN_DAYS = 30

function complete(usd: Record<string, number>): boolean {
  return FX_CODES.every((code) => Number.isFinite(usd[code]) && usd[code] > 0)
}

/**
 * First provider that returns all 8 codes wins; its USD rates are rebased to AUD and stored as one
 * `fx_snapshots` row. Every provider failing writes nothing (the API keeps serving the old row as stale).
 */
export async function ingestFx(
  providers: FxProvider[],
  db: Db,
  now: Date = new Date(),
): Promise<{ written: boolean; source?: string }> {
  for (const provider of providers) {
    let usd: Record<string, number>
    try {
      usd = await provider.fetchUsdRates([...FX_CODES])
    } catch (err) {
      console.error(`[fx-ingest] ${provider.name} failed`, err)
      continue
    }
    if (!complete(usd)) {
      console.error(`[fx-ingest] ${provider.name} returned an incomplete or invalid rate set`)
      continue
    }
    const { error } = await db
      .from('fx_snapshots')
      .insert({ fetched_at: now.toISOString(), base: 'AUD', rates: rebaseToAud(usd), source: provider.name })
    if (error) throw new Error(`fx_snapshots insert failed: ${error.message}`)
    return { written: true, source: provider.name }
  }
  return { written: false }
}

/**
 * `fx-daily` (00:10 UTC): close = the last snapshot of the previous UTC day, per quote, upserted into
 * `fx_daily`; then snapshots older than 30 days are deleted.
 */
export async function rollDailyCloses(db: Db, now: Date = new Date()): Promise<{ day: string; quotes: number }> {
  const today = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())
  const from = new Date(today - DAY_MS)
  const day = from.toISOString().slice(0, 10)

  const { data, error } = await db
    .from('fx_snapshots')
    .select('fetched_at, rates')
    .gte('fetched_at', from.toISOString())
    .lt('fetched_at', new Date(today).toISOString())
    .order('fetched_at', { ascending: false })
  if (error) throw new Error(`fx_snapshots read failed: ${error.message}`)

  // Newest first, so the first value seen for a quote is that day's close.
  const closes = new Map<string, number>()
  for (const snap of data ?? []) {
    const rates = snap.rates as Record<string, number>
    for (const [quote, close] of Object.entries(rates)) {
      if (quote === 'AUD' || closes.has(quote) || !Number.isFinite(close)) continue
      closes.set(quote, close)
    }
  }

  if (closes.size) {
    const rows = [...closes].map(([quote, close]) => ({ day, quote, close }))
    const { error: upsertError } = await db.from('fx_daily').upsert(rows, { onConflict: 'day,quote' })
    if (upsertError) throw new Error(`fx_daily upsert failed: ${upsertError.message}`)
  }

  const cutoff = new Date(now.getTime() - RETAIN_DAYS * DAY_MS).toISOString()
  const { error: pruneError } = await db.from('fx_snapshots').delete().lt('fetched_at', cutoff)
  if (pruneError) throw new Error(`fx_snapshots prune failed: ${pruneError.message}`)

  return { day, quotes: closes.size }
}

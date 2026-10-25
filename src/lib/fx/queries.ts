import type { Locale } from '@/lib/i18n/t'
import { asI18n, text, type Client } from '@/lib/content/shared'

export type FxSnapshot = { base: string; rates: Record<string, number>; fetched_at: string; source: string }
export type FxClose = { day: string; quote: string; close: number }

export type CostItem = { id: number; item: string; note: string; aud: number | null; nzd: number | null }
export type BudgetPreset = { country: 'AU' | 'NZ'; style: 'budget' | 'comfortable' | 'luxury'; perDay: number; note: string }
export type MoneyTip = { title: string; text: string }
export type FxReference = { costs: CostItem[]; budgets: BudgetPreset[]; tips: MoneyTip[]; verifiedAt: string | null }

const DAY_MS = 86_400_000

/** Newest `fx_snapshots` row, or null when nothing has been ingested yet. */
export async function getLatestSnapshot(db: Client): Promise<FxSnapshot | null> {
  const { data, error } = await db
    .from('fx_snapshots')
    .select('base, rates, fetched_at, source')
    .order('fetched_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (error) throw new Error(`fx_snapshots read failed: ${error.message}`)
  if (!data) return null
  const rates: Record<string, number> = {}
  if (data.rates && typeof data.rates === 'object' && !Array.isArray(data.rates)) {
    for (const [code, v] of Object.entries(data.rates)) if (typeof v === 'number' && Number.isFinite(v)) rates[code] = v
  }
  return { base: data.base, rates, fetched_at: data.fetched_at, source: data.source }
}

/** Daily closes (AUD base) for the given quotes over the last `days` days, oldest first. */
export async function getCloses(db: Client, quotes: string[], days: number): Promise<FxClose[]> {
  const since = new Date(Date.now() - days * DAY_MS).toISOString().slice(0, 10)
  const { data, error } = await db
    .from('fx_daily')
    .select('day, quote, close')
    .in('quote', quotes)
    .gte('day', since)
    .order('day', { ascending: true })
    .limit(2000)
  if (error) throw new Error(`fx_daily read failed: ${error.message}`)
  return (data ?? []).flatMap((r) => (r.close === null || !Number.isFinite(Number(r.close)) ? [] : [{ day: r.day, quote: r.quote, close: Number(r.close) }]))
}

/**
 * `content_blocks.money_tips.body_i18n` is `{ en: [{ title, text }], th: [...] }`. Anything else
 * (the shipped `{}`) yields no tips and the page falls back to its bundled copy.
 */
function parseTips(body: unknown, locale: Locale): MoneyTip[] {
  const map = body && typeof body === 'object' && !Array.isArray(body) ? (body as Record<string, unknown>) : {}
  const raw = map[locale] ?? map.en
  if (!Array.isArray(raw)) return []
  return raw.flatMap((t) => {
    const o = t as { title?: unknown; text?: unknown } | null
    return o && typeof o.title === 'string' && typeof o.text === 'string' ? [{ title: o.title, text: o.text }] : []
  })
}

export async function getReference(db: Client, locale: Locale): Promise<FxReference> {
  const [costs, budgets, tips] = await Promise.all([
    db.from('cost_reference_items').select('id, item_i18n, note_i18n, aud, nzd, verified_at').order('sort', { ascending: true }),
    db.from('budget_presets').select('country, style, per_day, note_i18n'),
    db.from('content_blocks').select('body_i18n').eq('key', 'money_tips').maybeSingle(),
  ])
  if (costs.error) throw new Error(`cost_reference_items read failed: ${costs.error.message}`)
  if (budgets.error) throw new Error(`budget_presets read failed: ${budgets.error.message}`)
  if (tips.error) throw new Error(`content_blocks read failed: ${tips.error.message}`)

  const rows = costs.data ?? []
  return {
    costs: rows.map((r) => ({
      id: r.id,
      item: text(asI18n(r.item_i18n), locale),
      note: text(asI18n(r.note_i18n), locale),
      aud: r.aud === null ? null : Number(r.aud),
      nzd: r.nzd === null ? null : Number(r.nzd),
    })),
    budgets: (budgets.data ?? []).flatMap((b) =>
      (b.country === 'AU' || b.country === 'NZ') && (b.style === 'budget' || b.style === 'comfortable' || b.style === 'luxury')
        ? [{ country: b.country, style: b.style, perDay: Number(b.per_day), note: text(asI18n(b.note_i18n), locale) }]
        : [],
    ),
    tips: parseTips(tips.data?.body_i18n, locale),
    verifiedAt: rows.map((r) => r.verified_at).sort().at(-1) ?? null,
  }
}

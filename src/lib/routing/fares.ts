import { z } from 'zod'
import type { Json } from '@/lib/supabase/database.types'
import type { RouteLeg, RouteOption, TransitMode } from './types'

export type FareRuleRow = { agency_id: number | null; mode: TransitMode | null; rule: Json }
export type AgencyRow = { id: number; name: string; country: 'AU' | 'NZ'; card_id: number | null }
export type CardRow = { id: number; name: string; contactless: boolean | null }

const hhmm = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$|^24:00$/)
const price = z.number().nonnegative()

/** `days`: 0 = Sunday … 6 = Saturday. `from` inclusive, `to` exclusive, local time; `to` may be "24:00". */
const offpeakWindow = z.object({ days: z.array(z.number().int().min(0).max(6)), from: hhmm, to: hhmm })
export type OffpeakWindow = z.infer<typeof offpeakWindow>

/**
 * `fare_rules.rule` shapes we model (plan Deviation 2). Zone fares are not modelled; any other shape
 * is ignored, so the leg counts as "no rule" and the option's fares are null.
 */
export const fareRule = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('flat'), peak: price, offpeak: price, offpeak_windows: z.array(offpeakWindow).optional() }),
  z.object({
    kind: z.literal('distance'),
    bands: z.array(z.object({ upto_km: z.number().positive(), peak: price, offpeak: price })).min(1),
    daily_cap: price.optional(),
    offpeak_windows: z.array(offpeakWindow).optional(),
  }),
])
export type FareRule = z.infer<typeof fareRule>

/**
 * Off-peak window used when a rule sets no `offpeak_windows`: weekdays before 07:00 and from 19:00,
 * plus all weekend. A deliberately simple common denominator of the AU/NZ card schemes; editors put
 * an operator's exact windows (e.g. Opal's 06:30–10:00 / 15:00–19:00 peaks) on the rule itself.
 */
export const DEFAULT_OFFPEAK_WINDOWS: OffpeakWindow[] = [
  { days: [1, 2, 3, 4, 5], from: '00:00', to: '07:00' },
  { days: [1, 2, 3, 4, 5], from: '19:00', to: '24:00' },
  { days: [0, 6], from: '00:00', to: '24:00' },
]

/** `departLocal` is the city-local `YYYY-MM-DDTHH:mm` the user asked for. */
export function isOffpeak(departLocal: string, windows: OffpeakWindow[] = DEFAULT_OFFPEAK_WINDOWS): boolean {
  const [date, hm] = departLocal.split('T')
  const [y, m, d] = date.split('-').map(Number)
  const day = new Date(Date.UTC(y, m - 1, d)).getUTCDay()
  return windows.some((w) => w.days.includes(day) && hm >= w.from && hm < w.to)
}

function legPrice(rule: FareRule, leg: RouteLeg): { peak: number; offpeak: number } {
  if (rule.kind === 'flat') return rule
  const km = leg.distance_m / 1000
  const bands = [...rule.bands].sort((a, b) => a.upto_km - b.upto_km)
  return bands.find((b) => km <= b.upto_km) ?? bands[bands.length - 1]
}

/** Agency + mode rule beats the agency-wide (`mode` null) rule. Unparseable rules are skipped. */
function ruleFor(rules: FareRuleRow[], agencyId: number, mode: TransitMode): FareRule | null {
  const candidates = rules.filter((r) => r.agency_id === agencyId && (r.mode === mode || r.mode === null))
  candidates.sort((a, b) => (a.mode === null ? 1 : 0) - (b.mode === null ? 1 : 0))
  for (const c of candidates) {
    const parsed = fareRule.safeParse(c.rule)
    if (parsed.success) return parsed.data
  }
  return null
}

const round2 = (n: number) => Math.round(n * 100) / 100

/**
 * Adds `fare_min` (off-peak), `fare_max` (peak), `currency` and `card` to provider options.
 * Fares are null when any transit leg's agency is unknown or has no usable rule. A rule's
 * `daily_cap` clamps that agency's subtotal. `card` is the first matched agency's card,
 * "+ or contactless" when the card scheme takes it, "+ · off-peak" when `departLocal` is in
 * that agency's off-peak window (the design's "Opal or contactless · off-peak").
 */
export function applyFares(
  options: RouteOption[],
  rules: FareRuleRow[],
  agencies: AgencyRow[],
  cards: CardRow[],
  departLocal: string,
): RouteOption[] {
  const agencyByName = new Map(agencies.map((a) => [a.name.trim().toLowerCase(), a]))
  const cardById = new Map(cards.map((c) => [c.id, c]))

  return options.map((option) => {
    const transit = option.legs
      .filter((l) => l.mode !== 'walk')
      .map((leg) => {
        const agency = agencyByName.get(leg.agency?.trim().toLowerCase() ?? '')
        return { leg, agency, rule: agency ? ruleFor(rules, agency.id, leg.mode) : null }
      })

    let fareMin: number | null = 0
    let fareMax: number | null = 0
    if (transit.some((t) => !t.rule)) {
      fareMin = fareMax = null
    } else {
      const byAgency = new Map<number, { min: number; max: number; cap?: number }>()
      for (const t of transit) {
        // Every leg has a rule here, and a rule implies a matched agency.
        const rule = t.rule!
        const agencyId = t.agency!.id
        const p = legPrice(rule, t.leg)
        const sub = byAgency.get(agencyId) ?? { min: 0, max: 0 }
        sub.min += p.offpeak
        sub.max += p.peak
        if (rule.kind === 'distance' && rule.daily_cap !== undefined) sub.cap = Math.min(sub.cap ?? Infinity, rule.daily_cap)
        byAgency.set(agencyId, sub)
      }
      for (const sub of byAgency.values()) {
        fareMin += Math.min(sub.min, sub.cap ?? Infinity)
        fareMax += Math.min(sub.max, sub.cap ?? Infinity)
      }
      fareMin = round2(fareMin)
      fareMax = round2(fareMax)
    }

    const lead = transit.find((t) => t.agency)
    const card = lead?.agency?.card_id != null ? cardById.get(lead.agency.card_id) : undefined
    const offpeak = isOffpeak(departLocal, lead?.rule?.offpeak_windows)
    const cardLabel = card ? `${card.name}${card.contactless ? ' or contactless' : ''}${offpeak ? ' · off-peak' : ''}` : null

    return {
      ...option,
      fare_min: fareMin,
      fare_max: fareMax,
      currency: lead?.agency ? (lead.agency.country === 'NZ' ? 'NZD' : 'AUD') : option.currency,
      card: cardLabel,
    }
  })
}

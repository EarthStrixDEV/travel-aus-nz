import { z } from 'zod'
import { country, date, i18nOptional, i18nRequired, int, money } from '../_lib/form'

export const STYLES = ['budget', 'comfortable', 'luxury'] as const

export const costItemSchema = z.object({
  ...i18nRequired('item'),
  ...i18nOptional('note'),
  aud: money.optional(),
  nzd: money.optional(),
  verified_at: date,
  sort: int(-2147483648, 2147483647).optional(),
})

const presetKeyShape = { country, style: z.enum(STYLES, 'choice') }

export const budgetPresetSchema = z.object({
  ...presetKeyShape,
  per_day: money,
  ...i18nRequired('note'),
})

export type PresetKey = { country: 'AU' | 'NZ'; style: (typeof STYLES)[number] }

/** budget_presets is keyed by (country, style); edit URLs carry it as `AU-budget`. */
export const presetKey = (k: PresetKey) => `${k.country}-${k.style}`

export function parsePresetKey(raw: string): PresetKey | null {
  const [c, style, ...rest] = raw.split('-')
  if (rest.length > 0) return null
  const r = z.object(presetKeyShape).safeParse({ country: c, style })
  return r.success ? r.data : null
}

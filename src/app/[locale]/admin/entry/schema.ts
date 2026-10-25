import { z } from 'zod'
import { checkbox, country, date, i18nOptional, i18nRequired, int, optional, slug } from '../_lib/form'

export const PURPOSES = ['tourism', 'work_study'] as const
export const STAYS = ['lt1', '1to3', 'gt3'] as const

export const permissionTypeSchema = z.object({
  country,
  slug,
  ...i18nRequired('name'),
  ...i18nOptional('plain'),
  ...i18nOptional('who'),
  ...i18nOptional('how'),
  ...i18nOptional('good'),
  processing_text: optional,
  fee_text: optional,
  validity_text: optional,
  official_link_id: int(1, 2147483647).optional(),
  verified_at: date.optional(),
  needs_review: checkbox,
})

const ruleKeyShape = {
  // ISO 3166-1 alpha-2, stored upper-case.
  nationality: z
    .string()
    .regex(/^[A-Za-z]{2}$/, 'nationality')
    .transform((s) => s.toUpperCase()),
  country,
  purpose: z.enum(PURPOSES, 'choice'),
  stay: z.enum(STAYS, 'choice'),
}

export const entryRuleSchema = z.object({
  ...ruleKeyShape,
  permission_id: int(1, 2147483647).optional(),
  verified_at: date.optional(),
  needs_review: checkbox,
})

export type RuleKey = { nationality: string; country: 'AU' | 'NZ'; purpose: (typeof PURPOSES)[number]; stay: (typeof STAYS)[number] }

/** entry_rules has a composite primary key; edit URLs carry it as `TH-AU-tourism-lt1`. */
export function ruleKey(k: RuleKey): string {
  return `${k.nationality}-${k.country}-${k.purpose}-${k.stay}`
}

export function parseRuleKey(raw: string): RuleKey | null {
  const [nationality, country, purpose, stay, ...rest] = raw.split('-')
  if (rest.length > 0) return null
  const r = z.object(ruleKeyShape).safeParse({ nationality, country, purpose, stay })
  return r.success ? r.data : null
}

export const officialLinkSchema = z.object({
  country: country.optional(),
  agency: optional,
  ...i18nRequired('title'),
  // Official government pages only, so https.
  url: z.url({ protocol: /^https$/, error: 'url' }).max(2000, 'tooLong'),
})

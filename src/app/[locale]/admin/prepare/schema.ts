import { z } from 'zod'
import { MOMENTS, SEASONS } from '@/lib/prepare/data'
import { COUNTRIES, date, i18nOptional, i18nRequired, int, many, optional, slug } from '../_lib/form'

/** Facts / health rows offered on the content-block form. */
export const MAX_BLOCK_ITEMS = 12
/** Content blocks edited here: two item lists for Prepare, one text for Transport. */
export const BLOCK_KEYS = ['facts', 'health', 'transport_tips'] as const
export type BlockKey = (typeof BLOCK_KEYS)[number]
export const isBlockKey = (k: string): k is BlockKey => (BLOCK_KEYS as readonly string[]).includes(k)

export const checklistSchema = z.object({
  slug: slug.optional(),
  moment: z.enum(MOMENTS, 'choice'),
  ...i18nRequired('title'),
  ...i18nOptional('note'),
  applies_to: many(z.enum(COUNTRIES, 'choice')).refine((v) => v.length > 0, 'required'),
  sort: int(-10000, 10000).default(0),
})

export const packingSchema = z.object({
  season: z.enum(SEASONS, 'choice'),
  grp: optional,
  ...i18nRequired('title'),
  sort: int(-10000, 10000).default(0),
})

export const connectivitySchema = z.object({
  ...i18nRequired('name'),
  ...i18nOptional('setup'),
  ...i18nOptional('best'),
  ...i18nOptional('watch'),
  cost_text: optional,
  verified_at: date.optional(),
})

const level = int(0, 3)

/** One region's 12 months: comfort and crowds 0–3, plus the recommended window. */
export const monthsSchema = z.object({
  months: z
    .array(z.object({ comfort: level.optional(), crowds: level.optional(), recommended: z.boolean() }))
    .length(12),
})

const blockItem = z.object({ ...i18nRequired('title'), ...i18nRequired('text'), icon: optional })

/** facts / health: `{ en: [{ title, text, icon? }], th: [...] }`, as `parseTitledItems` reads it. */
export const itemsBlockSchema = z
  .object({ items: z.array(blockItem).max(MAX_BLOCK_ITEMS).default([]), verified_at: date.optional() })
  .transform((d) => ({
    body_i18n: {
      en: d.items.map((i) => ({ title: i.title_en, text: i.text_en, ...(i.icon ? { icon: i.icon } : {}) })),
      th: d.items.map((i) => ({ title: i.title_th, text: i.text_th, ...(i.icon ? { icon: i.icon } : {}) })),
    },
    verified_at: d.verified_at ?? null,
  }))

/** transport_tips: plain `{ en, th }` text. */
export const textBlockSchema = z
  .object({ ...i18nRequired('body'), verified_at: date.optional() })
  .transform((d) => ({ body_i18n: { en: d.body_en, th: d.body_th }, verified_at: d.verified_at ?? null }))

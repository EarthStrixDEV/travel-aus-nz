import { z } from 'zod'
import { i18nOptional, i18nRequired, optional, slug, status, uuid } from '../_lib/form'

export const COLLECTION_KINDS = ['venue', 'dish', 'place'] as const
/** Item rows offered on the form; position = row order. */
export const MAX_ITEMS = 12

export const collectionSchema = z.object({
  slug,
  kind: z.enum(COLLECTION_KINDS, 'choice'),
  placement: optional,
  ...i18nRequired('title'),
  ...i18nOptional('sub'),
  status,
  items: z
    .array(uuid)
    .max(MAX_ITEMS)
    .default([])
    .refine((list) => new Set(list).size === list.length, 'duplicateRow'),
})

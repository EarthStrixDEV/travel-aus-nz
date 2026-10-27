import { z } from 'zod'
import { DISH_DIETS, DISH_TYPES } from '@/lib/dishes/filter'
import { country, date, i18nOptional, i18nRequired, int, licensedMedia, many, mediaList, optional, slug, status, uuid } from '../_lib/form'

/** Pairing rows ("Best paired with": key / value) and "Where to try it" rows offered on the form. */
export const MAX_PAIRINGS = 6
export const MAX_VENUES = 9

const pairingRow = z.object({ ...i18nOptional('k'), ...i18nOptional('v') })

const venueRow = z.object({
  place_id: uuid,
  region_id: int(1, 2147483647),
  rank: int(1, 99),
  price_text: optional,
  ...i18nOptional('note'),
})

export const dishSchema = z
  .object({
    slug,
    country,
    region_id: int(1, 2147483647).optional(),
    type: z.enum(DISH_TYPES, 'choice'),
    ...i18nRequired('name'),
    ...i18nOptional('line'),
    ...i18nOptional('story'),
    ...i18nOptional('dispute'),
    ...i18nOptional('taste'),
    ...i18nOptional('served'),
    ...i18nOptional('allergy'),
    dietary: many(z.enum(DISH_DIETS, 'choice')),
    price_level: int(1, 4).optional(),
    price_text: optional,
    must_try_rank: int(1, 3).optional(),
    sort: int(-10000, 10000).default(0),
    cover_media_id: uuid.optional(),
    status,
    verified_at: date.optional(),
    pairings: z.array(pairingRow).max(MAX_PAIRINGS).default([]),
    venues: z.array(venueRow).max(MAX_VENUES).default([]),
    media: mediaList,
  })
  .superRefine(licensedMedia((d) => d.status === 'published', 'cover_media_id'))
  .superRefine((d, ctx) => {
    // dish_venues is keyed by (dish, place): a place listed twice is ambiguous.
    const seen = new Set<string>()
    for (const v of d.venues) {
      if (seen.has(v.place_id)) ctx.addIssue({ code: 'custom', message: 'duplicateRow', path: ['venues'] })
      seen.add(v.place_id)
    }
  })

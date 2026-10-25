import { z } from 'zod'
import {
  country,
  currency,
  i18nOptional,
  i18nRequired,
  int,
  licensedMedia,
  many,
  mediaList,
  money,
  optional,
  slug,
  status,
  TRANSIT_MODES,
  uuid,
} from '../_lib/form'

export const JOURNEY_KINDS = ['itinerary', 'route_showcase'] as const
/** Leg rows offered on the form. */
export const MAX_LEGS = 8

const mode = z.enum(TRANSIT_MODES, 'choice')

const legRow = z.object({
  mode,
  from_name: optional,
  to_name: optional,
  operator: optional,
  duration_min: int(0, 10000).optional(),
  frequency_text: optional,
  day: int(1, 365).default(1),
})

export const journeySchema = z
  .object({
    slug,
    kind: z.enum(JOURNEY_KINDS, 'choice'),
    country: country.optional(),
    ...i18nRequired('title'),
    ...i18nOptional('line'),
    from_name: optional,
    to_name: optional,
    days: int(1, 365).optional(),
    price_from: money.optional(),
    currency: currency.optional(),
    modes: many(mode),
    cover_media_id: uuid.optional(),
    status,
    legs: z.array(legRow).max(MAX_LEGS).default([]),
    media: mediaList,
  })
  .superRefine(licensedMedia((d) => d.status === 'published', 'cover_media_id'))

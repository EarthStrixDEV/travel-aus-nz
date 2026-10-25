import { z } from 'zod'
import {
  checkbox,
  date,
  httpUrl,
  i18nOptional,
  i18nRequired,
  int,
  lat,
  licensedMedia,
  lng,
  many,
  mediaList,
  optional,
  slug,
  status,
  time,
} from '../_lib/form'

export const PLACE_TYPES = ['attraction', 'restaurant', 'bar', 'cafe', 'station', 'village'] as const
/** Types that carry a 1:1 `venues` row (Eat & Drink). */
export const VENUE_TYPES = ['restaurant', 'bar', 'cafe'] as const
export const BOOKINGS = ['required', 'recommended', 'walk_in'] as const
// Slugs the Eat & Drink filters read (src/lib/venues/filter.ts).
export const DIETARY = ['vegetarian', 'vegan', 'gluten_free'] as const
export const DRINKS = ['wine', 'cocktails', 'beer', 'coffee', 'non_alc'] as const
/** Nearest-stop rows offered on the form (manual links in Phase 1). */
export const MAX_STOPS = 3

const MAX_ID = 2147483647

export const isVenueType = (type: string): type is (typeof VENUE_TYPES)[number] =>
  (VENUE_TYPES as readonly string[]).includes(type)

const hourRow = z.object({ weekday: int(0, 6), open_time: time.optional(), close_time: time.optional() })
type Hour = { weekday: number; open_time: string; close_time: string }

const stopRow = z.object({ stop_id: int(1, MAX_ID), walk_min: int(0, 240) })

const distinct = (keys: string[]) => new Set(keys).size === keys.length

export const placeSchema = z
  .object({
    city_id: int(1, MAX_ID),
    slug,
    type: z.enum(PLACE_TYPES, 'choice'),
    category: optional,
    ...i18nRequired('name'),
    ...i18nOptional('area'),
    ...i18nOptional('desc'),
    ...i18nOptional('best_time'),
    ...i18nOptional('access'),
    ...i18nOptional('price_note'),
    ...i18nOptional('hours_note'),
    lng,
    lat,
    price_level: int(0, 4).optional(),
    website: httpUrl.optional(),
    is_closed: checkbox,
    verified_at: date.optional(),
    status,
    tags: many(int(1, MAX_ID)),
    // Weekday rows: both times or neither (closed). close < open means "after midnight".
    hours: z
      .array(hourRow)
      .default([])
      .refine((list) => list.every((h) => !h.open_time === !h.close_time), 'hoursPair')
      .transform((list) => list.filter((h): h is Hour => Boolean(h.open_time && h.close_time)))
      .refine((list) => distinct(list.map((h) => `${h.weekday}@${h.open_time}`)), 'duplicateRow'),
    stops: z
      .array(stopRow)
      .max(MAX_STOPS)
      .default([])
      .refine((list) => distinct(list.map((s) => String(s.stop_id))), 'duplicateRow'),
    // Venue sub-form; only written when `type` is a venue type.
    cuisine_id: int(1, MAX_ID).optional(),
    booking: z.enum(BOOKINGS, 'choice').optional(),
    dietary: many(z.enum(DIETARY, 'choice')),
    drinks: many(z.enum(DRINKS, 'choice')),
    ...i18nOptional('menu_highlights'),
    ...i18nOptional('drinks_text'),
    /** Assets shown with this place (its gallery photos): publishing exposes them. */
    media: mediaList,
  })
  .superRefine(licensedMedia((d) => d.status === 'published', 'status'))

export type PlaceInput = z.infer<typeof placeSchema>

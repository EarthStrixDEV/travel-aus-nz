import { z } from 'zod'
import { fareRule } from '@/lib/routing/fares'
import {
  checkbox,
  country,
  currency,
  date,
  httpUrl,
  i18nOptional,
  i18nRequired,
  int,
  licensedMedia,
  mediaList,
  money,
  optional,
  required,
  slug,
  status,
  TRANSIT_MODES,
  uuid,
} from '../_lib/form'

const mode = z.enum(TRANSIT_MODES, 'choice')
const serial = int(1, 2147483647)
const minutes = int(0, 100000)

/** Stop rows on the line form, in travel order. */
export const MAX_LINE_STOPS = 40
/** Distance bands on the fare-rule form. */
export const MAX_FARE_BANDS = 8

export const agencySchema = z.object({
  country,
  name: required,
  website: httpUrl.optional(),
  gtfs_url: httpUrl.optional(),
  card_id: serial.optional(),
})

export const lineSchema = z.object({
  agency_id: serial.optional(),
  city_id: serial.optional(),
  mode,
  short_name: optional,
  long_name: optional,
  end_to_end_min: minutes.optional(),
  headway_peak_min: minutes.optional(),
  headway_offpeak_min: minutes.optional(),
  fare_min: money.optional(),
  fare_max: money.optional(),
  stops: z.array(serial).max(MAX_LINE_STOPS).default([]),
})

export const cardSchema = z.object({
  city_id: serial.optional(),
  name: required,
  contactless: checkbox,
  ...i18nOptional('how_to'),
  ...i18nOptional('caps'),
  official_url: httpUrl.optional(),
  verified_at: date.optional(),
})

const band = z.object({ upto_km: z.coerce.number('number').positive('range').max(10000, 'range'), peak: money, offpeak: money })

/**
 * A fare rule as posted: the two shapes the router reads (plan deviation 2). The output's `rule` is checked
 * against the router's own `fareRule` schema, so admin can never save a rule the planner would ignore.
 */
export const fareRuleSchema = z
  .object({
    agency_id: serial,
    mode: mode.optional(),
    currency,
    verified_at: date.optional(),
    kind: z.enum(['flat', 'distance'], 'choice'),
    peak: money.optional(),
    offpeak: money.optional(),
    daily_cap: money.optional(),
    bands: z.array(band).max(MAX_FARE_BANDS).default([]),
  })
  .superRefine((d, ctx) => {
    if (d.kind === 'flat') {
      if (d.peak === undefined) ctx.addIssue({ code: 'custom', message: 'required', path: ['peak'] })
      if (d.offpeak === undefined) ctx.addIssue({ code: 'custom', message: 'required', path: ['offpeak'] })
      return
    }
    if (d.bands.length === 0) ctx.addIssue({ code: 'custom', message: 'required', path: ['bands'] })
    for (let i = 1; i < d.bands.length; i++) {
      if (d.bands[i].upto_km <= d.bands[i - 1].upto_km) ctx.addIssue({ code: 'custom', message: 'range', path: ['bands'] })
    }
  })
  .transform((d) => ({
    agency_id: d.agency_id,
    mode: d.mode ?? null,
    currency: d.currency,
    verified_at: d.verified_at ?? null,
    rule:
      d.kind === 'flat'
        ? fareRule.parse({ kind: 'flat', peak: d.peak, offpeak: d.offpeak })
        : fareRule.parse({ kind: 'distance', bands: d.bands, ...(d.daily_cap !== undefined ? { daily_cap: d.daily_cap } : {}) }),
  }))

export const scenicSchema = z
  .object({
    country: country.optional(),
    mode: mode.optional(),
    slug,
    ...i18nRequired('name'),
    from_name: optional,
    to_name: optional,
    ...i18nOptional('line'),
    duration_text: optional,
    frequency_text: optional,
    fare_from: money.optional(),
    currency: currency.optional(),
    cover_media_id: uuid.optional(),
    status,
    media: mediaList,
  })
  .superRefine(licensedMedia((d) => d.status === 'published', 'cover_media_id'))

export const airportSchema = z.object({
  airport_code: z.string().regex(/^[A-Za-z]{3}$/, 'invalid').transform((s) => s.toUpperCase()),
  city_id: serial.optional(),
  option_name: required,
  mode: mode.optional(),
  duration_min: minutes.optional(),
  fare_min: money.optional(),
  fare_max: money.optional(),
  currency: currency.optional(),
  verified_at: date.optional(),
})

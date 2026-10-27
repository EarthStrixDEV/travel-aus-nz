'use server'

import { revalidateTag } from 'next/cache'
import { getTranslations } from 'next-intl/server'
import { requireRole } from '@/lib/auth/profile'
import { CACHE_TAGS } from '@/lib/content/cache'
import { createClient } from '@/lib/supabase/server'
import { mediaMetaFor, syncChildren } from '../_lib/db'
import { dbError, fieldErrors, formToInput, rows, serialId, toI18n, type SaveResult } from '../_lib/form'
import { agencySchema, airportSchema, cardSchema, fareRuleSchema, lineSchema, scenicSchema } from './schema'

// Every transit write goes through the editor's session (RLS + audit) and busts `transport`; airport
// transfers also appear on Prepare, so they bust `prepare` too.

type Translate = Awaited<ReturnType<typeof getTranslations<'admin'>>>

async function begin(id: number | null): Promise<{ t: Translate; rowId: number | null } | { error: SaveResult }> {
  await requireRole(['editor', 'admin'])
  const t = await getTranslations('admin')
  const rowId = serialId(id)
  if (rowId === undefined) return { error: { error: t('errors.invalidId') } }
  return { t, rowId }
}

export async function saveAgency(id: number | null, formData: FormData): Promise<SaveResult> {
  const s = await begin(id)
  if ('error' in s) return s.error
  const parsed = agencySchema.safeParse(formToInput(formData))
  if (!parsed.success) return { fieldErrors: fieldErrors(parsed.error.issues, s.t) }
  const d = parsed.data
  const { error } = await (await createClient()).from('transit_agencies').upsert({
    ...(s.rowId !== null && { id: s.rowId }),
    country: d.country,
    name: d.name,
    website: d.website ?? null,
    gtfs_url: d.gtfs_url ?? null,
    card_id: d.card_id ?? null,
  })
  if (error) return { error: dbError(error, s.t) }
  revalidateTag(CACHE_TAGS.transport)
  return {}
}

/** A line, its editorial service summary (no GTFS job yet: plan deviation 3) and its stops in order. */
export async function saveLine(id: number | null, formData: FormData): Promise<SaveResult> {
  const s = await begin(id)
  if ('error' in s) return s.error
  const input = { ...formToInput(formData), stops: rows(formData, 'stop', ['id'] as const).flatMap((r) => (r.id ? [r.id] : [])) }
  const parsed = lineSchema.safeParse(input)
  if (!parsed.success) return { fieldErrors: fieldErrors(parsed.error.issues, s.t) }
  const d = parsed.data

  const db = await createClient()
  const { data: saved, error } = await db
    .from('transit_lines')
    .upsert({
      ...(s.rowId !== null && { id: s.rowId }),
      agency_id: d.agency_id ?? null,
      city_id: d.city_id ?? null,
      mode: d.mode,
      short_name: d.short_name ?? null,
      long_name: d.long_name ?? null,
    })
    .select('id')
    .single()
  if (error || !saved) return { error: error ? dbError(error, s.t) : s.t('errors.saveFailed') }

  const { error: summaryError } = await db.from('line_service_summary').upsert({
    line_id: saved.id,
    end_to_end_min: d.end_to_end_min ?? null,
    headway_peak_min: d.headway_peak_min ?? null,
    headway_offpeak_min: d.headway_offpeak_min ?? null,
    fare_min: d.fare_min ?? null,
    fare_max: d.fare_max ?? null,
    computed_at: new Date().toISOString(),
  })
  if (summaryError) return { error: dbError(summaryError, s.t) }

  const stopsError = await syncChildren(db, 'line_stops', {
    parent: ['line_id', saved.id],
    keys: ['seq'],
    rows: d.stops.map((stop_id, i) => ({ line_id: saved.id, stop_id, seq: i + 1 })),
  })
  if (stopsError) return { error: dbError(stopsError, s.t) }
  revalidateTag(CACHE_TAGS.transport)
  return {}
}

export async function saveCard(id: number | null, formData: FormData): Promise<SaveResult> {
  const s = await begin(id)
  if ('error' in s) return s.error
  const parsed = cardSchema.safeParse(formToInput(formData))
  if (!parsed.success) return { fieldErrors: fieldErrors(parsed.error.issues, s.t) }
  const d = parsed.data
  const { error } = await (await createClient()).from('transit_cards').upsert({
    ...(s.rowId !== null && { id: s.rowId }),
    city_id: d.city_id ?? null,
    name: d.name,
    contactless: d.contactless,
    how_to_i18n: toI18n(d, 'how_to'),
    caps_i18n: toI18n(d, 'caps'),
    official_url: d.official_url ?? null,
    verified_at: d.verified_at ?? null,
  })
  if (error) return { error: dbError(error, s.t) }
  revalidateTag(CACHE_TAGS.transport)
  return {}
}

const BAND_FIELDS = ['upto_km', 'peak', 'offpeak'] as const

export async function saveFareRule(id: number | null, formData: FormData): Promise<SaveResult> {
  const s = await begin(id)
  if ('error' in s) return s.error
  const parsed = fareRuleSchema.safeParse({ ...formToInput(formData), bands: rows(formData, 'band', BAND_FIELDS) })
  if (!parsed.success) return { fieldErrors: fieldErrors(parsed.error.issues, s.t) }
  const { error } = await (await createClient()).from('fare_rules').upsert({ ...(s.rowId !== null && { id: s.rowId }), ...parsed.data })
  if (error) return { error: dbError(error, s.t) }
  revalidateTag(CACHE_TAGS.transport)
  return {}
}

export async function saveScenic(id: number | null, formData: FormData): Promise<SaveResult> {
  const s = await begin(id)
  if ('error' in s) return s.error
  const input = formToInput(formData)
  const db = await createClient()
  const meta = await mediaMetaFor(db, [input.cover_media_id])
  if (meta.error) return { error: dbError(meta.error, s.t) }
  const parsed = scenicSchema.safeParse({ ...input, media: meta.media })
  if (!parsed.success) return { fieldErrors: fieldErrors(parsed.error.issues, s.t) }
  const d = parsed.data
  const { error } = await db.from('scenic_routes').upsert({
    ...(s.rowId !== null && { id: s.rowId }),
    country: d.country ?? null,
    mode: d.mode ?? null,
    slug: d.slug,
    name_i18n: toI18n(d, 'name'),
    from_name: d.from_name ?? null,
    to_name: d.to_name ?? null,
    line_i18n: toI18n(d, 'line'),
    duration_text: d.duration_text ?? null,
    frequency_text: d.frequency_text ?? null,
    fare_from: d.fare_from ?? null,
    currency: d.currency ?? null,
    cover_media_id: d.cover_media_id ?? null,
    status: d.status,
  })
  if (error) return { error: dbError(error, s.t) }
  revalidateTag(CACHE_TAGS.transport)
  return {}
}

export async function saveAirport(id: number | null, formData: FormData): Promise<SaveResult> {
  const s = await begin(id)
  if ('error' in s) return s.error
  const parsed = airportSchema.safeParse(formToInput(formData))
  if (!parsed.success) return { fieldErrors: fieldErrors(parsed.error.issues, s.t) }
  const d = parsed.data
  const { error } = await (await createClient()).from('airport_transfers').upsert({
    ...(s.rowId !== null && { id: s.rowId }),
    airport_code: d.airport_code,
    city_id: d.city_id ?? null,
    option_name: d.option_name,
    mode: d.mode ?? null,
    duration_min: d.duration_min ?? null,
    fare_min: d.fare_min ?? null,
    fare_max: d.fare_max ?? null,
    currency: d.currency ?? null,
    verified_at: d.verified_at ?? null,
  })
  if (error) return { error: dbError(error, s.t) }
  revalidateTag(CACHE_TAGS.transport)
  revalidateTag(CACHE_TAGS.prepare)
  return {}
}

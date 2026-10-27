'use server'

import { revalidateTag } from 'next/cache'
import { getTranslations } from 'next-intl/server'
import { requireRole } from '@/lib/auth/profile'
import { CACHE_TAGS } from '@/lib/content/cache'
import { createClient } from '@/lib/supabase/server'
import { mediaMetaFor, syncChildren } from '../_lib/db'
import { dbError, fieldErrors, formToInput, rows, toI18n, uuidId, type SaveResult } from '../_lib/form'
import { dishSchema } from './schema'

const PAIRING_FIELDS = ['k_th', 'k_en', 'v_th', 'v_en'] as const
const VENUE_FIELDS = ['place_id', 'region_id', 'rank', 'price_text', 'note_th', 'note_en'] as const

/** Create (id null) or update a dish with its pairings and venues through the editor's session, then bust `dishes`. */
export async function saveDish(id: string | null, formData: FormData): Promise<SaveResult> {
  await requireRole(['editor', 'admin'])
  const t = await getTranslations('admin')
  const dishId = uuidId(id)
  if (dishId === undefined) return { error: t('errors.invalidId') }

  const input: Record<string, unknown> = {
    ...formToInput(formData),
    pairings: rows(formData, 'pairing', PAIRING_FIELDS),
    venues: rows(formData, 'venue', VENUE_FIELDS),
  }
  const supabase = await createClient()
  const meta = await mediaMetaFor(supabase, [input.cover_media_id])
  if (meta.error) return { error: dbError(meta.error, t) }

  const parsed = dishSchema.safeParse({ ...input, media: meta.media })
  if (!parsed.success) return { fieldErrors: fieldErrors(parsed.error.issues, t) }
  const d = parsed.data

  const { data: saved, error } = await supabase
    .from('dishes')
    .upsert({
      ...(dishId !== null && { id: dishId }),
      slug: d.slug,
      country: d.country,
      region_id: d.region_id ?? null,
      type: d.type,
      name_i18n: toI18n(d, 'name')!,
      line_i18n: toI18n(d, 'line'),
      story_i18n: toI18n(d, 'story'),
      dispute_note_i18n: toI18n(d, 'dispute'),
      taste_i18n: toI18n(d, 'taste'),
      served_i18n: toI18n(d, 'served'),
      allergy_i18n: toI18n(d, 'allergy'),
      dietary: [...new Set(d.dietary)],
      price_level: d.price_level ?? null,
      price_text: d.price_text ?? null,
      must_try_rank: d.must_try_rank ?? null,
      sort: d.sort,
      cover_media_id: d.cover_media_id ?? null,
      status: d.status,
      verified_at: d.verified_at ?? null,
    })
    .select('id')
    .single()
  if (error || !saved) return { error: error ? dbError(error, t) : t('errors.saveFailed') }

  const pairingsError = await syncChildren(supabase, 'dish_pairings', {
    parent: ['dish_id', saved.id],
    keys: ['sort'],
    rows: d.pairings.map((p, i) => ({ dish_id: saved.id, sort: i + 1, k_i18n: toI18n(p, 'k'), v_i18n: toI18n(p, 'v') })),
  })
  if (pairingsError) return { error: dbError(pairingsError, t) }

  const venuesError = await syncChildren(supabase, 'dish_venues', {
    parent: ['dish_id', saved.id],
    keys: ['place_id'],
    rows: d.venues.map((v) => ({
      dish_id: saved.id,
      place_id: v.place_id,
      region_id: v.region_id,
      rank: v.rank,
      price_text: v.price_text ?? null,
      note_i18n: toI18n(v, 'note'),
    })),
  })
  if (venuesError) return { error: dbError(venuesError, t) }

  revalidateTag(CACHE_TAGS.dishes)
  return {}
}

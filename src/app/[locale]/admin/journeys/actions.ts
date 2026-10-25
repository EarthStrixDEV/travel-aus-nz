'use server'

import { revalidateTag } from 'next/cache'
import { getTranslations } from 'next-intl/server'
import { requireRole } from '@/lib/auth/profile'
import { CACHE_TAGS } from '@/lib/content/cache'
import { createClient } from '@/lib/supabase/server'
import { mediaMetaFor, syncChildren } from '../_lib/db'
import { dbError, fieldErrors, formToInput, rows, toI18n, uuidId, type SaveResult } from '../_lib/form'
import { journeySchema } from './schema'

const LEG_FIELDS = ['mode', 'from_name', 'to_name', 'operator', 'duration_min', 'frequency_text', 'day'] as const

/** Create (id null) or update a journey and its legs through the editor's session, then bust `home`. */
export async function saveJourney(id: string | null, formData: FormData): Promise<SaveResult> {
  await requireRole(['editor', 'admin'])
  const t = await getTranslations('admin')
  const journeyId = uuidId(id)
  if (journeyId === undefined) return { error: t('errors.invalidId') }

  const input: Record<string, unknown> = { ...formToInput(formData), legs: rows(formData, 'leg', LEG_FIELDS) }
  const supabase = await createClient()
  const meta = await mediaMetaFor(supabase, [input.cover_media_id])
  if (meta.error) return { error: dbError(meta.error, t) }

  const parsed = journeySchema.safeParse({ ...input, media: meta.media })
  if (!parsed.success) return { fieldErrors: fieldErrors(parsed.error.issues, t) }
  const d = parsed.data

  const { data: saved, error } = await supabase
    .from('journeys')
    .upsert({
      ...(journeyId !== null && { id: journeyId }),
      slug: d.slug,
      kind: d.kind,
      country: d.country ?? null,
      title_i18n: toI18n(d, 'title'),
      line_i18n: toI18n(d, 'line'),
      from_name: d.from_name ?? null,
      to_name: d.to_name ?? null,
      days: d.days ?? null,
      price_from: d.price_from ?? null,
      currency: d.currency ?? null,
      modes: d.modes.length > 0 ? [...new Set(d.modes)] : null,
      cover_media_id: d.cover_media_id ?? null,
      status: d.status,
    })
    .select('id')
    .single()
  if (error || !saved) return { error: error ? dbError(error, t) : t('errors.saveFailed') }

  const legsError = await syncChildren(supabase, 'journey_legs', {
    parent: ['journey_id', saved.id],
    keys: ['seq'],
    rows: d.legs.map((l, i) => ({
      journey_id: saved.id,
      seq: i + 1,
      day: l.day,
      mode: l.mode,
      from_name: l.from_name ?? null,
      to_name: l.to_name ?? null,
      operator: l.operator ?? null,
      duration_min: l.duration_min ?? null,
      frequency_text: l.frequency_text ?? null,
    })),
  })
  if (legsError) return { error: dbError(legsError, t) }
  revalidateTag(CACHE_TAGS.home)
  return {}
}

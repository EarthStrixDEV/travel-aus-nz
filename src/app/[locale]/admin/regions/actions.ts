'use server'

import { revalidateTag } from 'next/cache'
import { getTranslations } from 'next-intl/server'
import { requireRole } from '@/lib/auth/profile'
import { CACHE_TAGS } from '@/lib/content/cache'
import { createClient } from '@/lib/supabase/server'
import { mediaMetaFor } from '../_lib/db'
import { dbError, fieldErrors, formToInput, serialId, toI18n, type SaveResult } from '../_lib/form'
import { regionSchema } from './schema'

/** Create (id null) or update a region through the editor's session (RLS + audit), then bust `home`. */
export async function saveRegion(id: number | null, formData: FormData): Promise<SaveResult> {
  await requireRole(['editor', 'admin'])
  const t = await getTranslations('admin')
  const regionId = serialId(id)
  if (regionId === undefined) return { error: t('errors.invalidId') }

  const input = formToInput(formData)
  const supabase = await createClient()
  const meta = await mediaMetaFor(supabase, [input.cover_media_id])
  if (meta.error) return { error: dbError(meta.error, t) }

  const parsed = regionSchema.safeParse({ ...input, media: meta.media })
  if (!parsed.success) return { fieldErrors: fieldErrors(parsed.error.issues, t) }
  const d = parsed.data

  const { error } = await supabase.from('regions').upsert({
    ...(regionId !== null && { id: regionId }),
    country: d.country,
    slug: d.slug,
    name_i18n: toI18n(d, 'name')!,
    state_i18n: toI18n(d, 'state'),
    lede_i18n: toI18n(d, 'lede'),
    best_months: d.best_months.length > 0 ? [...new Set(d.best_months)].sort((a, b) => a - b) : null,
    featured_rank: d.featured_rank ?? null,
    cover_media_id: d.cover_media_id ?? null,
    status: d.status,
  })
  if (error) return { error: dbError(error, t) }

  revalidateTag(CACHE_TAGS.home)
  return {}
}

'use server'

import { revalidateTag } from 'next/cache'
import { getTranslations } from 'next-intl/server'
import { requireRole } from '@/lib/auth/profile'
import { CACHE_TAGS } from '@/lib/content/cache'
import { createClient } from '@/lib/supabase/server'
import { mediaMetaFor } from '../_lib/db'
import { dbError, fieldErrors, formToInput, toI18n, uuidId, type SaveResult } from '../_lib/form'
import { galleryPhotoSchema } from './schema'

/** Create (id null) or update a gallery photo through the editor's session, then bust `gallery`. */
export async function saveGalleryPhoto(id: string | null, formData: FormData): Promise<SaveResult> {
  await requireRole(['editor', 'admin'])
  const t = await getTranslations('admin')
  const photoId = uuidId(id)
  if (photoId === undefined) return { error: t('errors.invalidId') }

  const input = formToInput(formData)
  const supabase = await createClient()
  const meta = await mediaMetaFor(supabase, [input.media_id])
  if (meta.error) return { error: dbError(meta.error, t) }

  const parsed = galleryPhotoSchema.safeParse({ ...input, media: meta.media })
  if (!parsed.success) return { fieldErrors: fieldErrors(parsed.error.issues, t) }
  const d = parsed.data

  const { error } = await supabase.from('gallery_photos').upsert({
    ...(photoId !== null && { id: photoId }),
    media_id: d.media_id,
    place_id: d.place_id,
    region_id: d.region_id ?? null,
    season: d.season ?? null,
    title_i18n: toI18n(d, 'title'),
    sort: d.sort,
    status: d.status,
  })
  if (error) return { error: dbError(error, t) }

  revalidateTag(CACHE_TAGS.gallery)
  return {}
}

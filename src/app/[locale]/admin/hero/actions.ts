'use server'

import { revalidateTag } from 'next/cache'
import { getTranslations } from 'next-intl/server'
import { requireRole } from '@/lib/auth/profile'
import { CACHE_TAGS } from '@/lib/content/cache'
import { createClient } from '@/lib/supabase/server'
import { mediaMetaFor } from '../_lib/db'
import { dbError, fieldErrors, formToInput, serialId, toI18n, type SaveResult } from '../_lib/form'
import { heroSlideSchema } from './schema'

/** Create (id null) or update a hero slide through the editor's session, then bust `home`. */
export async function saveHeroSlide(id: number | null, formData: FormData): Promise<SaveResult> {
  await requireRole(['editor', 'admin'])
  const t = await getTranslations('admin')
  const slideId = serialId(id)
  if (slideId === undefined) return { error: t('errors.invalidId') }

  const input = formToInput(formData)
  const supabase = await createClient()
  const meta = await mediaMetaFor(supabase, [input.media_id])
  if (meta.error) return { error: dbError(meta.error, t) }

  const parsed = heroSlideSchema.safeParse({ ...input, media: meta.media })
  if (!parsed.success) return { fieldErrors: fieldErrors(parsed.error.issues, t) }
  const d = parsed.data

  const { error } = await supabase.from('hero_slides').upsert({
    ...(slideId !== null && { id: slideId }),
    media_id: d.media_id,
    caption_i18n: toI18n(d, 'caption'),
    place_id: d.place_id ?? null,
    sort: d.sort,
    active: d.active,
  })
  if (error) return { error: dbError(error, t) }

  revalidateTag(CACHE_TAGS.home)
  return {}
}

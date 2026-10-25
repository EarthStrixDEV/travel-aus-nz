'use server'

import { revalidateTag } from 'next/cache'
import { getTranslations } from 'next-intl/server'
import { requireRole } from '@/lib/auth/profile'
import { CACHE_TAGS } from '@/lib/content/cache'
import { createClient } from '@/lib/supabase/server'
import { dbError, fieldErrors, formToInput, toI18n, uuidId, type SaveResult } from '../_lib/form'
import { mediaAssetSchema } from './schema'

/** Edit an asset's alt text / credit / license (the file itself is immutable). */
export async function saveMedia(id: string, formData: FormData): Promise<SaveResult> {
  await requireRole(['editor', 'admin'])
  const t = await getTranslations('admin')
  const assetId = uuidId(id)
  if (!assetId) return { error: t('errors.invalidId') }

  const parsed = mediaAssetSchema.safeParse(formToInput(formData))
  if (!parsed.success) return { fieldErrors: fieldErrors(parsed.error.issues, t) }
  const d = parsed.data

  const supabase = await createClient()
  const { error } = await supabase
    .from('media_assets')
    .update({ alt_i18n: toI18n(d, 'alt'), credit: d.credit, license: d.license })
    .eq('id', assetId)
  if (error) return { error: dbError(error, t) }

  // Alt text is rendered by the gallery and the home page (hero, region covers).
  revalidateTag(CACHE_TAGS.gallery)
  revalidateTag(CACHE_TAGS.home)
  return {}
}

'use server'

import { randomUUID } from 'node:crypto'
import { getTranslations } from 'next-intl/server'
import { requireRole } from '@/lib/auth/profile'
import { mediaPath } from '@/lib/media/path'
import { createClient } from '@/lib/supabase/server'
import { dbError, fieldErrors, formToInput, toI18n, type SaveResult } from '../_lib/form'
import { processImage, type ProcessedImage } from './image'
import { checkUpload, mediaAssetSchema } from './schema'

/**
 * Upload an image to the `media` bucket and register it in `media_assets`, both through the
 * editor's session (bucket + table RLS allow editors). Nothing references a fresh asset yet,
 * so no cache is revalidated here.
 */
export async function uploadMedia(formData: FormData): Promise<SaveResult> {
  await requireRole(['editor', 'admin'])
  const t = await getTranslations('admin')

  const raw = formData.get('file')
  const file = raw instanceof File ? raw : null
  const fileError = checkUpload(file)
  const parsed = mediaAssetSchema.safeParse(formToInput(formData))
  if (fileError || !parsed.success) {
    return {
      fieldErrors: {
        ...(parsed.success ? {} : fieldErrors(parsed.error.issues, t)),
        ...(fileError && { file: t(`errors.${fileError}`) }),
      },
    }
  }
  const d = parsed.data

  let image: ProcessedImage
  try {
    image = await processImage(Buffer.from(await file!.arrayBuffer()))
  } catch {
    return { fieldErrors: { file: t('errors.fileUnreadable') } }
  }

  const id = randomUUID()
  const path = mediaPath('assets', id, image.hash)
  const supabase = await createClient()
  const bucket = supabase.storage.from('media')
  const { error: uploadError } = await bucket.upload(path, image.data, {
    contentType: 'image/webp',
    cacheControl: '31536000',
    upsert: false,
  })
  if (uploadError) return { error: t('errors.uploadFailed') }

  const { error } = await supabase.from('media_assets').insert({
    id,
    path,
    width: image.width,
    height: image.height,
    blurhash: image.blurDataURL,
    alt_i18n: toI18n(d, 'alt'),
    credit: d.credit,
    license: d.license,
  })
  if (error) {
    // Don't leave an orphaned object behind a failed row insert.
    await bucket.remove([path])
    return { error: dbError(error, t) }
  }
  return {}
}

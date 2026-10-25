'use server'

import { revalidateTag } from 'next/cache'
import { getTranslations } from 'next-intl/server'
import { requireRole } from '@/lib/auth/profile'
import { CACHE_TAGS } from '@/lib/content/cache'
import { createClient } from '@/lib/supabase/server'
import { replaceChildren } from '../_lib/db'
import { dbError, fieldErrors, formToInput, toI18n, uuidId, type SaveResult } from '../_lib/form'
import { collectionSchema } from './schema'

/** Create (id null) or update a collection and its ordered items through the editor's session, then bust `home`. */
export async function saveCollection(id: string | null, formData: FormData): Promise<SaveResult> {
  await requireRole(['editor', 'admin'])
  const t = await getTranslations('admin')
  const collectionId = uuidId(id)
  if (collectionId === undefined) return { error: t('errors.invalidId') }

  const parsed = collectionSchema.safeParse(formToInput(formData))
  if (!parsed.success) return { fieldErrors: fieldErrors(parsed.error.issues, t) }
  const d = parsed.data

  const supabase = await createClient()
  const { data: saved, error } = await supabase
    .from('collections')
    .upsert({
      ...(collectionId !== null && { id: collectionId }),
      slug: d.slug,
      kind: d.kind,
      placement: d.placement ?? null,
      title_i18n: toI18n(d, 'title')!,
      sub_i18n: toI18n(d, 'sub'),
      status: d.status,
    })
    .select('id')
    .single()
  if (error || !saved) return { error: error ? dbError(error, t) : t('errors.saveFailed') }

  const itemsError = await replaceChildren(
    supabase,
    'collection_items',
    'collection_id',
    saved.id,
    d.items.map((entity_id, i) => ({ collection_id: saved.id, entity_id, position: i + 1 })),
  )
  revalidateTag(CACHE_TAGS.home)
  return itemsError ? { error: dbError(itemsError, t) } : {}
}

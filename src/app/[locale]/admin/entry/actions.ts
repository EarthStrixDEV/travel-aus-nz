'use server'

import { revalidateTag } from 'next/cache'
import { getTranslations } from 'next-intl/server'
import { requireRole } from '@/lib/auth/profile'
import { CACHE_TAGS } from '@/lib/content/cache'
import { createClient } from '@/lib/supabase/server'
import { dbError, fieldErrors, formToInput, serialId, toI18n, type SaveResult } from '../_lib/form'
import { entryRuleSchema, officialLinkSchema, parseRuleKey, permissionTypeSchema } from './schema'

// All entry writes go through the editor's session (RLS + audit) and bust the `entry` tag.

export async function savePermissionType(id: number | null, formData: FormData): Promise<SaveResult> {
  await requireRole(['editor', 'admin'])
  const t = await getTranslations('admin')
  const permissionId = serialId(id)
  if (permissionId === undefined) return { error: t('errors.invalidId') }

  const parsed = permissionTypeSchema.safeParse(formToInput(formData))
  if (!parsed.success) return { fieldErrors: fieldErrors(parsed.error.issues, t) }
  const d = parsed.data

  const supabase = await createClient()
  const { error } = await supabase.from('permission_types').upsert({
    ...(permissionId !== null && { id: permissionId }),
    country: d.country,
    slug: d.slug,
    name_i18n: toI18n(d, 'name'),
    plain_i18n: toI18n(d, 'plain'),
    who_i18n: toI18n(d, 'who'),
    how_i18n: toI18n(d, 'how'),
    good_i18n: toI18n(d, 'good'),
    processing_text: d.processing_text ?? null,
    fee_text: d.fee_text ?? null,
    validity_text: d.validity_text ?? null,
    official_link_id: d.official_link_id ?? null,
    verified_at: d.verified_at ?? null,
    needs_review: d.needs_review,
  })
  if (error) return { error: dbError(error, t) }

  revalidateTag(CACHE_TAGS.entry)
  return {}
}

/**
 * `originalKey` null creates; otherwise it is the row's current composite key, so an editor
 * may change e.g. the stay band (update by the old key; a clash with another row is 23505).
 */
export async function saveEntryRule(originalKey: string | null, formData: FormData): Promise<SaveResult> {
  await requireRole(['editor', 'admin'])
  const t = await getTranslations('admin')
  const original = originalKey === null ? null : parseRuleKey(originalKey)
  if (originalKey !== null && original === null) return { error: t('errors.invalidId') }

  const parsed = entryRuleSchema.safeParse(formToInput(formData))
  if (!parsed.success) return { fieldErrors: fieldErrors(parsed.error.issues, t) }
  const d = parsed.data
  const row = {
    nationality: d.nationality,
    country: d.country,
    purpose: d.purpose,
    stay: d.stay,
    permission_id: d.permission_id ?? null,
    verified_at: d.verified_at ?? null,
    needs_review: d.needs_review,
  }

  const supabase = await createClient()
  const { error } = original
    ? await supabase.from('entry_rules').update(row).match(original)
    : await supabase.from('entry_rules').insert(row)
  if (error) return { error: dbError(error, t) }

  revalidateTag(CACHE_TAGS.entry)
  return {}
}

export async function saveOfficialLink(id: number | null, formData: FormData): Promise<SaveResult> {
  await requireRole(['editor', 'admin'])
  const t = await getTranslations('admin')
  const linkId = serialId(id)
  if (linkId === undefined) return { error: t('errors.invalidId') }

  const parsed = officialLinkSchema.safeParse(formToInput(formData))
  if (!parsed.success) return { fieldErrors: fieldErrors(parsed.error.issues, t) }
  const d = parsed.data

  const supabase = await createClient()
  // health_status / content_hash / last_checked_at belong to the link-check job; not written here.
  const { error } = await supabase.from('official_links').upsert({
    ...(linkId !== null && { id: linkId }),
    country: d.country ?? null,
    agency: d.agency ?? null,
    title_i18n: toI18n(d, 'title'),
    url: d.url,
  })
  if (error) return { error: dbError(error, t) }

  revalidateTag(CACHE_TAGS.entry)
  return {}
}

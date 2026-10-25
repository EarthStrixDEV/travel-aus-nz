'use server'

import { revalidateTag } from 'next/cache'
import { getTranslations } from 'next-intl/server'
import { requireRole } from '@/lib/auth/profile'
import { CACHE_TAGS } from '@/lib/content/cache'
import { createClient } from '@/lib/supabase/server'
import { dbError, fieldErrors, formToInput, serialId, toI18n, type SaveResult } from '../_lib/form'
import { budgetPresetSchema, costItemSchema, parsePresetKey } from './schema'

// FX reference content (Money page): editor session writes, then bust the `fx` tag.

export async function saveCostItem(id: number | null, formData: FormData): Promise<SaveResult> {
  await requireRole(['editor', 'admin'])
  const t = await getTranslations('admin')
  const itemId = serialId(id)
  if (itemId === undefined) return { error: t('errors.invalidId') }

  const parsed = costItemSchema.safeParse(formToInput(formData))
  if (!parsed.success) return { fieldErrors: fieldErrors(parsed.error.issues, t) }
  const d = parsed.data

  const supabase = await createClient()
  const { error } = await supabase.from('cost_reference_items').upsert({
    ...(itemId !== null && { id: itemId }),
    item_i18n: toI18n(d, 'item')!,
    note_i18n: toI18n(d, 'note'),
    aud: d.aud ?? null,
    nzd: d.nzd ?? null,
    verified_at: d.verified_at,
    sort: d.sort ?? null,
  })
  if (error) return { error: dbError(error, t) }

  revalidateTag(CACHE_TAGS.fx)
  return {}
}

/** `originalKey` null creates; otherwise updates the row at that (country, style) key. */
export async function saveBudgetPreset(originalKey: string | null, formData: FormData): Promise<SaveResult> {
  await requireRole(['editor', 'admin'])
  const t = await getTranslations('admin')
  const original = originalKey === null ? null : parsePresetKey(originalKey)
  if (originalKey !== null && original === null) return { error: t('errors.invalidId') }

  const parsed = budgetPresetSchema.safeParse(formToInput(formData))
  if (!parsed.success) return { fieldErrors: fieldErrors(parsed.error.issues, t) }
  const d = parsed.data
  const row = { country: d.country, style: d.style, per_day: d.per_day, note_i18n: toI18n(d, 'note') }

  const supabase = await createClient()
  const { error } = original
    ? await supabase.from('budget_presets').update(row).match(original)
    : await supabase.from('budget_presets').insert(row)
  if (error) return { error: dbError(error, t) }

  revalidateTag(CACHE_TAGS.fx)
  return {}
}

'use server'

import { revalidateTag } from 'next/cache'
import { getTranslations } from 'next-intl/server'
import { requireRole } from '@/lib/auth/profile'
import { CACHE_TAGS } from '@/lib/content/cache'
import { createClient } from '@/lib/supabase/server'
import { dbError, fieldErrors, formToInput, rows, serialId, toI18n, type SaveResult } from '../_lib/form'
import {
  checklistSchema,
  connectivitySchema,
  isBlockKey,
  itemsBlockSchema,
  monthsSchema,
  packingSchema,
  textBlockSchema,
} from './schema'

// Prepare content writes go through the editor's session (RLS + audit) and bust `prepare`;
// the transport_tips block busts `transport` instead.

type Translate = Awaited<ReturnType<typeof getTranslations<'admin'>>>

async function begin(id: number | null): Promise<{ t: Translate; rowId: number | null } | { error: SaveResult }> {
  await requireRole(['editor', 'admin'])
  const t = await getTranslations('admin')
  const rowId = serialId(id)
  if (rowId === undefined) return { error: { error: t('errors.invalidId') } }
  return { t, rowId }
}

export async function saveChecklistTemplate(id: number | null, formData: FormData): Promise<SaveResult> {
  const s = await begin(id)
  if ('error' in s) return s.error
  const parsed = checklistSchema.safeParse(formToInput(formData))
  if (!parsed.success) return { fieldErrors: fieldErrors(parsed.error.issues, s.t) }
  const d = parsed.data
  const { error } = await (await createClient()).from('checklist_templates').upsert({
    ...(s.rowId !== null && { id: s.rowId }),
    slug: d.slug ?? null,
    moment: d.moment,
    title_i18n: toI18n(d, 'title'),
    note_i18n: toI18n(d, 'note'),
    applies_to: [...new Set(d.applies_to)],
    sort: d.sort,
  })
  if (error) return { error: dbError(error, s.t) }
  revalidateTag(CACHE_TAGS.prepare)
  return {}
}

export async function savePackingItem(id: number | null, formData: FormData): Promise<SaveResult> {
  const s = await begin(id)
  if ('error' in s) return s.error
  const parsed = packingSchema.safeParse(formToInput(formData))
  if (!parsed.success) return { fieldErrors: fieldErrors(parsed.error.issues, s.t) }
  const d = parsed.data
  const { error } = await (await createClient()).from('packing_items').upsert({
    ...(s.rowId !== null && { id: s.rowId }),
    season: d.season,
    grp: d.grp ?? null,
    title_i18n: toI18n(d, 'title'),
    sort: d.sort,
  })
  if (error) return { error: dbError(error, s.t) }
  revalidateTag(CACHE_TAGS.prepare)
  return {}
}

export async function saveConnectivity(id: number | null, formData: FormData): Promise<SaveResult> {
  const s = await begin(id)
  if ('error' in s) return s.error
  const parsed = connectivitySchema.safeParse(formToInput(formData))
  if (!parsed.success) return { fieldErrors: fieldErrors(parsed.error.issues, s.t) }
  const d = parsed.data
  const { error } = await (await createClient()).from('connectivity_options').upsert({
    ...(s.rowId !== null && { id: s.rowId }),
    name_i18n: toI18n(d, 'name'),
    setup_i18n: toI18n(d, 'setup'),
    best_i18n: toI18n(d, 'best'),
    watch_i18n: toI18n(d, 'watch'),
    cost_text: d.cost_text ?? null,
    verified_at: d.verified_at ?? null,
  })
  if (error) return { error: dbError(error, s.t) }
  revalidateTag(CACHE_TAGS.prepare)
  return {}
}

/** All 12 `region_months` rows of one region at once (`regionId` is the route id). */
export async function saveRegionMonths(regionId: number, formData: FormData): Promise<SaveResult> {
  const s = await begin(regionId)
  if ('error' in s) return s.error
  if (s.rowId === null) return { error: s.t('errors.invalidId') }
  const comfort = formData.getAll('comfort[]').map(String)
  const crowds = formData.getAll('crowds[]').map(String)
  const recommended = new Set(formData.getAll('recommended[]').map(String))
  const months = Array.from({ length: 12 }, (_, i) => ({
    comfort: comfort[i]?.trim() || undefined,
    crowds: crowds[i]?.trim() || undefined,
    recommended: recommended.has(String(i + 1)),
  }))
  const parsed = monthsSchema.safeParse({ months })
  if (!parsed.success) return { fieldErrors: fieldErrors(parsed.error.issues, s.t) }

  const { error } = await (await createClient()).from('region_months').upsert(
    parsed.data.months.map((m, i) => ({
      region_id: s.rowId!,
      month: i + 1,
      comfort: m.comfort ?? null,
      crowds: m.crowds ?? null,
      recommended: m.recommended,
    })),
    { onConflict: 'region_id,month' },
  )
  if (error) return { error: dbError(error, s.t) }
  revalidateTag(CACHE_TAGS.prepare)
  return {}
}

const ITEM_FIELDS = ['title_th', 'title_en', 'text_th', 'text_en', 'icon'] as const

/** `content_blocks` facts / health (item lists) and transport_tips (text). */
export async function saveContentBlock(key: string, formData: FormData): Promise<SaveResult> {
  await requireRole(['editor', 'admin'])
  const t = await getTranslations('admin')
  if (!isBlockKey(key)) return { error: t('errors.invalidId') }

  const input = formToInput(formData)
  const parsed =
    key === 'transport_tips' ? textBlockSchema.safeParse(input) : itemsBlockSchema.safeParse({ ...input, items: rows(formData, 'item', ITEM_FIELDS) })
  if (!parsed.success) return { fieldErrors: fieldErrors(parsed.error.issues, t) }

  const { error } = await (await createClient())
    .from('content_blocks')
    .upsert({ key, ...parsed.data, updated_at: new Date().toISOString() }, { onConflict: 'key' })
  if (error) return { error: dbError(error, t) }
  revalidateTag(key === 'transport_tips' ? CACHE_TAGS.transport : CACHE_TAGS.prepare)
  return {}
}

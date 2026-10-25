'use server'

import { revalidateTag } from 'next/cache'
import { getTranslations } from 'next-intl/server'
import { z } from 'zod'
import { requireRole } from '@/lib/auth/profile'
import { CACHE_TAGS } from '@/lib/content/cache'
import { createClient } from '@/lib/supabase/server'
import { citySchema, type CityInput } from './schema'

export type SaveCityResult = {
  error?: string
  fieldErrors?: Partial<Record<keyof CityInput, string>>
}

const FIELDS = Object.keys(citySchema.shape) as (keyof CityInput)[]

/** Blank -> undefined so `z.coerce.number()` yields NaN (invalid) instead of 0. */
function formToInput(formData: FormData): Record<string, unknown> {
  const input: Record<string, unknown> = {}
  for (const key of FIELDS) {
    const raw = formData.get(key)
    if (typeof raw !== 'string') continue
    const value = raw.trim()
    if (value !== '') input[key] = value
  }
  return input
}

/**
 * Create (id null) or update a city. Server actions are public endpoints, so the role is
 * checked here, and writes use the user's session so RLS applies and the audit trigger
 * records the editor.
 */
export async function saveCity(id: number | null, formData: FormData): Promise<SaveCityResult> {
  await requireRole(['editor', 'admin'])
  const t = await getTranslations('admin.cities')

  let cityId: number | null = null
  if (id !== null) {
    const parsed = z.coerce.number().int().positive().safeParse(id)
    if (!parsed.success) return { error: t('errors.invalidId') }
    cityId = parsed.data
  }

  const parsed = citySchema.safeParse(formToInput(formData))
  if (!parsed.success) {
    const fieldErrors: SaveCityResult['fieldErrors'] = {}
    for (const issue of parsed.error.issues) {
      const field = issue.path[0] as keyof CityInput | undefined
      if (field && FIELDS.includes(field) && !fieldErrors[field]) fieldErrors[field] = t(`errors.${field}`)
    }
    return { fieldErrors }
  }

  const { name_th, name_en, lng, lat, ...rest } = parsed.data
  const supabase = await createClient()
  const { error } = await supabase.from('cities').upsert({
    ...(cityId !== null && { id: cityId }),
    ...rest,
    name_i18n: { th: name_th, en: name_en },
    center: `SRID=4326;POINT(${lng} ${lat})`,
  })

  if (error) {
    if (error.code === '23505') return { error: t('errors.duplicateSlug') }
    if (error.code === '42501') return { error: t('errors.forbidden') }
    return { error: t('errors.saveFailed') }
  }

  // Cities feed the home page, map, venue lists and gallery.
  for (const tag of [CACHE_TAGS.home, CACHE_TAGS.map, CACHE_TAGS.venues, CACHE_TAGS.gallery]) revalidateTag(tag)
  return {}
}

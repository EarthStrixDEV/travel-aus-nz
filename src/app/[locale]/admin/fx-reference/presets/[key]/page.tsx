import { notFound } from 'next/navigation'
import { getTranslations, setRequestLocale } from 'next-intl/server'
import { requireRole } from '@/lib/auth/profile'
import { createClient } from '@/lib/supabase/server'
import { i18nValues, type FormValues } from '../../../_lib/values'
import { PresetForm } from '../../forms'
import { parsePresetKey, presetKey } from '../../schema'

export default async function PresetEditPage({ params }: { params: Promise<{ locale: string; key: string }> }) {
  const { locale, key: rawKey } = await params
  setRequestLocale(locale)
  await requireRole(['editor', 'admin'])
  const t = await getTranslations('admin')

  const isNew = rawKey === 'new'
  const key = isNew ? null : parsePresetKey(rawKey)
  if (!isNew && !key) notFound()

  let values: FormValues = { country: 'AU', style: 'budget', per_day: '' }
  if (key) {
    const supabase = await createClient()
    const { data: p, error } = await supabase.from('budget_presets').select('*').match(key).maybeSingle()
    if (error) throw new Error('Failed to load budget preset')
    if (!p) notFound()
    values = { ...i18nValues(p.note_i18n, 'note'), country: key.country, style: key.style, per_day: String(p.per_day) }
  }

  return (
    <>
      <h1 className="text-3xl font-semibold text-ink">{isNew ? t('fx.newPreset') : t('fx.editPreset')}</h1>
      <PresetForm originalKey={key ? presetKey(key) : null} values={values} />
    </>
  )
}

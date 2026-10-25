import { notFound } from 'next/navigation'
import { getTranslations, setRequestLocale } from 'next-intl/server'
import { requireRole } from '@/lib/auth/profile'
import { createClient } from '@/lib/supabase/server'
import { SERIAL_PARAM } from '../../_lib/form'
import { mediaOptions } from '../../_lib/options'
import { i18nValues, monthOptions, str, type FormValues } from '../../_lib/values'
import { RegionForm } from '../region-form'

export default async function RegionEditPage({ params }: { params: Promise<{ locale: string; id: string }> }) {
  const { locale, id: rawId } = await params
  setRequestLocale(locale)
  await requireRole(['editor', 'admin'])
  const t = await getTranslations('admin')

  const isNew = rawId === 'new'
  if (!isNew && !SERIAL_PARAM.test(rawId)) notFound()
  const id = isNew ? null : Number(rawId)

  const supabase = await createClient()
  const media = await mediaOptions(supabase, t('form.unlicensed'))

  let values: FormValues = { country: 'AU', slug: '', featured_rank: '', cover_media_id: '', status: 'draft' }
  let bestMonths: string[] = []
  if (id !== null) {
    const { data: r, error } = await supabase.from('regions').select('*').eq('id', id).maybeSingle()
    if (error) throw new Error('Failed to load region')
    if (!r) notFound()
    values = {
      ...i18nValues(r.name_i18n, 'name'),
      ...i18nValues(r.state_i18n, 'state'),
      ...i18nValues(r.lede_i18n, 'lede'),
      country: r.country,
      slug: r.slug,
      featured_rank: str(r.featured_rank),
      cover_media_id: str(r.cover_media_id),
      status: r.status,
    }
    bestMonths = (r.best_months ?? []).map(String)
  }

  return (
    <>
      <h1 className="text-3xl font-semibold text-ink">{isNew ? t('regions.newTitle') : t('regions.editTitle')}</h1>
      <RegionForm id={id} values={values} bestMonths={bestMonths} months={monthOptions(locale)} media={media} />
    </>
  )
}

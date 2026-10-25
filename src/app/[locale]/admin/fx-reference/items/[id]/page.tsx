import { notFound } from 'next/navigation'
import { getTranslations, setRequestLocale } from 'next-intl/server'
import { requireRole } from '@/lib/auth/profile'
import { createClient } from '@/lib/supabase/server'
import { SERIAL_PARAM } from '../../../_lib/form'
import { i18nValues, str, type FormValues } from '../../../_lib/values'
import { CostItemForm } from '../../forms'

export default async function CostItemEditPage({ params }: { params: Promise<{ locale: string; id: string }> }) {
  const { locale, id: rawId } = await params
  setRequestLocale(locale)
  await requireRole(['editor', 'admin'])
  const t = await getTranslations('admin')

  const isNew = rawId === 'new'
  if (!isNew && !SERIAL_PARAM.test(rawId)) notFound()
  const id = isNew ? null : Number(rawId)

  let values: FormValues = { aud: '', nzd: '', verified_at: '', sort: '' }
  if (id !== null) {
    const supabase = await createClient()
    const { data: i, error } = await supabase.from('cost_reference_items').select('*').eq('id', id).maybeSingle()
    if (error) throw new Error('Failed to load cost item')
    if (!i) notFound()
    values = {
      ...i18nValues(i.item_i18n, 'item'),
      ...i18nValues(i.note_i18n, 'note'),
      aud: str(i.aud),
      nzd: str(i.nzd),
      verified_at: i.verified_at,
      sort: str(i.sort),
    }
  }

  return (
    <>
      <h1 className="text-3xl font-semibold text-ink">{isNew ? t('fx.newItem') : t('fx.editItem')}</h1>
      <CostItemForm id={id} values={values} />
    </>
  )
}

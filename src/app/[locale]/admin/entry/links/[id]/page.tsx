import { notFound } from 'next/navigation'
import { getTranslations, setRequestLocale } from 'next-intl/server'
import { requireRole } from '@/lib/auth/profile'
import { createClient } from '@/lib/supabase/server'
import { SERIAL_PARAM } from '../../../_lib/form'
import { i18nValues, str, type FormValues } from '../../../_lib/values'
import { LinkForm } from '../../forms'

export default async function LinkEditPage({ params }: { params: Promise<{ locale: string; id: string }> }) {
  const { locale, id: rawId } = await params
  setRequestLocale(locale)
  await requireRole(['editor', 'admin'])
  const t = await getTranslations('admin')

  const isNew = rawId === 'new'
  if (!isNew && !SERIAL_PARAM.test(rawId)) notFound()
  const id = isNew ? null : Number(rawId)

  let values: FormValues = { url: '', agency: '', country: '' }
  if (id !== null) {
    const supabase = await createClient()
    const { data: l, error } = await supabase.from('official_links').select('*').eq('id', id).maybeSingle()
    if (error) throw new Error('Failed to load official link')
    if (!l) notFound()
    values = { ...i18nValues(l.title_i18n, 'title'), url: l.url, agency: str(l.agency), country: str(l.country) }
  }

  return (
    <>
      <h1 className="text-3xl font-semibold text-ink">{isNew ? t('entry.newLink') : t('entry.editLink')}</h1>
      <LinkForm id={id} values={values} />
    </>
  )
}

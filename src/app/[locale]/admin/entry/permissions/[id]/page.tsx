import { notFound } from 'next/navigation'
import { getTranslations, setRequestLocale } from 'next-intl/server'
import { requireRole } from '@/lib/auth/profile'
import { createClient } from '@/lib/supabase/server'
import { SERIAL_PARAM } from '../../../_lib/form'
import { officialLinkOptions } from '../../../_lib/options'
import { i18nValues, str, type FormValues } from '../../../_lib/values'
import { PermissionForm } from '../../forms'

export default async function PermissionEditPage({ params }: { params: Promise<{ locale: string; id: string }> }) {
  const { locale, id: rawId } = await params
  setRequestLocale(locale)
  await requireRole(['editor', 'admin'])
  const t = await getTranslations('admin')

  const isNew = rawId === 'new'
  if (!isNew && !SERIAL_PARAM.test(rawId)) notFound()
  const id = isNew ? null : Number(rawId)

  const supabase = await createClient()
  const links = await officialLinkOptions(supabase, locale)

  let values: FormValues = { country: 'AU', slug: '', official_link_id: '', needs_review: 'false' }
  if (id !== null) {
    const { data: p, error } = await supabase.from('permission_types').select('*').eq('id', id).maybeSingle()
    if (error) throw new Error('Failed to load permission type')
    if (!p) notFound()
    values = {
      ...i18nValues(p.name_i18n, 'name'),
      ...i18nValues(p.plain_i18n, 'plain'),
      ...i18nValues(p.who_i18n, 'who'),
      ...i18nValues(p.how_i18n, 'how'),
      ...i18nValues(p.good_i18n, 'good'),
      country: p.country,
      slug: str(p.slug),
      processing_text: str(p.processing_text),
      fee_text: str(p.fee_text),
      validity_text: str(p.validity_text),
      official_link_id: str(p.official_link_id),
      verified_at: str(p.verified_at),
      needs_review: String(p.needs_review ?? false),
    }
  }

  return (
    <>
      <h1 className="text-3xl font-semibold text-ink">{isNew ? t('entry.newPermission') : t('entry.editPermission')}</h1>
      <PermissionForm id={id} values={values} links={links} />
    </>
  )
}

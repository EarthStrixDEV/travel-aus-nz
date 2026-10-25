import { notFound } from 'next/navigation'
import { getTranslations, setRequestLocale } from 'next-intl/server'
import { requireRole } from '@/lib/auth/profile'
import { createClient } from '@/lib/supabase/server'
import { UUID_PARAM } from '../../_lib/form'
import { i18nValues } from '../../_lib/values'
import { MediaEditForm, UploadForm } from '../media-forms'

export default async function MediaEditPage({ params }: { params: Promise<{ locale: string; id: string }> }) {
  const { locale, id } = await params
  setRequestLocale(locale)
  await requireRole(['editor', 'admin'])
  const t = await getTranslations('admin.media')

  if (id === 'new') {
    return (
      <>
        <h1 className="text-3xl font-semibold text-ink">{t('newTitle')}</h1>
        <UploadForm />
      </>
    )
  }
  if (!UUID_PARAM.test(id)) notFound()

  const supabase = await createClient()
  const { data: m, error } = await supabase.from('media_assets').select('*').eq('id', id).maybeSingle()
  if (error) throw new Error('Failed to load media asset')
  if (!m) notFound()

  return (
    <>
      <h1 className="text-3xl font-semibold text-ink">{t('editTitle')}</h1>
      <p className="mt-2 break-all text-sm text-ink-2">
        {m.path} · {m.width}×{m.height}
      </p>
      <MediaEditForm id={m.id} values={{ ...i18nValues(m.alt_i18n, 'alt'), credit: m.credit, license: m.license }} />
    </>
  )
}

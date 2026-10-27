import { notFound } from 'next/navigation'
import { getTranslations, setRequestLocale } from 'next-intl/server'
import { Button } from '@/components/ui/button'
import { requireRole } from '@/lib/auth/profile'
import { createClient } from '@/lib/supabase/server'
import { SERIAL_PARAM } from '../../../_lib/form'
import { i18nValues, str, type FormValues } from '../../../_lib/values'
import { acceptOfficialLinkPage } from '../../actions'
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
  let changed = false
  if (id !== null) {
    const supabase = await createClient()
    const { data: l, error } = await supabase.from('official_links').select('*').eq('id', id).maybeSingle()
    if (error) throw new Error('Failed to load official link')
    if (!l) notFound()
    values = { ...i18nValues(l.title_i18n, 'title'), url: l.url, agency: str(l.agency), country: str(l.country) }
    changed = l.health_status === 'changed'
  }

  return (
    <>
      <h1 className="text-3xl font-semibold text-ink">{isNew ? t('entry.newLink') : t('entry.editLink')}</h1>
      {changed && (
        <form action={acceptOfficialLinkPage} className="mt-4 flex flex-wrap items-center gap-3 rounded-lg border border-line p-4">
          <p className="flex-1 text-sm text-ink-2">{t('entry.changedHint')}</p>
          <input type="hidden" name="id" value={id ?? ''} />
          <Button type="submit" variant="ghost">
            {t('entry.acceptPage')}
          </Button>
        </form>
      )}
      <LinkForm id={id} values={values} />
    </>
  )
}

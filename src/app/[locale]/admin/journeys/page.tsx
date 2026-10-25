import { getTranslations, setRequestLocale } from 'next-intl/server'
import { requireRole } from '@/lib/auth/profile'
import { t as tr, type Locale } from '@/lib/i18n/t'
import { createClient } from '@/lib/supabase/server'
import { AdminList } from '../_lib/admin-list'
import { StatusPill } from '../status-pill'

export default async function JourneysPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params
  setRequestLocale(locale)
  await requireRole(['editor', 'admin'])
  const t = await getTranslations('admin')

  const supabase = await createClient()
  const { data, error } = await supabase.from('journeys').select('id, slug, kind, country, title_i18n, status').order('slug')
  if (error) throw new Error('Failed to load journeys')

  return (
    <AdminList
      title={t('journeys.title')}
      addHref="/admin/journeys/new"
      addLabel={t('journeys.add')}
      empty={t('journeys.empty')}
      editLabel={t('form.edit')}
      actionsLabel={t('form.actions')}
      columns={[t('fields.title'), t('fields.slug'), t('fields.kind'), t('fields.country'), t('fields.status')]}
      rows={(data ?? []).map((j) => ({
        key: j.id,
        href: `/admin/journeys/${j.id}`,
        cells: [
          tr(j.title_i18n as Record<string, string> | null, locale as Locale) || '—',
          j.slug,
          t(`journeys.kinds.${j.kind as 'itinerary' | 'route_showcase'}`),
          j.country ?? '—',
          <StatusPill key="s" status={j.status} label={t(`status.${j.status}`)} />,
        ],
      }))}
    />
  )
}

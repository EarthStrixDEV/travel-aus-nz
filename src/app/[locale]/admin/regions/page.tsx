import { getTranslations, setRequestLocale } from 'next-intl/server'
import { requireRole } from '@/lib/auth/profile'
import { t as tr, type Locale } from '@/lib/i18n/t'
import { createClient } from '@/lib/supabase/server'
import { AdminList } from '../_lib/admin-list'
import { StatusPill } from '../status-pill'

export default async function RegionsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params
  setRequestLocale(locale)
  await requireRole(['editor', 'admin'])
  const t = await getTranslations('admin')

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('regions')
    .select('id, country, slug, name_i18n, featured_rank, status')
    .order('country')
    .order('slug')
  if (error) throw new Error('Failed to load regions')

  return (
    <AdminList
      title={t('regions.title')}
      addHref="/admin/regions/new"
      addLabel={t('regions.add')}
      empty={t('regions.empty')}
      editLabel={t('form.edit')}
      actionsLabel={t('form.actions')}
      columns={[t('fields.name'), t('fields.slug'), t('fields.country'), t('fields.featuredRank'), t('fields.status')]}
      rows={(data ?? []).map((r) => ({
        key: String(r.id),
        href: `/admin/regions/${r.id}`,
        cells: [
          tr(r.name_i18n as Record<string, string>, locale as Locale),
          r.slug,
          r.country,
          r.featured_rank ?? '—',
          <StatusPill key="s" status={r.status} label={t(`status.${r.status}`)} />,
        ],
      }))}
    />
  )
}

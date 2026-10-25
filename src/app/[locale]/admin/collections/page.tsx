import { getTranslations, setRequestLocale } from 'next-intl/server'
import { requireRole } from '@/lib/auth/profile'
import { t as tr, type Locale } from '@/lib/i18n/t'
import { createClient } from '@/lib/supabase/server'
import { AdminList } from '../_lib/admin-list'
import { StatusPill } from '../status-pill'

export default async function CollectionsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params
  setRequestLocale(locale)
  await requireRole(['editor', 'admin'])
  const t = await getTranslations('admin')

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('collections')
    .select('id, slug, kind, placement, title_i18n, status, items:collection_items(count)')
    .order('slug')
  if (error) throw new Error('Failed to load collections')

  return (
    <AdminList
      title={t('collections.title')}
      addHref="/admin/collections/new"
      addLabel={t('collections.add')}
      empty={t('collections.empty')}
      editLabel={t('form.edit')}
      actionsLabel={t('form.actions')}
      columns={[t('fields.title'), t('fields.slug'), t('fields.kind'), t('fields.placement'), t('collections.items'), t('fields.status')]}
      rows={(data ?? []).map((c) => ({
        key: c.id,
        href: `/admin/collections/${c.id}`,
        cells: [
          tr(c.title_i18n as Record<string, string>, locale as Locale),
          c.slug,
          t(`collections.kinds.${c.kind as 'venue' | 'dish' | 'place'}`),
          c.placement ?? '—',
          c.items[0]?.count ?? 0,
          <StatusPill key="s" status={c.status} label={t(`status.${c.status}`)} />,
        ],
      }))}
    />
  )
}

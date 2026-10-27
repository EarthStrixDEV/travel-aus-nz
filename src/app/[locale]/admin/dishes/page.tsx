import { getTranslations, setRequestLocale } from 'next-intl/server'
import { requireRole } from '@/lib/auth/profile'
import { t as tr, type Locale } from '@/lib/i18n/t'
import { createClient } from '@/lib/supabase/server'
import { AdminList } from '../_lib/admin-list'
import { StatusPill } from '../status-pill'

export default async function DishesAdminPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params
  setRequestLocale(locale)
  await requireRole(['editor', 'admin'])
  const t = await getTranslations('admin')

  const supabase = await createClient()
  const { data, error } = await supabase.from('dishes').select('id, slug, country, type, name_i18n, must_try_rank, status').order('sort').order('slug')
  if (error) throw new Error('Failed to load dishes')

  return (
    <AdminList
      title={t('dishes.title')}
      addHref="/admin/dishes/new"
      addLabel={t('dishes.add')}
      empty={t('dishes.empty')}
      editLabel={t('form.edit')}
      actionsLabel={t('form.actions')}
      columns={[t('fields.name'), t('fields.slug'), t('fields.country'), t('fields.type'), t('dishes.mustTry'), t('fields.status')]}
      rows={(data ?? []).map((d) => ({
        key: d.id,
        href: `/admin/dishes/${d.id}`,
        cells: [
          tr(d.name_i18n as Record<string, string> | null, locale as Locale) || '—',
          d.slug,
          d.country,
          t.has(`dishes.types.${d.type}`) ? t(`dishes.types.${d.type}`) : d.type,
          d.must_try_rank ?? '—',
          <StatusPill key="s" status={d.status} label={t(`status.${d.status}`)} />,
        ],
      }))}
    />
  )
}

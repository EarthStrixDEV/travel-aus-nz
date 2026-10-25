import { getTranslations, setRequestLocale } from 'next-intl/server'
import { requireRole } from '@/lib/auth/profile'
import { t as tr, type Locale } from '@/lib/i18n/t'
import { createClient } from '@/lib/supabase/server'
import { AdminList } from '../_lib/admin-list'
import { StatusPill } from '../status-pill'

export default async function PlacesPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params
  setRequestLocale(locale)
  await requireRole(['editor', 'admin'])
  const t = await getTranslations('admin')

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('places')
    .select('id, slug, type, name_i18n, status, city:cities(name_i18n)')
    .order('slug')
  if (error) throw new Error('Failed to load places')
  const name = (v: unknown) => tr(v as Record<string, string> | null, locale as Locale)

  return (
    <AdminList
      title={t('places.title')}
      addHref="/admin/places/new"
      addLabel={t('places.add')}
      empty={t('places.empty')}
      editLabel={t('form.edit')}
      actionsLabel={t('form.actions')}
      columns={[t('fields.name'), t('fields.slug'), t('fields.type'), t('fields.city'), t('fields.status')]}
      rows={(data ?? []).map((p) => ({
        key: p.id,
        href: `/admin/places/${p.id}`,
        cells: [
          name(p.name_i18n),
          p.slug,
          t(`placeTypes.${p.type}`),
          name(p.city?.name_i18n ?? null),
          <StatusPill key="s" status={p.status} label={t(`status.${p.status}`)} />,
        ],
      }))}
    />
  )
}

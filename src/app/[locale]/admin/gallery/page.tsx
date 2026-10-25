import { getTranslations, setRequestLocale } from 'next-intl/server'
import { requireRole } from '@/lib/auth/profile'
import { t as tr, type Locale } from '@/lib/i18n/t'
import { createClient } from '@/lib/supabase/server'
import { AdminList } from '../_lib/admin-list'
import { StatusPill } from '../status-pill'

export default async function GalleryAdminPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params
  setRequestLocale(locale)
  await requireRole(['editor', 'admin'])
  const t = await getTranslations('admin')

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('gallery_photos')
    .select('id, sort, title_i18n, status, media:media_assets(path), place:places(name_i18n)')
    .order('sort')
    .order('id')
  if (error) throw new Error('Failed to load gallery photos')
  const name = (v: unknown) => tr(v as Record<string, string> | null, locale as Locale)

  return (
    <AdminList
      title={t('gallery.title')}
      addHref="/admin/gallery/new"
      addLabel={t('gallery.add')}
      empty={t('gallery.empty')}
      editLabel={t('form.edit')}
      actionsLabel={t('form.actions')}
      columns={[t('fields.title'), t('fields.photo'), t('fields.place'), t('fields.sort'), t('fields.status')]}
      rows={(data ?? []).map((g) => ({
        key: g.id,
        href: `/admin/gallery/${g.id}`,
        cells: [
          name(g.title_i18n) || '—',
          <span key="p" className="break-all">{g.media?.path ?? '—'}</span>,
          name(g.place?.name_i18n ?? null),
          g.sort ?? 0,
          <StatusPill key="s" status={g.status} label={t(`status.${g.status}`)} />,
        ],
      }))}
    />
  )
}

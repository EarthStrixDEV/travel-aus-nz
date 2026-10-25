import { getTranslations, setRequestLocale } from 'next-intl/server'
import { requireRole } from '@/lib/auth/profile'
import { createClient } from '@/lib/supabase/server'
import { AdminList } from '../_lib/admin-list'
import { isLicensed } from '../_lib/form'

export default async function MediaPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params
  setRequestLocale(locale)
  await requireRole(['editor', 'admin'])
  const t = await getTranslations('admin')

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('media_assets')
    .select('id, path, width, height, credit, license')
    .order('created_at', { ascending: false })
  if (error) throw new Error('Failed to load media')

  return (
    <AdminList
      title={t('media.title')}
      addHref="/admin/media/new"
      addLabel={t('media.add')}
      empty={t('media.empty')}
      editLabel={t('form.edit')}
      actionsLabel={t('form.actions')}
      columns={[t('media.path'), t('media.size'), t('media.credit'), t('media.license')]}
      rows={(data ?? []).map((m) => ({
        key: m.id,
        href: `/admin/media/${m.id}`,
        cells: [
          <span key="p" className="break-all">{m.path}</span>,
          `${m.width}×${m.height}`,
          m.credit || '—',
          isLicensed(m) ? m.license : <span key="l" className="text-copper">{t('form.unlicensed')}</span>,
        ],
      }))}
    />
  )
}

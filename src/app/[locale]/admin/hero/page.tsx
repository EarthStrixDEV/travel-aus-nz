import { getTranslations, setRequestLocale } from 'next-intl/server'
import { requireRole } from '@/lib/auth/profile'
import { t as tr, type Locale } from '@/lib/i18n/t'
import { createClient } from '@/lib/supabase/server'
import { AdminList } from '../_lib/admin-list'
import { StatusPill } from '../status-pill'

export default async function HeroPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params
  setRequestLocale(locale)
  await requireRole(['editor', 'admin'])
  const t = await getTranslations('admin')

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('hero_slides')
    .select('id, sort, active, caption_i18n, media:media_assets(path)')
    .order('sort')
    .order('id')
  if (error) throw new Error('Failed to load hero slides')

  return (
    <AdminList
      title={t('hero.title')}
      addHref="/admin/hero/new"
      addLabel={t('hero.add')}
      empty={t('hero.empty')}
      editLabel={t('form.edit')}
      actionsLabel={t('form.actions')}
      columns={[t('fields.caption'), t('fields.photo'), t('fields.sort'), t('fields.active')]}
      rows={(data ?? []).map((s) => ({
        key: String(s.id),
        href: `/admin/hero/${s.id}`,
        cells: [
          tr(s.caption_i18n as Record<string, string> | null, locale as Locale) || '—',
          <span key="p" className="break-all">{s.media?.path ?? '—'}</span>,
          s.sort ?? 0,
          // Active slides are live on the home page, so they read as "published".
          <StatusPill key="a" status={s.active ? 'published' : 'draft'} label={t(s.active ? 'hero.on' : 'hero.off')} />,
        ],
      }))}
    />
  )
}

import { getTranslations, setRequestLocale } from 'next-intl/server'
import { requireRole } from '@/lib/auth/profile'
import { t as tr, type Locale } from '@/lib/i18n/t'
import { createClient } from '@/lib/supabase/server'
import { AdminList } from '../_lib/admin-list'
import { ruleKey } from './schema'

export default async function EntryAdminPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params
  setRequestLocale(locale)
  await requireRole(['editor', 'admin'])
  const t = await getTranslations('admin')

  const supabase = await createClient()
  const [permissions, rules, links] = await Promise.all([
    supabase.from('permission_types').select('id, country, slug, name_i18n, verified_at, needs_review').order('country').order('id'),
    supabase
      .from('entry_rules')
      .select('nationality, country, purpose, stay, verified_at, needs_review, permission:permission_types(name_i18n)')
      .order('nationality')
      .order('country'),
    supabase.from('official_links').select('id, country, agency, title_i18n, url, health_status').order('id'),
  ])
  if (permissions.error || rules.error || links.error) throw new Error('Failed to load entry content')
  const name = (v: unknown) => tr(v as Record<string, string> | null, locale as Locale)
  const flag = (needsReview: boolean | null) => (needsReview ? t('entry.needsReview') : '—')
  const common = { level: 'h2' as const, editLabel: t('form.edit'), actionsLabel: t('form.actions') }

  return (
    <>
      <h1 className="text-3xl font-semibold text-ink">{t('entry.title')}</h1>
      <div className="mt-8">
        <AdminList
          {...common}
          title={t('entry.permissions')}
          addHref="/admin/entry/permissions/new"
          addLabel={t('entry.addPermission')}
          empty={t('entry.emptyPermissions')}
          columns={[t('fields.name'), t('fields.slug'), t('fields.country'), t('fields.verifiedAt'), t('entry.review')]}
          rows={permissions.data.map((p) => ({
            key: String(p.id),
            href: `/admin/entry/permissions/${p.id}`,
            cells: [name(p.name_i18n), p.slug ?? '—', p.country, p.verified_at ?? '—', flag(p.needs_review)],
          }))}
        />
        <AdminList
          {...common}
          title={t('entry.rules')}
          addHref="/admin/entry/rules/new"
          addLabel={t('entry.addRule')}
          empty={t('entry.emptyRules')}
          columns={[t('entry.nationality'), t('fields.country'), t('entry.purpose'), t('entry.stay'), t('entry.permission'), t('fields.verifiedAt'), t('entry.review')]}
          rows={rules.data.map((r) => {
            const key = ruleKey(r as Parameters<typeof ruleKey>[0])
            return {
              key,
              href: `/admin/entry/rules/${key}`,
              cells: [
                r.nationality,
                r.country,
                t(`entry.purposes.${r.purpose as 'tourism' | 'work_study'}`),
                t(`entry.stays.${r.stay as 'lt1' | '1to3' | 'gt3'}`),
                name(r.permission?.name_i18n ?? null) || '—',
                r.verified_at ?? '—',
                flag(r.needs_review),
              ],
            }
          })}
        />
        <AdminList
          {...common}
          title={t('entry.links')}
          addHref="/admin/entry/links/new"
          addLabel={t('entry.addLink')}
          empty={t('entry.emptyLinks')}
          columns={[t('fields.title'), t('entry.url'), t('entry.agency'), t('entry.health')]}
          rows={links.data.map((l) => ({
            key: String(l.id),
            href: `/admin/entry/links/${l.id}`,
            cells: [name(l.title_i18n) || '—', <span key="u" className="break-all">{l.url}</span>, l.agency ?? '—', l.health_status ?? '—'],
          }))}
        />
      </div>
    </>
  )
}

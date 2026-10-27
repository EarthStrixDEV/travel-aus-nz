import { getTranslations, setRequestLocale } from 'next-intl/server'
import { requireRole } from '@/lib/auth/profile'
import { t as tr, type Locale } from '@/lib/i18n/t'
import { createClient } from '@/lib/supabase/server'
import { AdminList } from '../_lib/admin-list'
import { BLOCK_KEYS } from './schema'

/** Prepare content (spec §12): checklist, packing, connectivity, months per region and the editorial blocks. */
export default async function PrepareAdminPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params
  setRequestLocale(locale)
  await requireRole(['editor', 'admin'])
  const t = await getTranslations('admin')

  const db = await createClient()
  const [checklist, packing, connectivity, regions, blocks] = await Promise.all([
    db.from('checklist_templates').select('id, moment, title_i18n, applies_to, sort').order('sort').order('id'),
    db.from('packing_items').select('id, season, grp, title_i18n, sort').order('season').order('sort'),
    db.from('connectivity_options').select('id, name_i18n, cost_text, verified_at').order('id'),
    db.from('regions').select('id, country, name_i18n, months:region_months(month)').order('country').order('slug'),
    db.from('content_blocks').select('key, verified_at, updated_at').in('key', [...BLOCK_KEYS]),
  ])
  for (const r of [checklist, packing, connectivity, regions, blocks]) if (r.error) throw new Error('Failed to load prepare content')
  const name = (v: unknown) => tr(v as Record<string, string> | null, locale as Locale)
  const common = { level: 'h2' as const, editLabel: t('form.edit'), actionsLabel: t('form.actions') }

  return (
    <>
      <h1 className="text-3xl font-semibold text-ink">{t('prepare.title')}</h1>
      <div className="mt-8">
        <AdminList
          {...common}
          title={t('prepare.checklist')}
          addHref="/admin/prepare/checklist/new"
          addLabel={t('prepare.addChecklist')}
          empty={t('prepare.empty')}
          columns={[t('fields.title'), t('prepare.moment'), t('prepare.appliesTo'), t('fields.sort')]}
          rows={(checklist.data ?? []).map((c) => ({
            key: String(c.id),
            href: `/admin/prepare/checklist/${c.id}`,
            cells: [
              name(c.title_i18n) || '—',
              t.has(`prepare.moments.${c.moment}`) ? t(`prepare.moments.${c.moment}`) : c.moment,
              (c.applies_to ?? ['AU', 'NZ']).join(', '),
              c.sort ?? '—',
            ],
          }))}
        />
        <AdminList
          {...common}
          title={t('prepare.packing')}
          addHref="/admin/prepare/packing/new"
          addLabel={t('prepare.addPacking')}
          empty={t('prepare.empty')}
          columns={[t('fields.title'), t('fields.season'), t('prepare.group'), t('fields.sort')]}
          rows={(packing.data ?? []).map((p) => ({
            key: String(p.id),
            href: `/admin/prepare/packing/${p.id}`,
            cells: [name(p.title_i18n) || '—', p.season ? t(`seasons.${p.season}`) : '—', p.grp ?? '—', p.sort ?? '—'],
          }))}
        />
        <AdminList
          {...common}
          title={t('prepare.connectivity')}
          addHref="/admin/prepare/connectivity/new"
          addLabel={t('prepare.addConnectivity')}
          empty={t('prepare.empty')}
          columns={[t('fields.name'), t('prepare.cost'), t('fields.verifiedAt')]}
          rows={(connectivity.data ?? []).map((c) => ({
            key: String(c.id),
            href: `/admin/prepare/connectivity/${c.id}`,
            cells: [name(c.name_i18n) || '—', c.cost_text ?? '—', c.verified_at ?? '—'],
          }))}
        />
        <AdminList
          {...common}
          title={t('prepare.months')}
          empty={t('prepare.empty')}
          columns={[t('fields.region'), t('fields.country'), t('prepare.monthsFilled')]}
          rows={(regions.data ?? []).map((r) => ({
            key: String(r.id),
            href: `/admin/prepare/months/${r.id}`,
            cells: [name(r.name_i18n) || '—', r.country, `${(r.months ?? []).length}/12`],
          }))}
        />
        <AdminList
          {...common}
          title={t('prepare.blocks')}
          empty={t('prepare.empty')}
          columns={[t('prepare.block'), t('fields.verifiedAt')]}
          rows={BLOCK_KEYS.map((key) => {
            const b = (blocks.data ?? []).find((x) => x.key === key)
            return { key, href: `/admin/prepare/blocks/${key}`, cells: [t(`prepare.blockKeys.${key}`), b?.verified_at ?? '—'] }
          })}
        />
      </div>
    </>
  )
}

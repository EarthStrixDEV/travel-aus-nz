import { getTranslations, setRequestLocale } from 'next-intl/server'
import { requireRole } from '@/lib/auth/profile'
import { t as tr, type Locale } from '@/lib/i18n/t'
import { createClient } from '@/lib/supabase/server'
import { AdminList } from '../_lib/admin-list'
import { StatusPill } from '../status-pill'

/** Transport content (spec §7): agencies, lines with their editorial summary, cards, fare rules, scenic routes, airports. */
export default async function TransitAdminPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params
  setRequestLocale(locale)
  await requireRole(['editor', 'admin'])
  const t = await getTranslations('admin')

  const db = await createClient()
  const [agencies, lines, cards, fares, scenic, airports] = await Promise.all([
    db.from('transit_agencies').select('id, country, name').order('country').order('name'),
    db.from('transit_lines').select('id, mode, short_name, long_name, city:cities(name_i18n), agency:transit_agencies(name)').order('id'),
    db.from('transit_cards').select('id, name, verified_at, city:cities(name_i18n)').order('id'),
    db.from('fare_rules').select('id, mode, currency, verified_at, rule, agency:transit_agencies(name)').order('id'),
    db.from('scenic_routes').select('id, slug, country, name_i18n, status').order('slug'),
    db.from('airport_transfers').select('id, airport_code, option_name, duration_min, verified_at').order('airport_code').order('id'),
  ])
  for (const r of [agencies, lines, cards, fares, scenic, airports]) if (r.error) throw new Error('Failed to load transport content')
  const name = (v: unknown) => tr(v as Record<string, string> | null, locale as Locale)
  const mode = (m: string | null) => (m ? t(`modes.${m as 'train'}`) : t('transit.allModes'))
  const common = { level: 'h2' as const, editLabel: t('form.edit'), actionsLabel: t('form.actions') }
  type Named = { name: string } | null
  type I18nNamed = { name_i18n: unknown } | null

  return (
    <>
      <h1 className="text-3xl font-semibold text-ink">{t('transit.title')}</h1>
      <div className="mt-8">
        <AdminList
          {...common}
          title={t('transit.lines')}
          addHref="/admin/transit/lines/new"
          addLabel={t('transit.addLine')}
          empty={t('transit.empty')}
          columns={[t('transit.shortName'), t('transit.longName'), t('transit.mode'), t('fields.city'), t('transit.agency')]}
          rows={(lines.data ?? []).map((l) => ({
            key: String(l.id),
            href: `/admin/transit/lines/${l.id}`,
            cells: [l.short_name ?? '—', l.long_name ?? '—', mode(l.mode), name((l.city as I18nNamed)?.name_i18n) || '—', (l.agency as Named)?.name ?? '—'],
          }))}
        />
        <AdminList
          {...common}
          title={t('transit.agencies')}
          addHref="/admin/transit/agencies/new"
          addLabel={t('transit.addAgency')}
          empty={t('transit.empty')}
          columns={[t('fields.name'), t('fields.country')]}
          rows={(agencies.data ?? []).map((a) => ({ key: String(a.id), href: `/admin/transit/agencies/${a.id}`, cells: [a.name, a.country] }))}
        />
        <AdminList
          {...common}
          title={t('transit.fares')}
          addHref="/admin/transit/fares/new"
          addLabel={t('transit.addFare')}
          empty={t('transit.empty')}
          columns={[t('transit.agency'), t('transit.mode'), t('transit.fareKind'), t('fields.currency'), t('fields.verifiedAt')]}
          rows={(fares.data ?? []).map((f) => {
            const kind = (f.rule as { kind?: string } | null)?.kind
            return {
              key: String(f.id),
              href: `/admin/transit/fares/${f.id}`,
              cells: [
                (f.agency as Named)?.name ?? '—',
                mode(f.mode),
                kind === 'flat' || kind === 'distance' ? t(`transit.fareKinds.${kind}`) : '—',
                f.currency,
                f.verified_at ?? t('transit.placeholder'),
              ],
            }
          })}
        />
        <AdminList
          {...common}
          title={t('transit.cards')}
          addHref="/admin/transit/cards/new"
          addLabel={t('transit.addCard')}
          empty={t('transit.empty')}
          columns={[t('fields.name'), t('fields.city'), t('fields.verifiedAt')]}
          rows={(cards.data ?? []).map((c) => ({
            key: String(c.id),
            href: `/admin/transit/cards/${c.id}`,
            cells: [c.name, name((c.city as I18nNamed)?.name_i18n) || '—', c.verified_at ?? t('transit.placeholder')],
          }))}
        />
        <AdminList
          {...common}
          title={t('transit.scenic')}
          addHref="/admin/transit/scenic/new"
          addLabel={t('transit.addScenic')}
          empty={t('transit.empty')}
          columns={[t('fields.name'), t('fields.slug'), t('fields.country'), t('fields.status')]}
          rows={(scenic.data ?? []).map((s) => ({
            key: String(s.id),
            href: `/admin/transit/scenic/${s.id}`,
            cells: [name(s.name_i18n) || '—', s.slug ?? '—', s.country ?? '—', <StatusPill key="s" status={s.status} label={t(`status.${s.status}`)} />],
          }))}
        />
        <AdminList
          {...common}
          title={t('transit.airports')}
          addHref="/admin/transit/airports/new"
          addLabel={t('transit.addAirport')}
          empty={t('transit.empty')}
          columns={[t('transit.airportCode'), t('transit.option'), t('transit.durationMin'), t('fields.verifiedAt')]}
          rows={(airports.data ?? []).map((a) => ({
            key: String(a.id),
            href: `/admin/transit/airports/${a.id}`,
            cells: [a.airport_code ?? '—', a.option_name ?? '—', a.duration_min ?? '—', a.verified_at ?? t('transit.placeholder')],
          }))}
        />
      </div>
    </>
  )
}

import { notFound } from 'next/navigation'
import { getTranslations, setRequestLocale } from 'next-intl/server'
import { requireRole } from '@/lib/auth/profile'
import type { Tables } from '@/lib/supabase/database.types'
import { createClient } from '@/lib/supabase/server'
import { SERIAL_PARAM } from '../../../_lib/form'
import { agencyOptions, cardOptions, cityOptions, mediaOptions, stopOptions } from '../../../_lib/options'
import { i18nValues, str, type FormValues } from '../../../_lib/values'
import { AgencyForm, AirportForm, CardForm, FareRuleForm, LineForm, ScenicForm, type BandValues } from '../../forms'

const KINDS = ['agencies', 'lines', 'cards', 'fares', 'scenic', 'airports'] as const
type Kind = (typeof KINDS)[number]

const isKind = (k: string): k is Kind => (KINDS as readonly string[]).includes(k)

type Summary = Tables<'line_service_summary'>
type LineRow = Tables<'transit_lines'> & { summary: Summary | Summary[] | null; stops: { seq: number; stop_id: number }[] | null }

/** Edit page for every transit entity: `/admin/transit/<kind>/<id | new>`. */
export default async function TransitEditPage({ params }: { params: Promise<{ locale: string; kind: string; id: string }> }) {
  const { locale, kind, id: rawId } = await params
  setRequestLocale(locale)
  await requireRole(['editor', 'admin'])
  const t = await getTranslations('admin')
  if (!isKind(kind)) notFound()
  const isNew = rawId === 'new'
  if (!isNew && !SERIAL_PARAM.test(rawId)) notFound()
  const id = isNew ? null : Number(rawId)
  const db = await createClient()

  function row<T>({ data, error }: { data: T | null; error: unknown }): T | null {
    if (error) throw new Error(`Failed to load ${kind}`)
    if (id !== null && !data) notFound()
    return data
  }

  const title = <h1 className="text-3xl font-semibold text-ink">{t(`transit.${isNew ? 'new' : 'edit'}.${kind}`)}</h1>
  let form: React.ReactNode

  switch (kind) {
    case 'agencies': {
      const a = id === null ? null : row<Tables<'transit_agencies'>>(await db.from('transit_agencies').select('*').eq('id', id).maybeSingle())
      const values: FormValues = { name: str(a?.name), country: a?.country ?? 'AU', website: str(a?.website), gtfs_url: str(a?.gtfs_url), card_id: str(a?.card_id) }
      form = <AgencyForm id={id} values={values} cards={await cardOptions(db)} />
      break
    }
    case 'lines': {
      const l =
        id === null
          ? null
          : row<LineRow>(await db.from('transit_lines').select('*, summary:line_service_summary(*), stops:line_stops(seq, stop_id)').eq('id', id).maybeSingle())
      const s = l ? (Array.isArray(l.summary) ? l.summary[0] : l.summary) : null
      const values: FormValues = {
        short_name: str(l?.short_name),
        long_name: str(l?.long_name),
        mode: l?.mode ?? 'train',
        agency_id: str(l?.agency_id),
        city_id: str(l?.city_id),
        end_to_end_min: str(s?.end_to_end_min),
        headway_peak_min: str(s?.headway_peak_min),
        headway_offpeak_min: str(s?.headway_offpeak_min),
        fare_min: str(s?.fare_min),
        fare_max: str(s?.fare_max),
      }
      const stops = [...(l?.stops ?? [])].sort((a, b) => a.seq - b.seq).map((x) => String(x.stop_id))
      const [agencies, cities, stopOpts] = await Promise.all([agencyOptions(db), cityOptions(db, locale), stopOptions(db)])
      form = <LineForm id={id} values={values} stops={stops} agencies={agencies} cities={cities} stopOptions={stopOpts} />
      break
    }
    case 'cards': {
      const c = id === null ? null : row<Tables<'transit_cards'>>(await db.from('transit_cards').select('*').eq('id', id).maybeSingle())
      const values: FormValues = {
        ...i18nValues(c?.how_to_i18n, 'how_to'),
        ...i18nValues(c?.caps_i18n, 'caps'),
        name: str(c?.name),
        city_id: str(c?.city_id),
        official_url: str(c?.official_url),
        verified_at: str(c?.verified_at),
        contactless: String(c?.contactless ?? false),
      }
      form = <CardForm id={id} values={values} cities={await cityOptions(db, locale)} />
      break
    }
    case 'fares': {
      const f = id === null ? null : row<Tables<'fare_rules'>>(await db.from('fare_rules').select('*').eq('id', id).maybeSingle())
      const rule = (f?.rule ?? {}) as { kind?: string; peak?: number; offpeak?: number; daily_cap?: number; bands?: { upto_km: number; peak: number; offpeak: number }[] }
      const values: FormValues = {
        agency_id: str(f?.agency_id),
        mode: str(f?.mode),
        currency: f?.currency ?? 'AUD',
        verified_at: str(f?.verified_at),
        kind: rule.kind === 'distance' ? 'distance' : 'flat',
        peak: str(rule.peak),
        offpeak: str(rule.offpeak),
        daily_cap: str(rule.daily_cap),
      }
      const bands: BandValues[] = (rule.bands ?? []).map((b) => ({ upto_km: str(b.upto_km), peak: str(b.peak), offpeak: str(b.offpeak) }))
      form = <FareRuleForm id={id} values={values} bands={bands} agencies={await agencyOptions(db)} />
      break
    }
    case 'scenic': {
      const s = id === null ? null : row<Tables<'scenic_routes'>>(await db.from('scenic_routes').select('*').eq('id', id).maybeSingle())
      const values: FormValues = {
        ...i18nValues(s?.name_i18n, 'name'),
        ...i18nValues(s?.line_i18n, 'line'),
        slug: str(s?.slug),
        country: str(s?.country),
        mode: str(s?.mode),
        from_name: str(s?.from_name),
        to_name: str(s?.to_name),
        duration_text: str(s?.duration_text),
        frequency_text: str(s?.frequency_text),
        fare_from: str(s?.fare_from),
        currency: str(s?.currency),
        cover_media_id: str(s?.cover_media_id),
        status: s?.status ?? 'draft',
      }
      form = <ScenicForm id={id} values={values} media={await mediaOptions(db, t('form.unlicensed'))} />
      break
    }
    case 'airports': {
      const a = id === null ? null : row<Tables<'airport_transfers'>>(await db.from('airport_transfers').select('*').eq('id', id).maybeSingle())
      const values: FormValues = {
        airport_code: str(a?.airport_code),
        city_id: str(a?.city_id),
        option_name: str(a?.option_name),
        mode: str(a?.mode),
        duration_min: str(a?.duration_min),
        fare_min: str(a?.fare_min),
        fare_max: str(a?.fare_max),
        currency: str(a?.currency),
        verified_at: str(a?.verified_at),
      }
      form = <AirportForm id={id} values={values} cities={await cityOptions(db, locale)} />
      break
    }
  }

  return (
    <>
      {title}
      {form}
    </>
  )
}

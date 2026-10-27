'use client'

import { useTranslations } from 'next-intl'
import { TextField } from '@/components/ui/text-field'
import { AdminForm } from '../_lib/admin-form'
import { BilingualField, Checkbox, Fieldset, RowInput, RowSelect, SelectField, type Option } from '../_lib/fields'
import { COUNTRIES, STATUSES, TRANSIT_MODES } from '../_lib/form'
import type { FormValues } from '../_lib/values'
import { saveAgency, saveAirport, saveCard, saveFareRule, saveLine, saveScenic } from './actions'
import { MAX_FARE_BANDS, MAX_LINE_STOPS } from './schema'

const BACK = '/admin/transit'
const countryOptions = COUNTRIES.map((c) => ({ value: c, label: c }))

function useModes(): Option[] {
  const t = useTranslations('admin')
  return TRANSIT_MODES.map((m) => ({ value: m, label: t(`modes.${m}`) }))
}

export function AgencyForm({ id, values, cards }: { id: number | null; values: FormValues; cards: Option[] }) {
  const t = useTranslations('admin')
  return (
    <AdminForm action={(fd) => saveAgency(id, fd)} backHref={BACK}>
      {(fe) => (
        <>
          <TextField label={t('fields.name')} name="name" defaultValue={values.name} error={fe.name} required />
          <SelectField label={t('fields.country')} name="country" options={countryOptions} defaultValue={values.country} error={fe.country} />
          <TextField label={t('fields.website')} name="website" type="url" defaultValue={values.website} error={fe.website} />
          <TextField label={t('transit.gtfsUrl')} name="gtfs_url" type="url" defaultValue={values.gtfs_url} error={fe.gtfs_url} />
          <SelectField label={t('transit.card')} name="card_id" options={cards} defaultValue={values.card_id} blank={t('form.none')} error={fe.card_id} />
        </>
      )}
    </AdminForm>
  )
}

export function LineForm({
  id,
  values,
  stops,
  agencies,
  cities,
  stopOptions,
}: {
  id: number | null
  values: FormValues
  stops: string[]
  agencies: Option[]
  cities: Option[]
  stopOptions: Option[]
}) {
  const t = useTranslations('admin')
  const modes = useModes()
  const stopRows = Array.from({ length: MAX_LINE_STOPS }, (_, i) => stops[i] ?? '')
  return (
    <AdminForm action={(fd) => saveLine(id, fd)} backHref={BACK}>
      {(fe) => (
        <>
          <TextField label={t('transit.shortName')} name="short_name" defaultValue={values.short_name} error={fe.short_name} />
          <TextField label={t('transit.longName')} name="long_name" defaultValue={values.long_name} error={fe.long_name} />
          <SelectField label={t('transit.mode')} name="mode" options={modes} defaultValue={values.mode} error={fe.mode} />
          <SelectField label={t('transit.agency')} name="agency_id" options={agencies} defaultValue={values.agency_id} blank={t('form.none')} error={fe.agency_id} />
          <SelectField label={t('fields.city')} name="city_id" options={cities} defaultValue={values.city_id} blank={t('form.none')} error={fe.city_id} />
          <TextField label={t('transit.endToEnd')} name="end_to_end_min" defaultValue={values.end_to_end_min} error={fe.end_to_end_min} />
          <TextField label={t('transit.headwayPeak')} name="headway_peak_min" defaultValue={values.headway_peak_min} error={fe.headway_peak_min} />
          <TextField label={t('transit.headwayOffpeak')} name="headway_offpeak_min" defaultValue={values.headway_offpeak_min} error={fe.headway_offpeak_min} />
          <TextField label={t('transit.fareMin')} name="fare_min" defaultValue={values.fare_min} error={fe.fare_min} />
          <TextField label={t('transit.fareMax')} name="fare_max" defaultValue={values.fare_max} error={fe.fare_max} />
          <Fieldset legend={t('transit.stops')} error={fe.stops}>
            <p className="text-[13px] text-ink-2">{t('transit.stopsHint')}</p>
            <div className="grid grid-cols-1 gap-x-4 gap-y-2 sm:grid-cols-2 lg:grid-cols-4">
              {stopRows.map((s, i) => (
                <RowSelect key={i} label={t('transit.stopN', { n: i + 1 })} name="stop_id[]" options={stopOptions} defaultValue={s} blank={t('form.none')} />
              ))}
            </div>
          </Fieldset>
        </>
      )}
    </AdminForm>
  )
}

export function CardForm({ id, values, cities }: { id: number | null; values: FormValues; cities: Option[] }) {
  const t = useTranslations('admin')
  return (
    <AdminForm action={(fd) => saveCard(id, fd)} backHref={BACK}>
      {(fe) => (
        <>
          <TextField label={t('fields.name')} name="name" defaultValue={values.name} error={fe.name} required />
          <SelectField label={t('fields.city')} name="city_id" options={cities} defaultValue={values.city_id} blank={t('form.none')} error={fe.city_id} />
          <BilingualField name="how_to" label={t('transit.howTo')} values={values} errors={fe} />
          <BilingualField name="caps" label={t('transit.caps')} values={values} errors={fe} />
          <TextField label={t('transit.officialUrl')} name="official_url" type="url" defaultValue={values.official_url} error={fe.official_url} />
          <TextField label={t('fields.verifiedAt')} name="verified_at" type="date" defaultValue={values.verified_at} error={fe.verified_at} />
          <Checkbox label={t('transit.contactless')} name="contactless" defaultChecked={values.contactless === 'true'} />
        </>
      )}
    </AdminForm>
  )
}

export type BandValues = Record<'upto_km' | 'peak' | 'offpeak', string>
const EMPTY_BAND: BandValues = { upto_km: '', peak: '', offpeak: '' }

export function FareRuleForm({ id, values, bands, agencies }: { id: number | null; values: FormValues; bands: BandValues[]; agencies: Option[] }) {
  const t = useTranslations('admin')
  const modes = useModes()
  const bandRows = Array.from({ length: MAX_FARE_BANDS }, (_, i) => bands[i] ?? EMPTY_BAND)
  return (
    <AdminForm action={(fd) => saveFareRule(id, fd)} backHref={BACK}>
      {(fe) => (
        <>
          <SelectField label={t('transit.agency')} name="agency_id" options={agencies} defaultValue={values.agency_id} error={fe.agency_id} />
          <SelectField label={t('transit.modeOptional')} name="mode" options={modes} defaultValue={values.mode} blank={t('transit.allModes')} error={fe.mode} />
          <TextField label={t('fields.currency')} name="currency" defaultValue={values.currency} error={fe.currency} required />
          <TextField label={t('fields.verifiedAt')} name="verified_at" type="date" defaultValue={values.verified_at} error={fe.verified_at} />
          <SelectField
            label={t('transit.fareKind')}
            name="kind"
            options={(['flat', 'distance'] as const).map((k) => ({ value: k, label: t(`transit.fareKinds.${k}`) }))}
            defaultValue={values.kind}
            error={fe.kind}
          />
          <TextField label={t('transit.dailyCap')} name="daily_cap" defaultValue={values.daily_cap} error={fe.daily_cap} />
          <TextField label={t('transit.peak')} name="peak" defaultValue={values.peak} error={fe.peak} />
          <TextField label={t('transit.offpeak')} name="offpeak" defaultValue={values.offpeak} error={fe.offpeak} />
          <Fieldset legend={t('transit.bands')} error={fe.bands}>
            <p className="text-[13px] text-ink-2">{t('transit.bandsHint')}</p>
            {bandRows.map((b, i) => (
              <div key={i} className="grid grid-cols-3 gap-x-4 border-b border-line-2 pb-3">
                <RowInput label={t('form.row', { label: t('transit.uptoKm'), n: i + 1 })} name="band_upto_km[]" type="number" defaultValue={b.upto_km} />
                <RowInput label={t('form.row', { label: t('transit.peak'), n: i + 1 })} name="band_peak[]" defaultValue={b.peak} />
                <RowInput label={t('form.row', { label: t('transit.offpeak'), n: i + 1 })} name="band_offpeak[]" defaultValue={b.offpeak} />
              </div>
            ))}
          </Fieldset>
        </>
      )}
    </AdminForm>
  )
}

export function ScenicForm({ id, values, media }: { id: number | null; values: FormValues; media: Option[] }) {
  const t = useTranslations('admin')
  const modes = useModes()
  return (
    <AdminForm action={(fd) => saveScenic(id, fd)} backHref={BACK}>
      {(fe) => (
        <>
          <BilingualField name="name" label={t('fields.name')} values={values} errors={fe} required />
          <TextField label={t('fields.slug')} name="slug" defaultValue={values.slug} error={fe.slug} required />
          <SelectField label={t('fields.country')} name="country" options={countryOptions} defaultValue={values.country} blank={t('form.none')} error={fe.country} />
          <SelectField label={t('transit.mode')} name="mode" options={modes} defaultValue={values.mode} blank={t('form.none')} error={fe.mode} />
          <TextField label={t('fields.fromName')} name="from_name" defaultValue={values.from_name} error={fe.from_name} />
          <TextField label={t('fields.toName')} name="to_name" defaultValue={values.to_name} error={fe.to_name} />
          <BilingualField name="line" label={t('fields.line')} values={values} errors={fe} />
          <TextField label={t('transit.durationText')} name="duration_text" defaultValue={values.duration_text} error={fe.duration_text} />
          <TextField label={t('transit.frequencyText')} name="frequency_text" defaultValue={values.frequency_text} error={fe.frequency_text} />
          <TextField label={t('transit.fareFrom')} name="fare_from" defaultValue={values.fare_from} error={fe.fare_from} />
          <TextField label={t('fields.currency')} name="currency" defaultValue={values.currency} error={fe.currency} />
          <SelectField label={t('fields.cover')} name="cover_media_id" options={media} defaultValue={values.cover_media_id} blank={t('form.none')} error={fe.cover_media_id} />
          <SelectField
            label={t('fields.status')}
            name="status"
            options={STATUSES.map((s) => ({ value: s, label: t(`status.${s}`) }))}
            defaultValue={values.status}
            error={fe.status}
          />
        </>
      )}
    </AdminForm>
  )
}

export function AirportForm({ id, values, cities }: { id: number | null; values: FormValues; cities: Option[] }) {
  const t = useTranslations('admin')
  const modes = useModes()
  return (
    <AdminForm action={(fd) => saveAirport(id, fd)} backHref={BACK}>
      {(fe) => (
        <>
          <TextField label={t('transit.airportCode')} name="airport_code" defaultValue={values.airport_code} error={fe.airport_code} required />
          <SelectField label={t('fields.city')} name="city_id" options={cities} defaultValue={values.city_id} blank={t('form.none')} error={fe.city_id} />
          <TextField label={t('transit.option')} name="option_name" defaultValue={values.option_name} error={fe.option_name} required />
          <SelectField label={t('transit.mode')} name="mode" options={modes} defaultValue={values.mode} blank={t('form.none')} error={fe.mode} />
          <TextField label={t('transit.durationMin')} name="duration_min" defaultValue={values.duration_min} error={fe.duration_min} />
          <TextField label={t('transit.fareMin')} name="fare_min" defaultValue={values.fare_min} error={fe.fare_min} />
          <TextField label={t('transit.fareMax')} name="fare_max" defaultValue={values.fare_max} error={fe.fare_max} />
          <TextField label={t('fields.currency')} name="currency" defaultValue={values.currency} error={fe.currency} />
          <TextField label={t('fields.verifiedAt')} name="verified_at" type="date" defaultValue={values.verified_at} error={fe.verified_at} />
        </>
      )}
    </AdminForm>
  )
}

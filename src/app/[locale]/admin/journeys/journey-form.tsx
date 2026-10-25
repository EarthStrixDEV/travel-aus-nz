'use client'

import { useTranslations } from 'next-intl'
import { TextField } from '@/components/ui/text-field'
import { AdminForm } from '../_lib/admin-form'
import { BilingualField, CheckboxGroup, Fieldset, RowInput, RowSelect, SelectField, type Option } from '../_lib/fields'
import { COUNTRIES, STATUSES, TRANSIT_MODES } from '../_lib/form'
import type { FormValues } from '../_lib/values'
import { saveJourney } from './actions'
import { JOURNEY_KINDS, MAX_LEGS } from './schema'

export type LegValues = Record<'mode' | 'from_name' | 'to_name' | 'operator' | 'duration_min' | 'frequency_text' | 'day', string>

const EMPTY_LEG: LegValues = { mode: '', from_name: '', to_name: '', operator: '', duration_min: '', frequency_text: '', day: '' }

export function JourneyForm({
  id,
  values,
  modes,
  legs,
  media,
}: {
  id: string | null
  values: FormValues
  modes: string[]
  legs: LegValues[]
  media: Option[]
}) {
  const t = useTranslations('admin')
  const modeOptions = TRANSIT_MODES.map((m) => ({ value: m, label: t(`modes.${m}`) }))
  const legRows = Array.from({ length: MAX_LEGS }, (_, i) => legs[i] ?? EMPTY_LEG)

  return (
    <AdminForm action={(fd) => saveJourney(id, fd)} backHref="/admin/journeys">
      {(fe) => (
        <>
          <BilingualField name="title" label={t('fields.title')} values={values} errors={fe} required />
          <TextField label={t('fields.slug')} name="slug" defaultValue={values.slug} error={fe.slug} required />
          <SelectField
            label={t('fields.kind')}
            name="kind"
            options={JOURNEY_KINDS.map((k) => ({ value: k, label: t(`journeys.kinds.${k}`) }))}
            defaultValue={values.kind}
            error={fe.kind}
          />
          <SelectField
            label={t('fields.country')}
            name="country"
            options={COUNTRIES.map((c) => ({ value: c, label: c }))}
            defaultValue={values.country}
            blank={t('form.none')}
            error={fe.country}
          />
          <BilingualField name="line" label={t('fields.line')} values={values} errors={fe} />
          <TextField label={t('fields.fromName')} name="from_name" defaultValue={values.from_name} error={fe.from_name} />
          <TextField label={t('fields.toName')} name="to_name" defaultValue={values.to_name} error={fe.to_name} />
          <TextField label={t('fields.days')} name="days" defaultValue={values.days} error={fe.days} />
          <TextField label={t('fields.priceFrom')} name="price_from" defaultValue={values.price_from} error={fe.price_from} />
          <TextField label={t('fields.currency')} name="currency" defaultValue={values.currency} error={fe.currency} />
          <SelectField
            label={t('fields.cover')}
            name="cover_media_id"
            options={media}
            defaultValue={values.cover_media_id}
            blank={t('form.none')}
            error={fe.cover_media_id}
          />
          <SelectField
            label={t('fields.status')}
            name="status"
            options={STATUSES.map((s) => ({ value: s, label: t(`status.${s}`) }))}
            defaultValue={values.status}
            error={fe.status}
          />
          <CheckboxGroup legend={t('fields.modes')} name="modes" options={modeOptions} checked={modes} error={fe.modes} />

          <Fieldset legend={t('journeys.legs')} error={fe.legs}>
            <p className="text-[13px] text-ink-2">{t('journeys.legsHint')}</p>
            {legRows.map((leg, i) => (
              <div key={i} className="grid grid-cols-2 gap-x-4 gap-y-2 border-b border-line-2 pb-3 sm:grid-cols-4 lg:grid-cols-7">
                <RowSelect label={t('journeys.legMode', { n: i + 1 })} name="leg_mode[]" options={modeOptions} defaultValue={leg.mode} blank={t('form.none')} />
                <RowInput label={t('form.row', { label: t('fields.fromName'), n: i + 1 })} name="leg_from_name[]" defaultValue={leg.from_name} />
                <RowInput label={t('form.row', { label: t('fields.toName'), n: i + 1 })} name="leg_to_name[]" defaultValue={leg.to_name} />
                <RowInput label={t('form.row', { label: t('journeys.operator'), n: i + 1 })} name="leg_operator[]" defaultValue={leg.operator} />
                <RowInput label={t('form.row', { label: t('journeys.durationMin'), n: i + 1 })} name="leg_duration_min[]" type="number" defaultValue={leg.duration_min} />
                <RowInput label={t('form.row', { label: t('journeys.frequency'), n: i + 1 })} name="leg_frequency_text[]" defaultValue={leg.frequency_text} />
                <RowInput label={t('form.row', { label: t('journeys.day'), n: i + 1 })} name="leg_day[]" type="number" defaultValue={leg.day} />
              </div>
            ))}
          </Fieldset>
        </>
      )}
    </AdminForm>
  )
}

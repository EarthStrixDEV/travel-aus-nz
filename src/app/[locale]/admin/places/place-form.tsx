'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { TextField } from '@/components/ui/text-field'
import { AdminForm } from '../_lib/admin-form'
import { BilingualField, Checkbox, CheckboxGroup, Fieldset, RowInput, RowSelect, SelectField, type Option } from '../_lib/fields'
import { STATUSES } from '../_lib/form'
import type { FormValues } from '../_lib/values'
import { savePlace } from './actions'
import { BOOKINGS, DIETARY, DRINKS, isVenueType, MAX_STOPS, PLACE_TYPES } from './schema'

export type HourSlot = { open: string; close: string }
export type StopLink = { stop_id: string; walk_min: string }

/** Two opening intervals per weekday (0 = Sunday, as in `place_hours.weekday`). */
const SLOTS = 2

export function PlaceForm({
  id,
  values,
  checked,
  hours,
  stops,
  options,
  weekdays,
}: {
  id: string | null
  values: FormValues
  checked: { tags: string[]; dietary: string[]; drinks: string[] }
  /** hours[weekday][slot] */
  hours: HourSlot[][]
  stops: StopLink[]
  options: { cities: Option[]; tags: Option[]; cuisines: Option[]; stops: Option[] }
  weekdays: string[]
}) {
  const t = useTranslations('admin')
  const [type, setType] = useState(values.type)
  const stopRows = Array.from({ length: MAX_STOPS }, (_, i) => stops[i] ?? { stop_id: '', walk_min: '' })

  return (
    <AdminForm action={(fd) => savePlace(id, fd)} backHref="/admin/places">
      {(fe) => (
        <>
          <BilingualField name="name" label={t('fields.name')} values={values} errors={fe} required />
          <TextField label={t('fields.slug')} name="slug" defaultValue={values.slug} error={fe.slug} required />
          <SelectField
            label={t('fields.type')}
            name="type"
            options={PLACE_TYPES.map((v) => ({ value: v, label: t(`placeTypes.${v}`) }))}
            defaultValue={values.type}
            onChange={setType}
            error={fe.type}
          />
          <SelectField label={t('fields.city')} name="city_id" options={options.cities} defaultValue={values.city_id} error={fe.city_id} />
          <TextField label={t('fields.category')} name="category" defaultValue={values.category} error={fe.category} />
          <SelectField
            label={t('fields.status')}
            name="status"
            options={STATUSES.map((s) => ({ value: s, label: t(`status.${s}`) }))}
            defaultValue={values.status}
            error={fe.status}
          />
          <TextField label={t('fields.lng')} name="lng" defaultValue={values.lng} error={fe.lng} required />
          <TextField label={t('fields.lat')} name="lat" defaultValue={values.lat} error={fe.lat} required />
          <BilingualField name="area" label={t('fields.area')} values={values} errors={fe} />
          <BilingualField name="desc" label={t('fields.desc')} values={values} errors={fe} />
          <BilingualField name="best_time" label={t('fields.bestTime')} values={values} errors={fe} />
          <BilingualField name="access" label={t('fields.access')} values={values} errors={fe} />
          <TextField label={t('fields.priceLevel')} name="price_level" defaultValue={values.price_level} error={fe.price_level} />
          <TextField label={t('fields.website')} name="website" type="url" defaultValue={values.website} error={fe.website} />
          <BilingualField name="price_note" label={t('fields.priceNote')} values={values} errors={fe} />
          <BilingualField name="hours_note" label={t('fields.hoursNote')} values={values} errors={fe} />
          <TextField label={t('fields.verifiedAt')} name="verified_at" type="date" defaultValue={values.verified_at} error={fe.verified_at} />
          <Checkbox label={t('fields.isClosed')} name="is_closed" defaultChecked={values.is_closed === 'true'} />

          <CheckboxGroup legend={t('fields.tags')} name="tags" options={options.tags} checked={checked.tags} error={fe.tags} />

          <Fieldset legend={t('places.hours')} error={fe.hours}>
            <p className="text-[13px] text-ink-2">{t('places.hoursHint')}</p>
            {weekdays.map((day, wd) => (
              <div key={wd} className="grid grid-cols-[minmax(0,7rem)_repeat(2,minmax(0,1fr))] items-end gap-x-4 sm:grid-cols-[7rem_repeat(4,minmax(0,1fr))]">
                <span className="pb-2.5 text-sm font-medium text-ink">{day}</span>
                {Array.from({ length: SLOTS }, (_, s) => (
                  <div key={s} className="contents">
                    <input type="hidden" name="hour_weekday[]" value={wd} />
                    <RowInput label={t('places.opens', { day, n: s + 1 })} name="hour_open_time[]" type="time" defaultValue={hours[wd]?.[s]?.open ?? ''} />
                    <RowInput label={t('places.closes', { day, n: s + 1 })} name="hour_close_time[]" type="time" defaultValue={hours[wd]?.[s]?.close ?? ''} />
                  </div>
                ))}
              </div>
            ))}
          </Fieldset>

          <Fieldset legend={t('places.stops')} error={fe.stops}>
            <p className="text-[13px] text-ink-2">{t('places.stopsHint')}</p>
            {stopRows.map((s, i) => (
              <div key={i} className="grid grid-cols-[minmax(0,1fr)_7rem] gap-x-4">
                <RowSelect
                  label={t('places.stop', { rank: i + 1 })}
                  name="stop_stop_id[]"
                  options={options.stops}
                  defaultValue={s.stop_id}
                  blank={t('form.none')}
                />
                <RowInput label={t('form.row', { label: t('places.walkMin'), n: i + 1 })} name="stop_walk_min[]" type="number" defaultValue={s.walk_min} />
              </div>
            ))}
          </Fieldset>

          {isVenueType(type) && (
            <Fieldset legend={t('places.venue')}>
              <div className="grid grid-cols-1 gap-x-8 gap-y-6 md:grid-cols-2">
                <SelectField
                  label={t('fields.cuisine')}
                  name="cuisine_id"
                  options={options.cuisines}
                  defaultValue={values.cuisine_id}
                  blank={t('form.none')}
                  error={fe.cuisine_id}
                />
                <SelectField
                  label={t('fields.booking')}
                  name="booking"
                  options={BOOKINGS.map((b) => ({ value: b, label: t(`bookings.${b}`) }))}
                  defaultValue={values.booking}
                  blank={t('form.none')}
                  error={fe.booking}
                />
                <BilingualField name="menu_highlights" label={t('fields.menuHighlights')} values={values} errors={fe} />
                <BilingualField name="drinks_text" label={t('fields.drinksText')} values={values} errors={fe} />
                <CheckboxGroup
                  legend={t('fields.dietary')}
                  name="dietary"
                  options={DIETARY.map((v) => ({ value: v, label: t(`dietary.${v}`) }))}
                  checked={checked.dietary}
                  error={fe.dietary}
                />
                <CheckboxGroup
                  legend={t('fields.drinks')}
                  name="drinks"
                  options={DRINKS.map((v) => ({ value: v, label: t(`drinks.${v}`) }))}
                  checked={checked.drinks}
                  error={fe.drinks}
                />
              </div>
            </Fieldset>
          )}
        </>
      )}
    </AdminForm>
  )
}

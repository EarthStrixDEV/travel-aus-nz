'use client'

import { useTranslations } from 'next-intl'
import { TextField } from '@/components/ui/text-field'
import { DISH_DIETS, DISH_TYPES } from '@/lib/dishes/filter'
import { AdminForm } from '../_lib/admin-form'
import { BilingualField, CheckboxGroup, Fieldset, RowInput, RowSelect, SelectField, type Option } from '../_lib/fields'
import { COUNTRIES, STATUSES } from '../_lib/form'
import type { FormValues } from '../_lib/values'
import { saveDish } from './actions'
import { MAX_PAIRINGS, MAX_VENUES } from './schema'

export type PairingValues = Record<'k_th' | 'k_en' | 'v_th' | 'v_en', string>
export type DishVenueValues = Record<'place_id' | 'region_id' | 'rank' | 'price_text' | 'note_th' | 'note_en', string>

const EMPTY_PAIRING: PairingValues = { k_th: '', k_en: '', v_th: '', v_en: '' }
const EMPTY_VENUE: DishVenueValues = { place_id: '', region_id: '', rank: '', price_text: '', note_th: '', note_en: '' }

export function DishForm({
  id,
  values,
  dietary,
  pairings,
  venues,
  regions,
  places,
  media,
}: {
  id: string | null
  values: FormValues
  dietary: string[]
  pairings: PairingValues[]
  venues: DishVenueValues[]
  regions: Option[]
  places: Option[]
  media: Option[]
}) {
  const t = useTranslations('admin')
  const pairingRows = Array.from({ length: MAX_PAIRINGS }, (_, i) => pairings[i] ?? EMPTY_PAIRING)
  const venueRows = Array.from({ length: MAX_VENUES }, (_, i) => venues[i] ?? EMPTY_VENUE)

  return (
    <AdminForm action={(fd) => saveDish(id, fd)} backHref="/admin/dishes">
      {(fe) => (
        <>
          <BilingualField name="name" label={t('fields.name')} values={values} errors={fe} required />
          <TextField label={t('fields.slug')} name="slug" defaultValue={values.slug} error={fe.slug} required />
          <SelectField label={t('fields.country')} name="country" options={COUNTRIES.map((c) => ({ value: c, label: c }))} defaultValue={values.country} error={fe.country} />
          <SelectField label={t('fields.region')} name="region_id" options={regions} defaultValue={values.region_id} blank={t('form.none')} error={fe.region_id} />
          <SelectField
            label={t('fields.type')}
            name="type"
            options={DISH_TYPES.map((d) => ({ value: d, label: t(`dishes.types.${d}`) }))}
            defaultValue={values.type}
            error={fe.type}
          />
          <BilingualField name="line" label={t('fields.line')} values={values} errors={fe} />
          <BilingualField name="story" label={t('dishes.story')} values={values} errors={fe} />
          <BilingualField name="dispute" label={t('dishes.dispute')} values={values} errors={fe} />
          <BilingualField name="taste" label={t('dishes.taste')} values={values} errors={fe} />
          <BilingualField name="served" label={t('dishes.served')} values={values} errors={fe} />
          <BilingualField name="allergy" label={t('dishes.allergy')} values={values} errors={fe} />
          <TextField label={t('dishes.priceLevel')} name="price_level" defaultValue={values.price_level} error={fe.price_level} />
          <TextField label={t('dishes.priceText')} name="price_text" defaultValue={values.price_text} error={fe.price_text} />
          <TextField label={t('dishes.mustTry')} name="must_try_rank" defaultValue={values.must_try_rank} error={fe.must_try_rank} />
          <TextField label={t('fields.sort')} name="sort" defaultValue={values.sort} error={fe.sort} />
          <SelectField label={t('fields.cover')} name="cover_media_id" options={media} defaultValue={values.cover_media_id} blank={t('form.none')} error={fe.cover_media_id} />
          <TextField label={t('fields.verifiedAt')} name="verified_at" type="date" defaultValue={values.verified_at} error={fe.verified_at} />
          <SelectField
            label={t('fields.status')}
            name="status"
            options={STATUSES.map((s) => ({ value: s, label: t(`status.${s}`) }))}
            defaultValue={values.status}
            error={fe.status}
          />
          <CheckboxGroup
            legend={t('fields.dietary')}
            name="dietary"
            options={DISH_DIETS.map((d) => ({ value: d, label: t(`dishes.diets.${d}`) }))}
            checked={dietary}
            error={fe.dietary}
          />

          <Fieldset legend={t('dishes.pairings')} error={fe.pairings}>
            <p className="text-[13px] text-ink-2">{t('dishes.pairingsHint')}</p>
            {pairingRows.map((p, i) => (
              <div key={i} className="grid grid-cols-2 gap-x-4 gap-y-2 border-b border-line-2 pb-3 lg:grid-cols-4">
                <RowInput label={t('form.row', { label: t('dishes.pairKeyTh'), n: i + 1 })} name="pairing_k_th[]" defaultValue={p.k_th} />
                <RowInput label={t('form.row', { label: t('dishes.pairKeyEn'), n: i + 1 })} name="pairing_k_en[]" defaultValue={p.k_en} />
                <RowInput label={t('form.row', { label: t('dishes.pairValueTh'), n: i + 1 })} name="pairing_v_th[]" defaultValue={p.v_th} />
                <RowInput label={t('form.row', { label: t('dishes.pairValueEn'), n: i + 1 })} name="pairing_v_en[]" defaultValue={p.v_en} />
              </div>
            ))}
          </Fieldset>

          <Fieldset legend={t('dishes.venues')} error={fe.venues}>
            <p className="text-[13px] text-ink-2">{t('dishes.venuesHint')}</p>
            {venueRows.map((v, i) => (
              <div key={i} className="grid grid-cols-2 gap-x-4 gap-y-2 border-b border-line-2 pb-3 lg:grid-cols-6">
                <RowSelect label={t('form.row', { label: t('fields.place'), n: i + 1 })} name="venue_place_id[]" options={places} defaultValue={v.place_id} blank={t('form.none')} />
                <RowSelect label={t('form.row', { label: t('fields.region'), n: i + 1 })} name="venue_region_id[]" options={regions} defaultValue={v.region_id} blank={t('form.none')} />
                <RowInput label={t('form.row', { label: t('dishes.rank'), n: i + 1 })} name="venue_rank[]" type="number" defaultValue={v.rank} />
                <RowInput label={t('form.row', { label: t('dishes.priceText'), n: i + 1 })} name="venue_price_text[]" defaultValue={v.price_text} />
                <RowInput label={t('form.row', { label: t('dishes.noteTh'), n: i + 1 })} name="venue_note_th[]" defaultValue={v.note_th} />
                <RowInput label={t('form.row', { label: t('dishes.noteEn'), n: i + 1 })} name="venue_note_en[]" defaultValue={v.note_en} />
              </div>
            ))}
          </Fieldset>
        </>
      )}
    </AdminForm>
  )
}

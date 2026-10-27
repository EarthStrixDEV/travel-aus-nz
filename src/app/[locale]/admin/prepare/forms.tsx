'use client'

import { useLocale, useTranslations } from 'next-intl'
import { TextField } from '@/components/ui/text-field'
import { MOMENTS, SEASONS } from '@/lib/prepare/data'
import { AdminForm } from '../_lib/admin-form'
import { BilingualField, CheckboxGroup, Fieldset, RowInput, SelectField } from '../_lib/fields'
import { COUNTRIES } from '../_lib/form'
import type { FormValues } from '../_lib/values'
import { saveChecklistTemplate, saveConnectivity, saveContentBlock, savePackingItem, saveRegionMonths } from './actions'
import { MAX_BLOCK_ITEMS, type BlockKey } from './schema'

const BACK = '/admin/prepare'

export function ChecklistForm({ id, values, appliesTo }: { id: number | null; values: FormValues; appliesTo: string[] }) {
  const t = useTranslations('admin')
  return (
    <AdminForm action={(fd) => saveChecklistTemplate(id, fd)} backHref={BACK}>
      {(fe) => (
        <>
          <BilingualField name="title" label={t('fields.title')} values={values} errors={fe} required />
          <BilingualField name="note" label={t('prepare.note')} values={values} errors={fe} />
          <SelectField
            label={t('prepare.moment')}
            name="moment"
            options={MOMENTS.map((m) => ({ value: m, label: t(`prepare.moments.${m}`) }))}
            defaultValue={values.moment}
            error={fe.moment}
          />
          <TextField label={t('fields.slug')} name="slug" defaultValue={values.slug} error={fe.slug} />
          <TextField label={t('fields.sort')} name="sort" defaultValue={values.sort} error={fe.sort} />
          <CheckboxGroup legend={t('prepare.appliesTo')} name="applies_to" options={COUNTRIES.map((c) => ({ value: c, label: c }))} checked={appliesTo} error={fe.applies_to} />
        </>
      )}
    </AdminForm>
  )
}

export function PackingForm({ id, values }: { id: number | null; values: FormValues }) {
  const t = useTranslations('admin')
  return (
    <AdminForm action={(fd) => savePackingItem(id, fd)} backHref={BACK}>
      {(fe) => (
        <>
          <BilingualField name="title" label={t('fields.title')} values={values} errors={fe} required />
          <SelectField
            label={t('fields.season')}
            name="season"
            options={SEASONS.map((s) => ({ value: s, label: t(`seasons.${s}`) }))}
            defaultValue={values.season}
            error={fe.season}
          />
          <TextField label={t('prepare.group')} name="grp" defaultValue={values.grp} error={fe.grp} />
          <TextField label={t('fields.sort')} name="sort" defaultValue={values.sort} error={fe.sort} />
        </>
      )}
    </AdminForm>
  )
}

export function ConnectivityForm({ id, values }: { id: number | null; values: FormValues }) {
  const t = useTranslations('admin')
  return (
    <AdminForm action={(fd) => saveConnectivity(id, fd)} backHref={BACK}>
      {(fe) => (
        <>
          <BilingualField name="name" label={t('fields.name')} values={values} errors={fe} required />
          <BilingualField name="setup" label={t('prepare.setup')} values={values} errors={fe} />
          <BilingualField name="best" label={t('prepare.best')} values={values} errors={fe} />
          <BilingualField name="watch" label={t('prepare.watch')} values={values} errors={fe} />
          <TextField label={t('prepare.cost')} name="cost_text" defaultValue={values.cost_text} error={fe.cost_text} />
          <TextField label={t('fields.verifiedAt')} name="verified_at" type="date" defaultValue={values.verified_at} error={fe.verified_at} />
        </>
      )}
    </AdminForm>
  )
}

export type MonthValues = { comfort: string; crowds: string; recommended: boolean }

export function MonthsForm({ regionId, months }: { regionId: number; months: MonthValues[] }) {
  const t = useTranslations('admin')
  const locale = useLocale()
  const fmt = new Intl.DateTimeFormat(locale, { month: 'short', timeZone: 'UTC' })
  return (
    <AdminForm action={(fd) => saveRegionMonths(regionId, fd)} backHref={BACK}>
      {(fe) => (
        <Fieldset legend={t('prepare.monthsLegend')} error={fe.months}>
          <p className="text-[13px] text-ink-2">{t('prepare.monthsHint')}</p>
          {months.map((m, i) => {
            const month = fmt.format(Date.UTC(2026, i, 1))
            return (
              <div key={i} className="grid grid-cols-[4rem_1fr_1fr_auto] items-end gap-x-4 border-b border-line-2 pb-3">
                <span className="pb-2 text-sm font-medium">{month}</span>
                <RowInput label={t('form.row', { label: t('prepare.comfort'), n: i + 1 })} name="comfort[]" type="number" defaultValue={m.comfort} />
                <RowInput label={t('form.row', { label: t('prepare.crowds'), n: i + 1 })} name="crowds[]" type="number" defaultValue={m.crowds} />
                <label className="flex min-h-11 items-center gap-2 text-[13px] text-ink">
                  <input type="checkbox" name="recommended[]" value={String(i + 1)} defaultChecked={m.recommended} className="size-4 accent-copper" />
                  {t('prepare.recommended')}
                </label>
              </div>
            )
          })}
        </Fieldset>
      )}
    </AdminForm>
  )
}

export type BlockItemValues = Record<'title_th' | 'title_en' | 'text_th' | 'text_en' | 'icon', string>
const EMPTY_ITEM: BlockItemValues = { title_th: '', title_en: '', text_th: '', text_en: '', icon: '' }

export function BlockForm({ blockKey, values, items }: { blockKey: BlockKey; values: FormValues; items: BlockItemValues[] }) {
  const t = useTranslations('admin')
  const itemRows = Array.from({ length: MAX_BLOCK_ITEMS }, (_, i) => items[i] ?? EMPTY_ITEM)
  return (
    <AdminForm action={(fd) => saveContentBlock(blockKey, fd)} backHref={BACK}>
      {(fe) => (
        <>
          <TextField label={t('fields.verifiedAt')} name="verified_at" type="date" defaultValue={values.verified_at} error={fe.verified_at} />
          {blockKey === 'transport_tips' ? (
            <BilingualField name="body" label={t('prepare.body')} values={values} errors={fe} required />
          ) : (
            <Fieldset legend={t('prepare.items')} error={fe.items}>
              <p className="text-[13px] text-ink-2">{t('prepare.itemsHint')}</p>
              {itemRows.map((it, i) => (
                <div key={i} className="grid grid-cols-2 gap-x-4 gap-y-2 border-b border-line-2 pb-3 lg:grid-cols-5">
                  <RowInput label={t('form.row', { label: t('prepare.itemTitleTh'), n: i + 1 })} name="item_title_th[]" defaultValue={it.title_th} />
                  <RowInput label={t('form.row', { label: t('prepare.itemTitleEn'), n: i + 1 })} name="item_title_en[]" defaultValue={it.title_en} />
                  <RowInput label={t('form.row', { label: t('prepare.itemTextTh'), n: i + 1 })} name="item_text_th[]" defaultValue={it.text_th} />
                  <RowInput label={t('form.row', { label: t('prepare.itemTextEn'), n: i + 1 })} name="item_text_en[]" defaultValue={it.text_en} />
                  <RowInput label={t('form.row', { label: t('prepare.icon'), n: i + 1 })} name="item_icon[]" defaultValue={it.icon} />
                </div>
              ))}
            </Fieldset>
          )}
        </>
      )}
    </AdminForm>
  )
}

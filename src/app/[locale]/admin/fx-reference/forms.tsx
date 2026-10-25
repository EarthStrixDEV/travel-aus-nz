'use client'

import { useTranslations } from 'next-intl'
import { TextField } from '@/components/ui/text-field'
import { AdminForm } from '../_lib/admin-form'
import { BilingualField, SelectField } from '../_lib/fields'
import { COUNTRIES } from '../_lib/form'
import type { FormValues } from '../_lib/values'
import { saveBudgetPreset, saveCostItem } from './actions'
import { STYLES } from './schema'

export function CostItemForm({ id, values }: { id: number | null; values: FormValues }) {
  const t = useTranslations('admin')
  return (
    <AdminForm action={(fd) => saveCostItem(id, fd)} backHref="/admin/fx-reference">
      {(fe) => (
        <>
          <BilingualField name="item" label={t('fx.item')} values={values} errors={fe} required />
          <BilingualField name="note" label={t('fx.note')} values={values} errors={fe} />
          <TextField label={t('fx.aud')} name="aud" defaultValue={values.aud} error={fe.aud} />
          <TextField label={t('fx.nzd')} name="nzd" defaultValue={values.nzd} error={fe.nzd} />
          <TextField label={t('fields.verifiedAt')} name="verified_at" type="date" defaultValue={values.verified_at} error={fe.verified_at} required />
          <TextField label={t('fields.sort')} name="sort" defaultValue={values.sort} error={fe.sort} />
        </>
      )}
    </AdminForm>
  )
}

export function PresetForm({ originalKey, values }: { originalKey: string | null; values: FormValues }) {
  const t = useTranslations('admin')
  return (
    <AdminForm action={(fd) => saveBudgetPreset(originalKey, fd)} backHref="/admin/fx-reference">
      {(fe) => (
        <>
          <SelectField
            label={t('fields.country')}
            name="country"
            options={COUNTRIES.map((c) => ({ value: c, label: c }))}
            defaultValue={values.country}
            error={fe.country}
          />
          <SelectField
            label={t('fx.style')}
            name="style"
            options={STYLES.map((s) => ({ value: s, label: t(`fx.styles.${s}`) }))}
            defaultValue={values.style}
            error={fe.style}
          />
          <TextField label={t('fx.perDay')} name="per_day" defaultValue={values.per_day} error={fe.per_day} required />
          <div className="hidden md:block" />
          <BilingualField name="note" label={t('fx.note')} values={values} errors={fe} required />
        </>
      )}
    </AdminForm>
  )
}

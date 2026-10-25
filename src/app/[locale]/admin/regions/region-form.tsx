'use client'

import { useTranslations } from 'next-intl'
import { TextField } from '@/components/ui/text-field'
import { AdminForm } from '../_lib/admin-form'
import { BilingualField, CheckboxGroup, SelectField, type Option } from '../_lib/fields'
import { COUNTRIES, STATUSES } from '../_lib/form'
import type { FormValues } from '../_lib/values'
import { saveRegion } from './actions'

export function RegionForm({
  id,
  values,
  bestMonths,
  months,
  media,
}: {
  id: number | null
  values: FormValues
  bestMonths: string[]
  months: Option[]
  media: Option[]
}) {
  const t = useTranslations('admin')
  return (
    <AdminForm action={(fd) => saveRegion(id, fd)} backHref="/admin/regions">
      {(fe) => (
        <>
          <BilingualField name="name" label={t('fields.name')} values={values} errors={fe} required />
          <TextField label={t('fields.slug')} name="slug" defaultValue={values.slug} error={fe.slug} required />
          <SelectField
            label={t('fields.country')}
            name="country"
            options={COUNTRIES.map((c) => ({ value: c, label: c }))}
            defaultValue={values.country}
            error={fe.country}
          />
          <BilingualField name="state" label={t('fields.state')} values={values} errors={fe} />
          <BilingualField name="lede" label={t('fields.lede')} values={values} errors={fe} />
          <TextField label={t('fields.featuredRank')} name="featured_rank" defaultValue={values.featured_rank} error={fe.featured_rank} />
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
          <CheckboxGroup legend={t('fields.bestMonths')} name="best_months" options={months} checked={bestMonths} error={fe.best_months} />
        </>
      )}
    </AdminForm>
  )
}

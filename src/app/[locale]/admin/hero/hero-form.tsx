'use client'

import { useTranslations } from 'next-intl'
import { TextField } from '@/components/ui/text-field'
import { AdminForm } from '../_lib/admin-form'
import { BilingualField, Checkbox, SelectField, type Option } from '../_lib/fields'
import type { FormValues } from '../_lib/values'
import { saveHeroSlide } from './actions'

export function HeroForm({
  id,
  values,
  options,
}: {
  id: number | null
  values: FormValues
  options: { media: Option[]; places: Option[] }
}) {
  const t = useTranslations('admin')
  return (
    <AdminForm action={(fd) => saveHeroSlide(id, fd)} backHref="/admin/hero">
      {(fe) => (
        <>
          <BilingualField name="caption" label={t('fields.caption')} values={values} errors={fe} required />
          <SelectField
            label={t('fields.photo')}
            name="media_id"
            options={options.media}
            defaultValue={values.media_id}
            blank={t('form.choose')}
            error={fe.media_id}
          />
          <SelectField
            label={t('fields.place')}
            name="place_id"
            options={options.places}
            defaultValue={values.place_id}
            blank={t('form.none')}
            error={fe.place_id}
          />
          <TextField label={t('fields.sort')} name="sort" defaultValue={values.sort} error={fe.sort} />
          <Checkbox label={t('fields.active')} name="active" defaultChecked={values.active === 'true'} />
        </>
      )}
    </AdminForm>
  )
}

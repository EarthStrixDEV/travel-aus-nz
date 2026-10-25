'use client'

import { useTranslations } from 'next-intl'
import { TextField } from '@/components/ui/text-field'
import { AdminForm } from '../_lib/admin-form'
import { BilingualField, SelectField, type Option } from '../_lib/fields'
import { STATUSES } from '../_lib/form'
import type { FormValues } from '../_lib/values'
import { saveGalleryPhoto } from './actions'
import { SEASONS } from './schema'

export function GalleryForm({
  id,
  values,
  options,
}: {
  id: string | null
  values: FormValues
  options: { media: Option[]; places: Option[]; regions: Option[] }
}) {
  const t = useTranslations('admin')
  return (
    <AdminForm action={(fd) => saveGalleryPhoto(id, fd)} backHref="/admin/gallery">
      {(fe) => (
        <>
          <BilingualField name="title" label={t('fields.title')} values={values} errors={fe} required />
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
            blank={t('form.choose')}
            error={fe.place_id}
          />
          <SelectField
            label={t('fields.region')}
            name="region_id"
            options={options.regions}
            defaultValue={values.region_id}
            blank={t('form.none')}
            error={fe.region_id}
          />
          <SelectField
            label={t('fields.season')}
            name="season"
            options={SEASONS.map((s) => ({ value: s, label: t(`seasons.${s}`) }))}
            defaultValue={values.season}
            blank={t('form.none')}
            error={fe.season}
          />
          <TextField label={t('fields.sort')} name="sort" defaultValue={values.sort} error={fe.sort} />
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

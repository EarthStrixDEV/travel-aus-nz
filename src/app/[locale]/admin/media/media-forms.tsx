'use client'

import { useId } from 'react'
import { useTranslations } from 'next-intl'
import { TextField } from '@/components/ui/text-field'
import { AdminForm } from '../_lib/admin-form'
import { BilingualField, type FieldErrors } from '../_lib/fields'
import type { FormValues } from '../_lib/values'
import { saveMedia } from './actions'
import { UPLOAD_TYPES } from './schema'
import { uploadMedia } from './upload'

function AssetFields({ values, fe }: { values: FormValues; fe: FieldErrors }) {
  const t = useTranslations('admin')
  return (
    <>
      <TextField label={t('media.credit')} name="credit" defaultValue={values.credit} error={fe.credit} required />
      <TextField label={t('media.license')} name="license" defaultValue={values.license} error={fe.license} required />
      <BilingualField name="alt" label={t('media.alt')} values={values} errors={fe} required />
    </>
  )
}

function FileField({ error }: { error?: string }) {
  const t = useTranslations('admin.media')
  const id = useId()
  return (
    <div className="flex flex-col gap-1.5 md:col-span-2">
      <label htmlFor={id} className="eyebrow text-ink-2">
        {t('file')}
      </label>
      <input
        id={id}
        name="file"
        type="file"
        accept={UPLOAD_TYPES.join(',')}
        required
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${id}-error` : `${id}-hint`}
        className="text-[15px] text-ink file:mr-4 file:min-h-11 file:cursor-pointer file:rounded-[6px] file:border file:border-line file:bg-transparent file:px-[22px] file:text-sm file:font-medium file:text-ink"
      />
      <p id={`${id}-hint`} className="text-[13px] text-ink-2">
        {t('fileHint')}
      </p>
      {error && (
        <p id={`${id}-error`} className="text-[13px] font-normal text-copper">
          {error}
        </p>
      )}
    </div>
  )
}

export function UploadForm() {
  return (
    <AdminForm action={uploadMedia} backHref="/admin/media">
      {(fe) => (
        <>
          <FileField error={fe.file} />
          <AssetFields values={{}} fe={fe} />
        </>
      )}
    </AdminForm>
  )
}

export function MediaEditForm({ id, values }: { id: string; values: FormValues }) {
  return (
    <AdminForm action={(fd) => saveMedia(id, fd)} backHref="/admin/media">
      {(fe) => <AssetFields values={values} fe={fe} />}
    </AdminForm>
  )
}

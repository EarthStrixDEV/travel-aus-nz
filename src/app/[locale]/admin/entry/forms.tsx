'use client'

import { useTranslations } from 'next-intl'
import { TextField } from '@/components/ui/text-field'
import { AdminForm } from '../_lib/admin-form'
import { BilingualField, Checkbox, SelectField, type Option } from '../_lib/fields'
import { COUNTRIES } from '../_lib/form'
import type { FormValues } from '../_lib/values'
import { saveEntryRule, saveOfficialLink, savePermissionType } from './actions'
import { PURPOSES, STAYS } from './schema'

const countryOptions = COUNTRIES.map((c) => ({ value: c, label: c }))

export function PermissionForm({ id, values, links }: { id: number | null; values: FormValues; links: Option[] }) {
  const t = useTranslations('admin')
  return (
    <AdminForm action={(fd) => savePermissionType(id, fd)} backHref="/admin/entry">
      {(fe) => (
        <>
          <BilingualField name="name" label={t('fields.name')} values={values} errors={fe} required />
          <TextField label={t('fields.slug')} name="slug" defaultValue={values.slug} error={fe.slug} required />
          <SelectField label={t('fields.country')} name="country" options={countryOptions} defaultValue={values.country} error={fe.country} />
          <BilingualField name="plain" label={t('entry.plain')} values={values} errors={fe} />
          <BilingualField name="who" label={t('entry.who')} values={values} errors={fe} />
          <BilingualField name="how" label={t('entry.how')} values={values} errors={fe} />
          <BilingualField name="good" label={t('entry.good')} values={values} errors={fe} />
          <TextField label={t('entry.processing')} name="processing_text" defaultValue={values.processing_text} error={fe.processing_text} />
          <TextField label={t('entry.fee')} name="fee_text" defaultValue={values.fee_text} error={fe.fee_text} />
          <TextField label={t('entry.validity')} name="validity_text" defaultValue={values.validity_text} error={fe.validity_text} />
          <SelectField
            label={t('entry.officialLink')}
            name="official_link_id"
            options={links}
            defaultValue={values.official_link_id}
            blank={t('form.none')}
            error={fe.official_link_id}
          />
          <TextField label={t('fields.verifiedAt')} name="verified_at" type="date" defaultValue={values.verified_at} error={fe.verified_at} />
          <Checkbox label={t('entry.needsReview')} name="needs_review" defaultChecked={values.needs_review === 'true'} />
        </>
      )}
    </AdminForm>
  )
}

export function RuleForm({
  originalKey,
  values,
  permissions,
}: {
  originalKey: string | null
  values: FormValues
  permissions: Option[]
}) {
  const t = useTranslations('admin')
  return (
    <AdminForm action={(fd) => saveEntryRule(originalKey, fd)} backHref="/admin/entry">
      {(fe) => (
        <>
          <TextField label={t('entry.nationality')} name="nationality" defaultValue={values.nationality} error={fe.nationality} required />
          <SelectField label={t('fields.country')} name="country" options={countryOptions} defaultValue={values.country} error={fe.country} />
          <SelectField
            label={t('entry.purpose')}
            name="purpose"
            options={PURPOSES.map((p) => ({ value: p, label: t(`entry.purposes.${p}`) }))}
            defaultValue={values.purpose}
            error={fe.purpose}
          />
          <SelectField
            label={t('entry.stay')}
            name="stay"
            options={STAYS.map((s) => ({ value: s, label: t(`entry.stays.${s}`) }))}
            defaultValue={values.stay}
            error={fe.stay}
          />
          <SelectField
            label={t('entry.permission')}
            name="permission_id"
            options={permissions}
            defaultValue={values.permission_id}
            blank={t('form.none')}
            error={fe.permission_id}
          />
          <TextField label={t('fields.verifiedAt')} name="verified_at" type="date" defaultValue={values.verified_at} error={fe.verified_at} />
          <Checkbox label={t('entry.needsReview')} name="needs_review" defaultChecked={values.needs_review === 'true'} />
        </>
      )}
    </AdminForm>
  )
}

export function LinkForm({ id, values }: { id: number | null; values: FormValues }) {
  const t = useTranslations('admin')
  return (
    <AdminForm action={(fd) => saveOfficialLink(id, fd)} backHref="/admin/entry">
      {(fe) => (
        <>
          <BilingualField name="title" label={t('fields.title')} values={values} errors={fe} required />
          <TextField label={t('entry.url')} name="url" type="url" defaultValue={values.url} error={fe.url} required />
          <TextField label={t('entry.agency')} name="agency" defaultValue={values.agency} error={fe.agency} />
          <SelectField
            label={t('fields.country')}
            name="country"
            options={countryOptions}
            defaultValue={values.country}
            blank={t('form.none')}
            error={fe.country}
          />
        </>
      )}
    </AdminForm>
  )
}

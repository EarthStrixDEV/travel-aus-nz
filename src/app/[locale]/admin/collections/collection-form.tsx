'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { TextField } from '@/components/ui/text-field'
import { AdminForm } from '../_lib/admin-form'
import { BilingualField, Fieldset, RowSelect, SelectField, type Option } from '../_lib/fields'
import { STATUSES } from '../_lib/form'
import type { FormValues } from '../_lib/values'
import { saveCollection } from './actions'
import { COLLECTION_KINDS, MAX_ITEMS } from './schema'

export function CollectionForm({
  id,
  values,
  items,
  entities,
}: {
  id: string | null
  values: FormValues
  items: string[]
  /** Item options per kind: venues, dishes, places. */
  entities: Record<(typeof COLLECTION_KINDS)[number], Option[]>
}) {
  const t = useTranslations('admin')
  const [kind, setKind] = useState(values.kind as (typeof COLLECTION_KINDS)[number])
  // Items of another kind don't belong in the new kind's list.
  const initial = kind === values.kind ? items : []

  return (
    <AdminForm action={(fd) => saveCollection(id, fd)} backHref="/admin/collections">
      {(fe) => (
        <>
          <BilingualField name="title" label={t('fields.title')} values={values} errors={fe} required />
          <TextField label={t('fields.slug')} name="slug" defaultValue={values.slug} error={fe.slug} required />
          <SelectField
            label={t('fields.kind')}
            name="kind"
            options={COLLECTION_KINDS.map((k) => ({ value: k, label: t(`collections.kinds.${k}`) }))}
            defaultValue={values.kind}
            onChange={(v) => setKind(v as (typeof COLLECTION_KINDS)[number])}
            error={fe.kind}
          />
          <TextField label={t('fields.placement')} name="placement" defaultValue={values.placement} error={fe.placement} />
          <BilingualField name="sub" label={t('fields.sub')} values={values} errors={fe} />
          <SelectField
            label={t('fields.status')}
            name="status"
            options={STATUSES.map((s) => ({ value: s, label: t(`status.${s}`) }))}
            defaultValue={values.status}
            error={fe.status}
          />
          <Fieldset legend={t('collections.items')} error={fe.items}>
            <p className="text-[13px] text-ink-2">{t('collections.itemsHint')}</p>
            <div key={kind} className="grid grid-cols-1 gap-x-8 gap-y-3 md:grid-cols-2">
              {Array.from({ length: MAX_ITEMS }, (_, i) => (
                <RowSelect
                  key={i}
                  label={t('collections.position', { n: i + 1 })}
                  name="items[]"
                  options={entities[kind]}
                  defaultValue={initial[i] ?? ''}
                  blank={t('form.none')}
                />
              ))}
            </div>
          </Fieldset>
        </>
      )}
    </AdminForm>
  )
}

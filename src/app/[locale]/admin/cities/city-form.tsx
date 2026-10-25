'use client'

import { useId, useState, useTransition, type FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import { useLocale, useTranslations } from 'next-intl'
import { Button, buttonClass } from '@/components/ui/button'
import { TextField } from '@/components/ui/text-field'
import { Link } from '@/i18n/navigation'
import { saveCity, type SaveCityResult } from './actions'

export type CityFormValues = {
  region_id: string
  slug: string
  name_th: string
  name_en: string
  timezone: string
  lng: string
  lat: string
  status: string
}

type Option = { value: string; label: string }

function SelectField({
  label,
  name,
  options,
  defaultValue,
  error,
}: {
  label: string
  name: string
  options: Option[]
  defaultValue: string
  error?: string
}) {
  const id = useId()
  const errorId = `${id}-error`
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="eyebrow text-ink-2">
        {label}
      </label>
      <select
        id={id}
        name={name}
        defaultValue={defaultValue}
        required
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? errorId : undefined}
        className="h-12 w-full border-0 border-b border-line bg-transparent text-[15px] font-normal text-ink transition-colors duration-500 ease-out hover:border-ink focus:border-ink aria-invalid:border-copper"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value} className="bg-surface text-ink">
            {o.label}
          </option>
        ))}
      </select>
      {error && (
        <p id={errorId} className="text-[13px] font-normal text-copper">
          {error}
        </p>
      )}
    </div>
  )
}

export function CityForm({
  id,
  values,
  regions,
}: {
  id: number | null
  values: CityFormValues
  regions: Option[]
}) {
  const t = useTranslations('admin')
  const locale = useLocale()
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [result, setResult] = useState<SaveCityResult>({})
  const fe = result.fieldErrors ?? {}

  function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const formData = new FormData(e.currentTarget)
    startTransition(async () => {
      const r = await saveCity(id, formData)
      if (r.error || r.fieldErrors) setResult(r)
      else router.push(`/${locale}/admin/cities`)
    })
  }

  return (
    <form onSubmit={onSubmit} noValidate className="mt-8 flex flex-col gap-8">
      <div className="grid grid-cols-1 gap-x-8 gap-y-6 md:grid-cols-2">
        <TextField label={t('cities.nameTh')} name="name_th" defaultValue={values.name_th} error={fe.name_th} required />
        <TextField label={t('cities.nameEn')} name="name_en" defaultValue={values.name_en} error={fe.name_en} required />
        <TextField label={t('cities.slug')} name="slug" defaultValue={values.slug} error={fe.slug} required />
        <SelectField
          label={t('cities.region')}
          name="region_id"
          options={regions}
          defaultValue={values.region_id}
          error={fe.region_id}
        />
        <TextField label={t('cities.timezone')} name="timezone" defaultValue={values.timezone} error={fe.timezone} required />
        <SelectField
          label={t('cities.status')}
          name="status"
          options={(['draft', 'published', 'archived'] as const).map((s) => ({ value: s, label: t(`status.${s}`) }))}
          defaultValue={values.status}
          error={fe.status}
        />
        <TextField label={t('cities.lng')} name="lng" defaultValue={values.lng} error={fe.lng} required />
        <TextField label={t('cities.lat')} name="lat" defaultValue={values.lat} error={fe.lat} required />
      </div>

      <div aria-live="polite">
        {result.error && <p className="text-[13px] font-normal text-copper">{result.error}</p>}
      </div>

      <div className="flex flex-wrap gap-3">
        <Button type="submit" disabled={pending}>
          {pending ? t('cities.saving') : t('cities.save')}
        </Button>
        <Link href="/admin/cities" className={buttonClass('ghost')}>
          {t('cities.cancel')}
        </Link>
      </div>
    </form>
  )
}

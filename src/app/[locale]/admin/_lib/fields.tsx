'use client'

import { useId, type ReactNode } from 'react'
import { useTranslations } from 'next-intl'
import { TextField } from '@/components/ui/text-field'

export type Option = { value: string; label: string }
export type FieldErrors = Record<string, string | undefined>

const control =
  'h-12 w-full border-0 border-b border-line bg-transparent text-[15px] font-normal text-ink transition-colors duration-500 ease-out hover:border-ink focus:border-ink aria-invalid:border-copper'

function FieldError({ id, error }: { id: string; error?: string }) {
  return error ? (
    <p id={id} className="text-[13px] font-normal text-copper">
      {error}
    </p>
  ) : null
}

export function SelectField({
  label,
  name,
  options,
  defaultValue,
  error,
  blank,
  onChange,
}: {
  label: string
  name: string
  options: Option[]
  defaultValue: string
  error?: string
  /** Label of an empty first option, for optional selects. */
  blank?: string
  onChange?: (value: string) => void
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
        required={blank === undefined}
        onChange={onChange ? (e) => onChange(e.target.value) : undefined}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? errorId : undefined}
        className={control}
      >
        {blank !== undefined && (
          <option value="" className="bg-surface text-ink">
            {blank}
          </option>
        )}
        {options.map((o) => (
          <option key={o.value} value={o.value} className="bg-surface text-ink">
            {o.label}
          </option>
        ))}
      </select>
      <FieldError id={errorId} error={error} />
    </div>
  )
}

/** Thai + English inputs for one `*_i18n` field, side by side in the 2-col form grid. */
export function BilingualField({
  name,
  label,
  values,
  errors,
  required,
}: {
  name: string
  label: string
  values: Record<string, string>
  errors: FieldErrors
  required?: boolean
}) {
  const t = useTranslations('admin.form')
  return (
    <>
      {(['th', 'en'] as const).map((lang) => (
        <TextField
          key={lang}
          label={t(lang, { label })}
          name={`${name}_${lang}`}
          defaultValue={values[`${name}_${lang}`] ?? ''}
          error={errors[`${name}_${lang}`]}
          required={required}
        />
      ))}
    </>
  )
}

export function Checkbox({ label, name, defaultChecked }: { label: string; name: string; defaultChecked: boolean }) {
  return (
    <label className="flex min-h-11 items-center gap-2.5 text-[15px] text-ink">
      <input type="checkbox" name={name} defaultChecked={defaultChecked} className="size-4 accent-copper" />
      {label}
    </label>
  )
}

/** Multi-select as checkboxes posted as `name[]`. Spans both grid columns. */
export function CheckboxGroup({
  legend,
  name,
  options,
  checked,
  error,
}: {
  legend: string
  name: string
  options: Option[]
  checked: string[]
  error?: string
}) {
  const id = useId()
  return (
    <Fieldset legend={legend} error={error} errorId={`${id}-error`}>
      <div className="flex flex-wrap gap-x-6">
        {options.map((o) => (
          <label key={o.value} className="flex min-h-11 items-center gap-2 text-[15px] text-ink">
            <input
              type="checkbox"
              name={`${name}[]`}
              value={o.value}
              defaultChecked={checked.includes(o.value)}
              className="size-4 accent-copper"
            />
            {o.label}
          </label>
        ))}
      </div>
    </Fieldset>
  )
}

/** Full-width group (sub-forms, repeating rows) with its error under the legend. */
export function Fieldset({
  legend,
  error,
  errorId,
  children,
}: {
  legend: string
  error?: string
  errorId?: string
  children: ReactNode
}) {
  const fallbackId = useId()
  const eid = errorId ?? `${fallbackId}-error`
  return (
    <fieldset className="md:col-span-2 flex flex-col gap-3 border-t border-line-2 pt-5" aria-describedby={error ? eid : undefined}>
      <legend className="eyebrow float-left text-ink-2">{legend}</legend>
      <FieldError id={eid} error={error} />
      {children}
    </fieldset>
  )
}

/** Inputs for one cell of a repeating row: posted as `${prefix}_${field}[]`. */
export function RowInput({
  label,
  name,
  defaultValue,
  type = 'text',
}: {
  label: string
  name: string
  defaultValue: string
  type?: 'text' | 'time' | 'number'
}) {
  const id = useId()
  return (
    <div className="flex min-w-0 flex-col gap-1">
      <label htmlFor={id} className="text-xs text-ink-2">
        {label}
      </label>
      <input id={id} name={name} type={type} defaultValue={defaultValue} className={`${control} h-10`} />
    </div>
  )
}

export function RowSelect({
  label,
  name,
  options,
  defaultValue,
  blank,
}: {
  label: string
  name: string
  options: Option[]
  defaultValue: string
  blank: string
}) {
  const id = useId()
  return (
    <div className="flex min-w-0 flex-col gap-1">
      <label htmlFor={id} className="text-xs text-ink-2">
        {label}
      </label>
      <select id={id} name={name} defaultValue={defaultValue} className={`${control} h-10`}>
        <option value="">{blank}</option>
        {options.map((o) => (
          <option key={o.value} value={o.value} className="bg-surface text-ink">
            {o.label}
          </option>
        ))}
      </select>
    </div>
  )
}

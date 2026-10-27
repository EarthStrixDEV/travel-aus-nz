import { useId } from 'react'

type TextFieldProps = {
  label: string
  name: string
  type?: 'text' | 'email' | 'password' | 'date' | 'url' | 'time'
  defaultValue?: string
  error?: string
  required?: boolean
  placeholder?: string
  maxLength?: number
  /** Id of a hint element outside the field (joined with the error id when both apply). */
  describedBy?: string
}

export function TextField({ label, name, type = 'text', defaultValue, error, required, placeholder, maxLength, describedBy }: TextFieldProps) {
  const id = useId()
  const errorId = `${id}-error`
  const described = [error ? errorId : null, describedBy].filter(Boolean).join(' ') || undefined
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="eyebrow text-ink-2">
        {label}
      </label>
      <input
        id={id}
        name={name}
        type={type}
        defaultValue={defaultValue}
        required={required}
        placeholder={placeholder}
        maxLength={maxLength}
        aria-invalid={error ? true : undefined}
        aria-describedby={described}
        className="h-12 w-full border-0 border-b border-line bg-transparent text-[15px] font-normal text-ink transition-colors duration-500 ease-out placeholder:text-ink-2 hover:border-ink focus:border-ink aria-invalid:border-copper"
      />
      {error && (
        <p id={errorId} className="text-[13px] font-normal text-copper">
          {error}
        </p>
      )}
    </div>
  )
}

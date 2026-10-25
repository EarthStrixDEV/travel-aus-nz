import { useId } from 'react'

type TextFieldProps = {
  label: string
  name: string
  type?: 'text' | 'email' | 'password'
  defaultValue?: string
  error?: string
  required?: boolean
}

export function TextField({ label, name, type = 'text', defaultValue, error, required }: TextFieldProps) {
  const id = useId()
  const errorId = `${id}-error`
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
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? errorId : undefined}
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

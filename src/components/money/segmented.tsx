'use client'

type Option<T extends string> = { value: T; label: string }

/** Pill-shaped toggle group (design `.seg`): one pressed button at a time. */
export function Segmented<T extends string>({
  label,
  value,
  options,
  onChange,
  className = '',
}: {
  label: string
  value: T
  options: Option<T>[]
  onChange: (value: T) => void
  className?: string
}) {
  return (
    <div role="group" aria-label={label} className={`inline-flex rounded-full border border-line p-0.5 md:p-[3px] ${className}`}>
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          aria-pressed={o.value === value}
          onClick={() => onChange(o.value)}
          className={`min-h-9 cursor-pointer rounded-full px-3 text-xs font-medium transition-colors duration-500 ease-out md:min-h-10 md:px-[18px] md:text-[13px] ${
            o.value === value ? 'bg-ink text-bg' : 'text-ink-2 hover:text-ink'
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

import type { ComponentProps } from 'react'

export type ButtonVariant = 'primary' | 'ghost'

const base =
  'inline-flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-[6px] border px-[22px] text-sm font-medium transition-[background-color,color,border-color,filter] duration-500 ease-out disabled:cursor-not-allowed disabled:opacity-60'

const variants: Record<ButtonVariant, string> = {
  primary: 'border-transparent bg-copper text-on-copper hover:brightness-107',
  ghost: 'border-line bg-transparent text-ink hover:border-ink',
}

/** Button styling for non-button elements, e.g. a `Link`. */
export function buttonClass(variant: ButtonVariant): string {
  return `${base} ${variants[variant]}`
}

export function Button({
  variant = 'primary',
  type = 'button',
  className,
  ...props
}: ComponentProps<'button'> & { variant?: ButtonVariant }) {
  return <button type={type} className={className ? `${buttonClass(variant)} ${className}` : buttonClass(variant)} {...props} />
}

/** 44×44 round icon button; `label` becomes the accessible name. */
export function IconButton({
  label,
  type = 'button',
  className,
  ...props
}: Omit<ComponentProps<'button'>, 'aria-label'> & { label: string }) {
  const cls =
    'inline-flex size-11 shrink-0 cursor-pointer items-center justify-center rounded-full border border-line bg-transparent text-ink transition-colors duration-500 ease-out hover:border-ink'
  return <button type={type} aria-label={label} className={className ? `${cls} ${className}` : cls} {...props} />
}

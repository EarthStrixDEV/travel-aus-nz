'use client'

import { useState, useTransition, type FormEvent, type ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import { useLocale, useTranslations } from 'next-intl'
import { Button, buttonClass } from '@/components/ui/button'
import { Link } from '@/i18n/navigation'
import type { FieldErrors } from './fields'
import type { SaveResult } from './form'

/**
 * The submit / pending / error / redirect shell shared by every entity form (same behaviour
 * as the cities form): fields render through `children(fieldErrors)`, the save error is
 * announced in an aria-live region, success returns to `backHref`.
 */
export function AdminForm({
  action,
  backHref,
  children,
}: {
  action: (formData: FormData) => Promise<SaveResult>
  backHref: string
  children: (errors: FieldErrors) => ReactNode
}) {
  const t = useTranslations('admin.form')
  const locale = useLocale()
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [result, setResult] = useState<SaveResult>({})

  function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const formData = new FormData(e.currentTarget)
    startTransition(async () => {
      const r = await action(formData)
      if (r.error || r.fieldErrors) setResult(r)
      else router.push(`/${locale}${backHref}`)
    })
  }

  const hasFieldErrors = Object.keys(result.fieldErrors ?? {}).length > 0

  return (
    <form onSubmit={onSubmit} noValidate className="mt-8 flex flex-col gap-8">
      <div className="grid grid-cols-1 gap-x-8 gap-y-6 md:grid-cols-2">{children(result.fieldErrors ?? {})}</div>

      <div aria-live="polite">
        {(result.error || hasFieldErrors) && (
          <p className="text-[13px] font-normal text-copper">{result.error ?? t('fixErrors')}</p>
        )}
      </div>

      <div className="flex flex-wrap gap-3">
        <Button type="submit" disabled={pending}>
          {pending ? t('saving') : t('save')}
        </Button>
        <Link href={backHref} className={buttonClass('ghost')}>
          {t('cancel')}
        </Link>
      </div>
    </form>
  )
}

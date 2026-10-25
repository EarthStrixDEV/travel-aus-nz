'use client'

import { useSearchParams } from 'next/navigation'
import { useLocale, useTranslations } from 'next-intl'
import { Suspense } from 'react'
import { Link, usePathname } from '@/i18n/navigation'
import { routing } from '@/i18n/routing'

/**
 * TH | EN segmented switch; keeps the current path and query string.
 * useSearchParams needs a Suspense boundary to keep pages static; the fallback
 * (prerendered HTML) links without the query until the client hydrates.
 */
export function LocaleSwitch() {
  return (
    <Suspense fallback={<Switch search="" />}>
      <SwitchWithSearch />
    </Suspense>
  )
}

function SwitchWithSearch() {
  return <Switch search={useSearchParams().toString()} />
}

function Switch({ search }: { search: string }) {
  const t = useTranslations('locale')
  const current = useLocale()
  const pathname = usePathname()
  const href = search ? `${pathname}?${search}` : pathname
  return (
    <div role="group" aria-label={t('label')} className="inline-flex rounded-full border border-line">
      {routing.locales.map((locale) => {
        const on = locale === current
        return (
          <Link
            key={locale}
            href={href}
            locale={locale}
            lang={locale}
            aria-current={on ? 'true' : undefined}
            className={`inline-flex min-h-[42px] min-w-11 items-center justify-center rounded-full px-3.5 text-[13px] font-medium transition-colors duration-[600ms] ease-out ${
              on ? 'bg-ink text-bg' : 'text-ink-2 hover:text-ink'
            }`}
          >
            {t(`code.${locale}`)}
            {/* Accessible name keeps the visible code first (WCAG 2.5.3), then the full language name. */}
            <span className="sr-only"> – {t(locale)}</span>
          </Link>
        )
      })}
    </div>
  )
}

'use client'

import { useLocale, useTranslations } from 'next-intl'
import { Link, usePathname } from '@/i18n/navigation'
import { routing } from '@/i18n/routing'

/** TH | EN segmented switch; keeps the current path. */
export function LocaleSwitch() {
  const t = useTranslations('locale')
  const current = useLocale()
  const pathname = usePathname()
  return (
    <div role="group" aria-label={t('label')} className="inline-flex rounded-full border border-line">
      {routing.locales.map((locale) => {
        const on = locale === current
        return (
          <Link
            key={locale}
            href={pathname}
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

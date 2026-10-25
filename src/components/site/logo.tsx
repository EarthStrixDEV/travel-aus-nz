import { useTranslations } from 'next-intl'
import { Link } from '@/i18n/navigation'

/** Compass mark + wordmark, linking home. Smaller below `lg` per HomeMobile. */
export function Logo() {
  const t = useTranslations('common')
  return (
    <Link href="/" className="flex min-h-11 items-center gap-2 text-ink lg:gap-2.5">
      <svg className="size-[22px] lg:size-[26px]" viewBox="0 0 26 26" fill="none" stroke="currentColor" strokeWidth="1.2" aria-hidden="true">
        <circle cx="13" cy="13" r="11.5" />
        <path d="M13 4.5 L15.4 13 L13 21.5 L10.6 13 Z" />
        <path d="M13 4.5 L15.4 13 L10.6 13 Z" fill="currentColor" />
      </svg>
      <span className="text-[13px] font-semibold tracking-[.02em] lg:text-base">{t('siteName')}</span>
    </Link>
  )
}

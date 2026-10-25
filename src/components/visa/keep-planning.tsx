import { useTranslations } from 'next-intl'
import { Link } from '@/i18n/navigation'

const ITEMS = [
  { key: 'prepare', href: '/prepare', icon: 'M9 11l3 3 8-8M20 12v7a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h9' },
  { key: 'money', href: '/money', icon: 'M4 8h16M16 4l4 4-4 4M20 16H4M8 12l-4 4 4 4' },
  { key: 'transport', href: '/transport', icon: 'M6 6a3 3 0 0 1 3-3h6a3 3 0 0 1 3 3v7a3 3 0 0 1-3 3H9a3 3 0 0 1-3-3zM6 10h12M9 20l1.5-4M15 20l-1.5-4' },
] as const

export function KeepPlanning() {
  const t = useTranslations('visa.keep')
  return (
    <section aria-label={t('label')} className="mt-24 md:mt-[120px] print:hidden">
      <p className="eyebrow mb-6 text-copper">{t('eyebrow')}</p>
      <div className="grid grid-cols-1 gap-5 md:grid-cols-3">
        {ITEMS.map(({ key, href, icon }) => (
          <Link key={key} href={href} className="flex flex-col gap-3 rounded-[10px] border border-line p-7 text-ink transition-colors duration-500 hover:border-ink">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.3" aria-hidden="true">
              <path d={icon} />
            </svg>
            <span className="text-xl font-semibold">{t(`${key}.title`)}</span>
            <span className="text-sm leading-[1.6] text-ink-2">{t(`${key}.text`)}</span>
            <span className="text-sm font-medium text-copper">{t(`${key}.cta`)}</span>
          </Link>
        ))}
      </div>
      <p className="mt-12 rounded-lg border border-line px-[22px] py-[18px] text-[13px] leading-[1.7] text-ink-2">{t('notice')}</p>
    </section>
  )
}

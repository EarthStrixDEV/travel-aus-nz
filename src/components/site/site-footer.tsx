import { useTranslations } from 'next-intl'
import { Link } from '@/i18n/navigation'
import type { NavKey } from './nav-items'

const columns: { heading: 'explore' | 'plan'; links: { key: NavKey; href: string }[] }[] = [
  {
    heading: 'explore',
    links: [
      { key: 'map', href: '/map' },
      { key: 'dishes', href: '/dishes' },
    ],
  },
  {
    heading: 'plan',
    links: [
      { key: 'currency', href: '/currency' },
      { key: 'visa', href: '/visa' },
      { key: 'prepare', href: '/prepare' },
    ],
  },
]

export function SiteFooter() {
  const t = useTranslations()
  return (
    <footer className="mt-24 bg-deep text-on-deep lg:mt-40">
      <div className="mx-auto flex max-w-[1440px] flex-wrap gap-12 px-[clamp(16px,4vw,56px)] py-14">
        <div className="flex flex-[2_1_320px] flex-col gap-3.5">
          <span className="text-[15px] font-semibold tracking-[.02em]">{t('common.siteName')}</span>
          <p className="max-w-[420px] text-[13px] leading-[1.7] text-on-deep/72">{t('footer.acknowledgement')}</p>
        </div>
        {columns.map((col) => (
          <div key={col.heading} className="flex flex-[1_1_160px] flex-col gap-1">
            <h2 className="eyebrow mb-2 text-on-deep/72">{t(`footer.${col.heading}`)}</h2>
            <ul className="flex flex-col">
              {col.links.map((link) => (
                <li key={link.key}>
                  <Link
                    href={link.href}
                    className="inline-flex min-h-11 items-center text-sm text-on-deep/78 transition-colors duration-500 ease-out hover:text-on-deep"
                  >
                    {t(`nav.${link.key}`)}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <div className="border-t border-on-deep/14">
        <div className="mx-auto flex max-w-[1440px] flex-wrap justify-between gap-3 px-[clamp(16px,4vw,56px)] pt-5 pb-8 text-xs text-on-deep/60">
          <span>{t('footer.copyright')}</span>
          <span>{t('footer.prices')}</span>
        </div>
      </div>
    </footer>
  )
}

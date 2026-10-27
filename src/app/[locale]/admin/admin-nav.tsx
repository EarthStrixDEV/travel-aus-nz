'use client'

import { useTranslations } from 'next-intl'
import { Link, usePathname } from '@/i18n/navigation'

const items = [
  { href: '/admin/regions', key: 'navRegions' },
  { href: '/admin/cities', key: 'navCities' },
  { href: '/admin/places', key: 'navPlaces' },
  { href: '/admin/gallery', key: 'navGallery' },
  { href: '/admin/hero', key: 'navHero' },
  { href: '/admin/journeys', key: 'navJourneys' },
  { href: '/admin/collections', key: 'navCollections' },
  { href: '/admin/dishes', key: 'navDishes' },
  { href: '/admin/transit', key: 'navTransit' },
  { href: '/admin/prepare', key: 'navPrepare' },
  { href: '/admin/entry', key: 'navEntry' },
  { href: '/admin/fx-reference', key: 'navFx' },
  { href: '/admin/media', key: 'navMedia' },
  { href: '/admin/review', key: 'navReview' },
  { href: '/admin/audit', key: 'navAudit' },
] as const

export function AdminNav() {
  const t = useTranslations('admin')
  const pathname = usePathname()
  return (
    <nav aria-label={t('navLabel')}>
      <ul className="flex flex-wrap gap-x-5">
        {items.map((item) => {
          const active = pathname === item.href || pathname.startsWith(`${item.href}/`)
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                aria-current={active ? 'page' : undefined}
                className="inline-flex min-h-11 items-center text-sm font-medium whitespace-nowrap text-ink transition-colors duration-500 ease-out hover:text-copper aria-[current=page]:text-copper"
              >
                {t(item.key)}
              </Link>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}

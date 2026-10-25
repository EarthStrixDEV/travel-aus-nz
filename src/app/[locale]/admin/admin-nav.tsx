'use client'

import { useTranslations } from 'next-intl'
import { Link, usePathname } from '@/i18n/navigation'

const items = [
  { href: '/admin/cities', key: 'navCities' },
  { href: '/admin/audit', key: 'navAudit' },
] as const

export function AdminNav() {
  const t = useTranslations('admin')
  const pathname = usePathname()
  return (
    <nav aria-label={t('navLabel')}>
      <ul className="flex gap-5">
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

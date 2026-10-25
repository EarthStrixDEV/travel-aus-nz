'use client'

import type { ReactNode } from 'react'
import { useTranslations } from 'next-intl'
import { usePathname } from '@/i18n/navigation'
import { GatedLink } from './gated-link'
import { isActive, tabItems, type TabKey } from './nav-items'

// Paths from HomeMobile.dc.html.
const icons: Record<TabKey, ReactNode> = {
  discover: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 5l2 7-2 7-2-7z" />
    </>
  ),
  map: (
    <>
      <path d="M9 4L3 6v14l6-2 6 2 6-2V4l-6 2z" />
      <path d="M9 4v14M15 6v14" />
    </>
  ),
  transit: (
    <>
      <rect x="6" y="3" width="12" height="13" rx="3" />
      <path d="M6 10h12M9 20l1.5-4M15 20l-1.5-4" />
    </>
  ),
  eat: <path d="M7 3v18M5 3v5a2 2 0 0 0 4 0V3M17 21V3c-2 1-3.5 3-3.5 7v3H17" />,
  trip: <path d="M6 3h12v18l-6-4-6 4z" />,
}

export function MobileTabBar() {
  const t = useTranslations('nav')
  const pathname = usePathname()
  return (
    <nav
      aria-label={t('tabBarLabel')}
      className="sticky bottom-0 z-20 border-t border-line-2 bg-bg pb-[env(safe-area-inset-bottom)] lg:hidden"
    >
      <ul className="flex h-[72px] justify-around">
        {tabItems.map((item) => (
          <li key={item.key} className="flex">
            <GatedLink
              href={item.href}
              aria-current={isActive(pathname, item.href) ? 'page' : undefined}
              className="flex min-w-14 flex-col items-center gap-1 pt-2.5 text-[10px] font-medium tracking-[.06em] text-ink-2 transition-colors duration-500 ease-out aria-[current=page]:text-copper"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" aria-hidden="true">
                {icons[item.key]}
              </svg>
              {t(`tab.${item.key}`)}
            </GatedLink>
          </li>
        ))}
      </ul>
    </nav>
  )
}

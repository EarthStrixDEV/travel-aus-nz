'use client'

import { useTranslations } from 'next-intl'
import { usePathname } from '@/i18n/navigation'
import { buttonClass } from '@/components/ui/button'
import { isActive, navItems } from './nav-items'
import { AccountMenu } from './account-menu'
import { GatedLink } from './gated-link'
import { Logo } from './logo'
import { LocaleSwitch } from './locale-switch'
import { MobileMenu } from './mobile-menu'
import { ThemeToggle } from './theme-toggle'

export function SiteHeader() {
  const t = useTranslations('nav')
  const pathname = usePathname()
  return (
    <header className="sticky top-0 z-20 border-b border-line-2 bg-bg">
      <div className="mx-auto flex max-w-[1440px] items-center justify-between gap-4 px-[clamp(16px,4vw,56px)] py-2.5 lg:justify-start lg:py-3.5 xl:gap-8">
        <Logo />
        <nav aria-label={t('label')} className="hidden flex-1 lg:block">
          <ul className="flex gap-5 xl:gap-7">
            {navItems.map((item) => (
              <li key={item.key}>
                <GatedLink
                  href={item.href}
                  aria-current={isActive(pathname, item.href) ? 'page' : undefined}
                  className="inline-flex min-h-11 items-center text-sm font-medium whitespace-nowrap text-ink transition-colors duration-500 ease-out hover:text-copper aria-[current=page]:text-copper"
                >
                  {t(item.key)}
                </GatedLink>
              </li>
            ))}
          </ul>
        </nav>
        <div className="hidden items-center gap-2.5 lg:flex">
          <LocaleSwitch />
          <ThemeToggle />
          <GatedLink href="/prepare" className={`${buttonClass('ghost')} whitespace-nowrap`}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" aria-hidden="true">
              <path d="M6 3h12v18l-6-4-6 4z" />
            </svg>
            {t('myTrip')}
          </GatedLink>
          <AccountMenu />
        </div>
        <div className="lg:hidden">
          <MobileMenu />
        </div>
      </div>
    </header>
  )
}

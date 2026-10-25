'use client'

import { useRef } from 'react'
import { useTranslations } from 'next-intl'
import { usePathname } from '@/i18n/navigation'
import { IconButton } from '@/components/ui/button'
import { isActive, navItems } from './nav-items'
import { AccountMenu } from './account-menu'
import { GatedLink } from './gated-link'
import { LocaleSwitch } from './locale-switch'
import { ThemeToggle } from './theme-toggle'

/** Below `lg`: menu button opening a native modal <dialog> (Esc closes natively). */
export function MobileMenu() {
  const t = useTranslations()
  const pathname = usePathname()
  const triggerRef = useRef<HTMLButtonElement>(null)
  const dialogRef = useRef<HTMLDialogElement>(null)

  const close = () => dialogRef.current?.close()

  return (
    <>
      <IconButton
        ref={triggerRef}
        label={t('menu.open')}
        aria-haspopup="dialog"
        onClick={() => dialogRef.current?.showModal()}
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" aria-hidden="true">
          <path d="M4 8h16M4 16h16" />
        </svg>
      </IconButton>
      <dialog
        ref={dialogRef}
        aria-label={t('menu.label')}
        onClose={() => triggerRef.current?.focus()}
        className="m-0 h-dvh max-h-none w-full max-w-none flex-col gap-8 bg-bg px-[clamp(16px,4vw,56px)] pb-10 text-ink open:flex backdrop:bg-deep/40"
      >
        <div className="flex h-16 shrink-0 items-center justify-end border-b border-line-2">
          <IconButton label={t('menu.close')} onClick={close}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" aria-hidden="true">
              <path d="M6 6l12 12M18 6L6 18" />
            </svg>
          </IconButton>
        </div>
        <nav aria-label={t('menu.label')}>
          <ul className="flex flex-col">
            {navItems.map((item) => (
              <li key={item.key} className="border-b border-line-2">
                <GatedLink
                  href={item.href}
                  onClick={close}
                  aria-current={isActive(pathname, item.href) ? 'page' : undefined}
                  className="flex min-h-14 items-center text-lg font-medium transition-colors duration-500 ease-out hover:text-copper aria-[current=page]:text-copper"
                >
                  {t(`nav.${item.key}`)}
                </GatedLink>
              </li>
            ))}
          </ul>
        </nav>
        <AccountMenu inline />
        <div className="flex items-center gap-3">
          <LocaleSwitch />
          <ThemeToggle />
        </div>
      </dialog>
    </>
  )
}

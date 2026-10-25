'use client'

import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { IconButton } from '@/components/ui/button'
import { THEME_COOKIE } from '@/lib/theme'

const ONE_YEAR = 60 * 60 * 24 * 365

export function ThemeToggle() {
  const t = useTranslations('theme')
  const router = useRouter()

  function toggle() {
    const root = document.documentElement
    const isDark =
      root.classList.contains('dark') ||
      (!root.classList.contains('light') && window.matchMedia('(prefers-color-scheme: dark)').matches)
    const next = isDark ? 'light' : 'dark'
    root.classList.remove('light', 'dark')
    root.classList.add(next)
    document.cookie = `${THEME_COOKIE}=${next}; Max-Age=${ONE_YEAR}; Path=/; SameSite=Lax`
    // Re-render server components so React's <html className> matches the cookie;
    // otherwise a cached RSC payload (e.g. on Back) restores the old class.
    router.refresh()
  }

  return (
    <IconButton label={t('toggle')} onClick={toggle}>
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" aria-hidden="true">
        <path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z" />
      </svg>
    </IconButton>
  )
}

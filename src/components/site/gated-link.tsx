'use client'

import type { ComponentProps, MouseEvent } from 'react'
import { Link } from '@/i18n/navigation'
import { useAuth } from '@/components/auth/auth-provider'
import { useRequireLogin } from '@/components/auth/use-require-login'
import { isGatedPath } from '@/lib/auth/gated'

/**
 * A real link. For a gated destination a known guest gets the login dialog instead of
 * navigating; signed-in users, not-yet-known sessions, no-JS and new-tab clicks follow the
 * link (the server redirects an actual guest to login with `next`).
 */
export function GatedLink({ href, onClick, ...props }: ComponentProps<typeof Link> & { href: string }) {
  const { user, ready } = useAuth()
  const requireLogin = useRequireLogin()

  function handleClick(e: MouseEvent<HTMLAnchorElement>) {
    onClick?.(e)
    if (e.defaultPrevented || !isGatedPath(href) || !ready || user) return
    if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return
    e.preventDefault()
    requireLogin(() => {}) // guest: opens the dialog; the no-op is never run
  }

  return <Link href={href} onClick={handleClick} {...props} />
}

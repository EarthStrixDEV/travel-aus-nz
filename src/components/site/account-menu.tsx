'use client'

import { Suspense, useEffect, useId, useRef, useState, type KeyboardEvent } from 'react'
import { usePathname, useSearchParams } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { Link } from '@/i18n/navigation'
import { Button, buttonClass, IconButton } from '@/components/ui/button'
import { useAuth } from '@/components/auth/auth-provider'
import { createClient } from '@/lib/supabase/browser'
import { loginHref } from '@/lib/auth/login-href'

type Role = 'user' | 'editor' | 'admin'

/**
 * Header account entry. Until the session is known it is an empty fixed-size placeholder
 * (no "Sign in" flash, no layout shift). `inline` lists the items directly (used inside the
 * mobile menu dialog) instead of a popover.
 */
export function AccountMenu({ inline = false }: { inline?: boolean }) {
  // useSearchParams needs Suspense to keep pages static; the fallback is the same placeholder.
  return (
    <Suspense fallback={<Placeholder inline={inline} />}>
      <AccountMenuInner inline={inline} />
    </Suspense>
  )
}

function Placeholder({ inline }: { inline: boolean }) {
  return <span aria-hidden="true" className={inline ? 'block h-11 w-24' : 'block h-11 w-[104px]'} />
}

function AccountMenuInner({ inline }: { inline: boolean }) {
  const t = useTranslations('account')
  const { user, ready } = useAuth()
  const pathname = usePathname()
  const search = useSearchParams().toString()

  if (!ready) return <Placeholder inline={inline} />
  if (!user) {
    return (
      <Link href={loginHref(pathname, search)} className={`${buttonClass('ghost')} whitespace-nowrap`}>
        {t('signIn')}
      </Link>
    )
  }
  return inline ? (
    <div className="flex flex-col gap-3">
      <AccountItems email={user.email ?? ''} userId={user.id} />
    </div>
  ) : (
    <Popover email={user.email ?? ''} userId={user.id} />
  )
}

function Popover({ email, userId }: { email: string; userId: string }) {
  const t = useTranslations('account')
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const panelId = useId()

  useEffect(() => {
    if (!open) return
    const onPointerDown = (e: Event) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('pointerdown', onPointerDown)
    return () => document.removeEventListener('pointerdown', onPointerDown)
  }, [open])

  function onKeyDown(e: KeyboardEvent) {
    if (e.key !== 'Escape' || !open) return
    setOpen(false)
    triggerRef.current?.focus()
  }

  return (
    <div
      ref={rootRef}
      className="relative"
      onKeyDown={onKeyDown}
      onBlur={(e) => {
        // Keyboard users tabbing out of the open menu close it.
        if (open && e.relatedTarget && !rootRef.current?.contains(e.relatedTarget as Node)) setOpen(false)
      }}
    >
      <IconButton
        ref={triggerRef}
        label={t('menu')}
        aria-expanded={open}
        aria-controls={open ? panelId : undefined}
        onClick={() => setOpen((v) => !v)}
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" aria-hidden="true">
          <circle cx="12" cy="8" r="4" />
          <path d="M4 21c0-4.4 3.6-7 8-7s8 2.6 8 7" />
        </svg>
      </IconButton>
      {open && (
        <div
          id={panelId}
          className="absolute top-[calc(100%+8px)] right-0 z-30 flex w-64 flex-col gap-3 rounded-[10px] border border-line bg-surface p-4 shadow-soft"
        >
          <AccountItems email={email} userId={userId} />
        </div>
      )}
    </div>
  )
}

/** Mounted only while visible (open popover / inline list), so the role is fetched on demand. */
function AccountItems({ email, userId }: { email: string; userId: string }) {
  const t = useTranslations('account')
  const role = useRole(userId)
  const canAdmin = role === 'editor' || role === 'admin'
  return (
    <>
      <p className="truncate text-sm text-ink-2" title={email}>
        {email}
      </p>
      {canAdmin && (
        <Link href="/admin" className={`${buttonClass('ghost')} w-full`}>
          {t('admin')}
        </Link>
      )}
      {/* POST only: a GET sign-out could be triggered cross-site. */}
      <form method="post" action="/auth/sign-out">
        <Button type="submit" variant="ghost" className="w-full">
          {t('signOut')}
        </Button>
      </form>
    </>
  )
}

/** Own profile role via the browser client (`profile_select_self` RLS); null until known. */
function useRole(userId: string): Role | null {
  const [role, setRole] = useState<Role | null>(null)
  useEffect(() => {
    let active = true
    createClient()
      .from('profiles')
      .select('role')
      .eq('id', userId)
      .maybeSingle()
      .then(({ data }) => {
        if (active) setRole((data?.role as Role | undefined) ?? 'user')
      })
    return () => {
      active = false
    }
  }, [userId])
  return role
}

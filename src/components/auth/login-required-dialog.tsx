'use client'

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { usePathname } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { Link } from '@/i18n/navigation'
import { Button, buttonClass } from '@/components/ui/button'
import { loginHref } from '@/lib/auth/login-href'

type Gate = { open: () => void }

const GateContext = createContext<Gate>({ open: () => {} })

/** Opens the single login dialog; use `useRequireLogin` rather than calling this directly. */
export function useLoginGate(): Gate {
  return useContext(GateContext)
}

/**
 * Mounts the one `LoginRequiredDialog` for the whole site and exposes `open` through context.
 * The sign-in `next` is read from the live URL when the dialog opens, so no `useSearchParams`
 * (and no Suspense) is needed and static rendering is untouched.
 */
export function LoginRequiredDialogProvider({ children }: { children: ReactNode }) {
  const t = useTranslations('gate')
  const dialogRef = useRef<HTMLDialogElement>(null)
  const triggerRef = useRef<HTMLElement | null>(null)
  const closedByNavigation = useRef(false)
  const pathname = usePathname()
  const [href, setHref] = useState(() => loginHref('/', ''))

  const open = useCallback(() => {
    triggerRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null
    setHref(loginHref(window.location.pathname, window.location.search))
    dialogRef.current?.showModal()
  }, [])
  // The provider lives in the (site) layout and survives navigation (e.g. to /login), so close
  // the modal when the route changes; focus then stays where the new page puts it.
  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog?.open) return
    closedByNavigation.current = true
    dialog.close()
  }, [pathname])

  const gate = useMemo<Gate>(() => ({ open }), [open])

  return (
    <GateContext value={gate}>
      {children}
      <dialog
        ref={dialogRef}
        aria-labelledby="gate-title"
        aria-describedby="gate-body"
        onClose={() => {
          if (closedByNavigation.current) closedByNavigation.current = false
          else triggerRef.current?.focus()
        }}
        className="m-auto w-[min(92vw,420px)] rounded-[10px] border border-line bg-surface p-7 text-ink shadow-soft backdrop:bg-deep/40"
      >
        <h2 id="gate-title" className="text-xl font-medium">
          {t('title')}
        </h2>
        <p id="gate-body" className="mt-2 text-sm text-ink-2">
          {t('body')}
        </p>
        <div className="mt-6 flex flex-wrap justify-end gap-3">
          <Button variant="ghost" onClick={() => dialogRef.current?.close()}>
            {t('notNow')}
          </Button>
          <Link href={href} className={buttonClass('primary')}>
            {t('signIn')}
          </Link>
        </div>
      </dialog>
    </GateContext>
  )
}

'use client'

import { useLocale, useTranslations } from 'next-intl'
import { useEffect, useRef, useState } from 'react'
import { Button, IconButton } from '@/components/ui/button'

/** Share (read-only link, copy, revoke) and Export (calendar file, print / save as PDF) for the trip header. */
export function ShareExport({ tripId }: { tripId: string }) {
  const t = useTranslations('trip.share')
  const locale = useLocale()
  const dialog = useRef<HTMLDialogElement>(null)
  const [url, setUrl] = useState<string | null>(null)
  const [status, setStatus] = useState<'idle' | 'loading' | 'copied' | 'revoked' | 'error'>('idle')
  const [exportOpen, setExportOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!exportOpen) return
    const close = (e: MouseEvent | KeyboardEvent) => {
      if (e instanceof KeyboardEvent ? e.key === 'Escape' : !menuRef.current?.contains(e.target as Node)) setExportOpen(false)
    }
    document.addEventListener('click', close)
    document.addEventListener('keydown', close)
    return () => {
      document.removeEventListener('click', close)
      document.removeEventListener('keydown', close)
    }
  }, [exportOpen])

  async function openShare() {
    dialog.current?.showModal()
    setStatus('loading')
    try {
      const res = await fetch(`/api/v1/me/trips/${tripId}/share?locale=${locale}`, { method: 'POST' })
      if (!res.ok) throw new Error(String(res.status))
      setUrl(((await res.json()) as { url: string }).url)
      setStatus('idle')
    } catch {
      setStatus('error')
    }
  }

  async function copy() {
    if (!url) return
    try {
      await navigator.clipboard.writeText(url)
      setStatus('copied')
    } catch {
      setStatus('error')
    }
  }

  async function revoke() {
    try {
      const res = await fetch(`/api/v1/me/trips/${tripId}/share`, { method: 'DELETE' })
      if (!res.ok) throw new Error(String(res.status))
      setUrl(null)
      setStatus('revoked')
    } catch {
      setStatus('error')
    }
  }

  function print() {
    setExportOpen(false)
    try {
      window.print()
    } catch {
      // Printing can be blocked in embedded browsers; nothing else to do.
    }
  }

  return (
    <>
      <Button variant="ghost" aria-haspopup="dialog" onClick={openShare}>
        {t('open')}
      </Button>

      <div ref={menuRef} className="relative">
        <Button variant="ghost" aria-haspopup="menu" aria-expanded={exportOpen} onClick={() => setExportOpen((v) => !v)}>
          {t('export')}
        </Button>
        {exportOpen && (
          <div role="menu" className="absolute right-0 z-20 mt-2 flex w-56 flex-col rounded-[10px] border border-line bg-surface py-1 shadow-soft">
            <a role="menuitem" href={`/api/v1/me/trips/${tripId}/export?format=ics&locale=${locale}`} download className="flex min-h-11 items-center px-4 text-sm hover:text-copper">
              {t('ics')}
            </a>
            <button role="menuitem" type="button" onClick={print} className="flex min-h-11 cursor-pointer items-center px-4 text-left text-sm hover:text-copper">
              {t('pdf')}
            </button>
          </div>
        )}
      </div>

      <dialog
        ref={dialog}
        aria-labelledby="share-title"
        onClick={(e) => {
          if (e.target === e.currentTarget) e.currentTarget.close()
        }}
        className="m-auto w-[min(520px,calc(100vw-32px))] rounded-[10px] border border-line bg-surface p-0 text-ink shadow-soft backdrop:bg-deep/40"
      >
        <div className="flex items-start justify-between gap-4 px-6 pt-5">
          <h2 id="share-title" className="text-xl font-semibold">
            {t('title')}
          </h2>
          <IconButton label={t('close')} onClick={() => dialog.current?.close()}>
            <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M6 6l12 12M18 6L6 18" />
            </svg>
          </IconButton>
        </div>
        <div className="flex flex-col gap-4 px-6 pt-2 pb-6">
          <p className="text-sm leading-[1.6] text-ink-2">{t('text')}</p>
          {url && (
            <label className="flex flex-col gap-1.5">
              <span className="eyebrow text-ink-2">{t('link')}</span>
              <input readOnly value={url} onFocus={(e) => e.currentTarget.select()} className="h-11 w-full rounded-[6px] border border-line bg-bg px-3 text-sm" />
            </label>
          )}
          <p aria-live="polite" className="text-sm text-ink-2">
            {status === 'loading' && t('creating')}
            {status === 'copied' && t('copied')}
            {status === 'revoked' && t('revoked')}
            {status === 'error' && <span className="text-copper">{t('error')}</span>}
          </p>
          <div className="flex flex-wrap gap-2">
            <Button onClick={copy} disabled={!url}>
              {t('copy')}
            </Button>
            <Button variant="ghost" onClick={revoke} disabled={!url}>
              {t('revoke')}
            </Button>
          </div>
        </div>
      </dialog>
    </>
  )
}

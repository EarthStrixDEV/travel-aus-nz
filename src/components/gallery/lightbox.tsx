'use client'

import { useTranslations } from 'next-intl'
import { useEffect, useRef } from 'react'
import { buttonClass, Button, IconButton } from '@/components/ui/button'
import { BookmarkIcon } from '@/components/venues/venue-card'
import { Row } from '@/components/venues/venue-drawer'
import { Link } from '@/i18n/navigation'
import type { GalleryPhoto } from '@/lib/gallery/filter'
import { imageSizes } from '@/lib/media/path'
import { GalleryImage } from './gallery-image'
import { typeName, type T } from './labels'

const navButton =
  'absolute top-1/2 inline-flex size-12 -translate-y-1/2 cursor-pointer items-center justify-center rounded-full border border-on-deep/30 bg-transparent text-on-deep transition-colors duration-500 hover:border-on-deep disabled:cursor-not-allowed disabled:opacity-30 disabled:hover:border-on-deep/30'

/**
 * Full-screen viewer in a native modal <dialog> (focus trapped, Esc closes). Steps through `photos` — the
 * filtered list — with the Prev / Next buttons or the arrow keys; both stop at the ends (no wrap). The place
 * summary comes with each photo, so nothing is fetched here. The opener restores its own focus from `onClose`.
 */
export function Lightbox({
  photos,
  index,
  saved,
  onIndex,
  onClose,
  onToggleSave,
}: {
  photos: GalleryPhoto[]
  /** Position in `photos`, or null while closed. */
  index: number | null
  /** Whether the shown photo's place is already in the trip. */
  saved: boolean
  onIndex: (index: number) => void
  onClose: () => void
  onToggleSave: () => void
}) {
  const t = useTranslations('gallery') as unknown as T
  const dialogRef = useRef<HTMLDialogElement>(null)
  const closeRef = useRef<HTMLButtonElement>(null)
  const photo = index === null ? null : (photos[index] ?? null)
  const open = photo !== null

  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return
    if (open && !dialog.open) {
      dialog.showModal()
      closeRef.current?.focus()
    } else if (!open && dialog.open) {
      dialog.close()
    }
  }, [open])

  // Stepping onto either end disables the button that was just pressed; keep focus inside the dialog.
  useEffect(() => {
    const dialog = dialogRef.current
    const active = document.activeElement
    if (!dialog?.open) return
    if (!active || active === document.body || active === dialog || (active instanceof HTMLButtonElement && active.disabled)) {
      closeRef.current?.focus()
    }
  }, [index])

  const last = photos.length - 1

  function onKeyDown(e: React.KeyboardEvent) {
    if (index === null) return
    if (e.key === 'ArrowRight' && index < last) {
      e.preventDefault()
      onIndex(index + 1)
    } else if (e.key === 'ArrowLeft' && index > 0) {
      e.preventDefault()
      onIndex(index - 1)
    }
  }

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby="lightbox-title"
      onClose={onClose}
      onKeyDown={onKeyDown}
      className="m-0 h-dvh max-h-none w-full max-w-none bg-deep/95 p-0 text-on-deep backdrop:bg-transparent open:flex open:flex-col md:open:flex-row"
    >
      {photo && index !== null && (
        <>
          <div className="relative flex h-[42dvh] flex-none items-center justify-center p-4 md:h-auto md:min-w-0 md:flex-1 md:p-14 [&_:focus-visible]:outline-on-deep">
            <GalleryImage
              key={photo.id}
              image={photo.image}
              sizes={imageSizes('lightbox')}
              fit="contain"
              className="max-h-full w-full max-w-[900px] rounded"
            />
            <button type="button" aria-label={t('lightbox.prev')} disabled={index === 0} onClick={() => onIndex(index - 1)} className={`${navButton} left-3 md:left-4`}>
              <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M15 6l-6 6 6 6" />
              </svg>
            </button>
            <button type="button" aria-label={t('lightbox.next')} disabled={index === last} onClick={() => onIndex(index + 1)} className={`${navButton} right-3 md:right-4`}>
              <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M9 6l6 6-6 6" />
              </svg>
            </button>
            <p aria-live="polite" className="absolute bottom-3 left-4 text-[13px] text-on-deep/70 tabular-nums md:bottom-5 md:left-14">
              {t('lightbox.position', { n: index + 1, total: photos.length })}
            </p>
          </div>

          <aside className="relative min-h-0 flex-1 overflow-y-auto bg-surface p-6 text-ink md:w-[400px] md:flex-none md:p-8">
            <IconButton ref={closeRef} label={t('lightbox.close')} onClick={() => dialogRef.current?.close()} className="absolute top-4 right-4 bg-surface md:top-5 md:right-5">
              <svg aria-hidden="true" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
                <path d="M6 6l12 12M18 6L6 18" />
              </svg>
            </IconButton>

            <p className="eyebrow text-copper">
              {[typeName(photo.type, photo.typeLabel, t), photo.region?.name].filter(Boolean).join(' · ')}
            </p>
            <h2 id="lightbox-title" className="mt-3 pr-12 text-[30px] leading-[1.15] font-semibold">
              {photo.title}
            </h2>
            {photo.place.description && <p className="mt-3 text-[15px] leading-[1.65] text-ink-2">{photo.place.description}</p>}

            <div className="mt-6">
              <Row
                title={t('lightbox.best')}
                icon={
                  <>
                    <circle cx="12" cy="12" r="4" />
                    <path d="M12 2v2M12 20v2M2 12h2M20 12h2M5 5l1.5 1.5M17.5 17.5L19 19M5 19l1.5-1.5M17.5 6.5L19 5" />
                  </>
                }
              >
                <span className="font-medium">{photo.place.bestTime || t('lightbox.noBest')}</span>
              </Row>
              <Row
                title={t('lightbox.access')}
                icon={
                  <>
                    <rect x="6" y="3" width="12" height="13" rx="3" />
                    <path d="M6 10h12M9 20l1.5-4M15 20l-1.5-4" />
                  </>
                }
              >
                {photo.place.access || t('lightbox.noAccess')}
              </Row>
              <Row title={t('lightbox.dining')} icon={<path d="M7 3v18M5 3v5a2 2 0 0 0 4 0V3M17 21V3c-2 1-3.5 3-3.5 7v3H17" />}>
                {photo.place.nearby.length > 0 ? (
                  <ul className="space-y-1">
                    {photo.place.nearby.map((v) => (
                      <li key={v.slug}>
                        <span className="font-medium">{v.name}</span>
                        {v.area && <span className="text-ink-2"> · {v.area}</span>}
                      </li>
                    ))}
                  </ul>
                ) : (
                  t('lightbox.noDining')
                )}
              </Row>
            </div>

            <div className="mt-6 flex flex-wrap gap-2.5">
              <Link href={{ pathname: '/map', query: { place: photo.place.slug } }} className={`${buttonClass('primary')} flex-1`}>
                {t('lightbox.openPlace')}
              </Link>
              <Button variant="ghost" aria-pressed={saved} onClick={onToggleSave}>
                <BookmarkIcon filled={saved} size={16} />
                {saved ? t('lightbox.inTrip') : t('lightbox.addToTrip')}
              </Button>
            </div>
          </aside>
        </>
      )}
    </dialog>
  )
}

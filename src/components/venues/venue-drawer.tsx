'use client'

import { useLocale, useTranslations } from 'next-intl'
import { useEffect, useRef } from 'react'
import { buttonClass, Button, IconButton } from '@/components/ui/button'
import { Link } from '@/i18n/navigation'
import { summariseHours } from '@/lib/venues/hours'
import type { VenueCard as Venue } from '@/lib/venues/filter'
import { BookmarkIcon, PriceLevel } from './venue-card'

function Row({ icon, title, children }: { icon: React.ReactNode; title?: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-3.5 border-t border-line-2 py-3.5">
      <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" className="mt-0.5 flex-none text-ink-2">
        {icon}
      </svg>
      <div className="min-w-0">
        {title && <p className="eyebrow text-ink-2">{title}</p>}
        <div className={`text-sm leading-[1.6] ${title ? 'mt-1' : ''}`}>{children}</div>
      </div>
    </div>
  )
}

/**
 * Venue details in a native modal <dialog>: focus is trapped, Esc and the backdrop close it, and focus
 * returns to whatever opened it. Right-hand panel from `md`, bottom sheet below.
 */
export function VenueDrawer({
  venue,
  saved,
  onToggleSave,
  onClose,
}: {
  venue: Venue | null
  saved: boolean
  onToggleSave: () => void
  onClose: () => void
}) {
  const t = useTranslations('eatDrink.drawer')
  const locale = useLocale()
  const dialogRef = useRef<HTMLDialogElement>(null)
  const returnFocus = useRef<HTMLElement | null>(null)
  const open = venue !== null

  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return
    if (open && !dialog.open) {
      returnFocus.current = document.activeElement instanceof HTMLElement ? document.activeElement : null
      dialog.showModal()
    } else if (!open && dialog.open) {
      dialog.close()
    }
  }, [open])

  const hours = venue ? summariseHours(venue.hours, locale, t('daily')) : ''

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby="venue-drawer-title"
      onClose={() => {
        onClose()
        returnFocus.current?.focus({ preventScroll: true })
        returnFocus.current = null
      }}
      onClick={(e) => {
        // A click on the backdrop lands on the dialog element itself, never on its content.
        if (e.target === e.currentTarget) e.currentTarget.close()
      }}
      className="fixed inset-x-0 top-auto bottom-0 m-0 max-h-[85dvh] w-full max-w-none overflow-y-auto rounded-t-[18px] border border-line bg-surface p-0 text-ink shadow-soft backdrop:bg-deep/40 md:inset-y-0 md:right-0 md:left-auto md:h-dvh md:max-h-none md:w-[460px] md:rounded-none md:rounded-l-[10px]"
    >
      {venue && (
        <div className="flex flex-col pb-7">
          <div className="sticky top-0 z-10 flex justify-end bg-surface px-3 pt-3">
            <IconButton label={t('close')} onClick={() => dialogRef.current?.close()} className="bg-surface">
              <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M6 6l12 12M18 6L6 18" />
              </svg>
            </IconButton>
          </div>
          <div className="px-6 md:px-7">
            <div className="flex items-baseline justify-between gap-3">
              <p className="eyebrow text-copper">{[venue.cuisine?.name, venue.city.name].filter(Boolean).join(' · ')}</p>
              <PriceLevel level={venue.priceLevel} />
            </div>
            <h2 id="venue-drawer-title" className="mt-2.5 text-[28px] leading-[1.2] font-semibold tracking-[-0.01em]">
              {venue.name}
            </h2>
            {venue.description && <p className="mt-3 text-[15px] leading-[1.65] text-ink-2">{venue.description}</p>}

            <div className="mt-5">
              {venue.menuHighlights && (
                <Row title={t('menu')} icon={<path d="M5 4h14v16H5zM9 8h6M9 12h6M9 16h4" />}>
                  {venue.menuHighlights}
                </Row>
              )}
              {venue.signatureDrinks && (
                <Row title={t('drinks')} icon={<path d="M5 4h14l-7 8zM12 12v8M8 20h8" />}>
                  {venue.signatureDrinks}
                </Row>
              )}
              <Row
                title={t('hours')}
                icon={
                  <>
                    <circle cx="12" cy="12" r="9" />
                    <path d="M12 7v5l3 2" />
                  </>
                }
              >
                {hours || t('noHours')}
                {venue.hoursNote && <span className="mt-0.5 block text-[13px] text-ink-2">{venue.hoursNote}</span>}
              </Row>
              <Row
                title={t('stop')}
                icon={
                  venue.stop ? (
                    <>
                      <rect x="6" y="3" width="12" height="13" rx="3" />
                      <path d="M6 10h12M9 20l1.5-4M15 20l-1.5-4" />
                    </>
                  ) : (
                    <path d="M12 21s-7-6.2-7-11a7 7 0 0 1 14 0c0 4.8-7 11-7 11z" />
                  )
                }
              >
                {venue.stop ? (
                  <>
                    <span className="font-medium">{venue.stop.name}</span>
                    <span className="block text-[13px] text-ink-2">{t('walk', { min: venue.stop.walkMin })}</span>
                  </>
                ) : (
                  t('noStop')
                )}
              </Row>
            </div>

            <div className="mt-5 flex gap-2.5">
              <Button variant={saved ? 'ghost' : 'primary'} aria-pressed={saved} onClick={onToggleSave} className="flex-1">
                <BookmarkIcon filled={saved} size={16} />
                {saved ? t('saved') : t('save')}
              </Button>
              <Link href={{ pathname: '/map', query: { place: venue.slug } }} className={buttonClass('ghost')}>
                {t('onMap')}
              </Link>
            </div>
          </div>
        </div>
      )}
    </dialog>
  )
}

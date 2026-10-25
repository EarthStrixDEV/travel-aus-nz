'use client'

import { useTranslations } from 'next-intl'
import { useEffect, useRef, useState } from 'react'
import { useSavedPlaces } from '@/components/trip/use-saved-places'
import { Button, IconButton } from '@/components/ui/button'
import type { PlaceHours, PlaceWithStatus } from '@/lib/content/places'
import { LayerShape } from './layer-toggle'
import { layerOf } from './layers'

export type DrawerStatus = 'loading' | 'ready' | 'error'

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

/** Today's opening ranges in the place's city time zone, e.g. "12:00–22:00, 17:30–23:00". */
function todaysHours(hours: PlaceHours[], timezone: string | undefined): string {
  let day = new Date().getDay()
  try {
    day = WEEKDAYS.indexOf(new Intl.DateTimeFormat('en-US', { weekday: 'short', timeZone: timezone }).format(new Date()))
  } catch {
    // Unknown time zone: fall back to the viewer's day.
  }
  return hours
    .filter((h) => h.weekday === day)
    .map((h) => `${h.open}–${h.close}`)
    .join(', ')
}

function Row({ icon, title, note }: { icon: React.ReactNode; title: React.ReactNode; note?: string }) {
  return (
    <div className="flex items-start gap-3.5 border-t border-line-2 py-3.5">
      <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" className="mt-0.5 flex-none text-ink-2">
        {icon}
      </svg>
      <div className="flex flex-col gap-0.5">
        <span className="text-sm font-medium">{title}</span>
        {note && <span className="text-[13px] text-ink-2">{note}</span>}
      </div>
    </div>
  )
}

function Details({ place }: { place: PlaceWithStatus }) {
  const t = useTranslations('map.drawer')
  const tType = useTranslations('map.layerName')
  const { saved, toggle } = useSavedPlaces([place.id])
  const [shareNote, setShareNote] = useState('')
  const isSaved = saved.has(place.id)
  const layer = layerOf(place.type)
  const today = todaysHours(place.hours, place.city?.timezone)
  const area = place.area || place.neighbourhood

  async function share() {
    const url = window.location.href
    try {
      if (navigator.share) {
        await navigator.share({ title: place.name, url })
        return
      }
      await navigator.clipboard.writeText(url)
      setShareNote(t('copied'))
    } catch {
      // Share sheet dismissed or clipboard blocked: nothing to report.
    }
  }

  return (
    <div className="flex flex-col px-6 pt-2 pb-7 md:px-7">
      <p className="eyebrow flex items-center gap-1.5 text-copper">
        <LayerShape layer={layer} />
        {area ? `${tType(layer)} · ${area}` : tType(layer)}
      </p>
      <h2 id="place-drawer-title" className="mt-2.5 text-[28px] leading-[1.2] font-semibold tracking-[-0.01em]">
        {place.name}
      </h2>
      {place.description && <p className="mt-3 text-[15px] leading-[1.65] text-ink-2">{place.description}</p>}
      {place.tags.length > 0 && (
        <ul className="mt-4 flex flex-wrap gap-1.5">
          {place.tags.map((tag) => (
            <li key={tag} className="rounded-full border border-line px-2.5 py-1 text-xs text-ink-2">
              {tag}
            </li>
          ))}
        </ul>
      )}

      <div className="mt-5">
        <Row
          icon={
            <>
              <circle cx="12" cy="12" r="9" />
              <path d="M12 7v5l3 2" />
            </>
          }
          title={
            <>
              <span className={place.isOpenNow ? 'text-copper' : undefined}>{place.isOpenNow ? t('openNow') : t('closedNow')}</span>
              {' · '}
              {place.hours.length === 0 ? t('noHours') : today ? t('today', { hours: today }) : t('closedToday')}
            </>
          }
          note={place.hoursNote}
        />
        {place.priceLevel !== null && (
          <Row
            icon={
              <>
                <rect x="3" y="6" width="18" height="12" rx="2" />
                <circle cx="12" cy="12" r="2.5" />
              </>
            }
            title={
              place.priceLevel <= 0 ? (
                t('free')
              ) : (
                <span aria-label={t('priceLevel', { n: place.priceLevel })} className="tracking-[.06em]">
                  <span aria-hidden="true">
                    {'$'.repeat(place.priceLevel)}
                    <span className="text-ink-3">{'$'.repeat(Math.max(0, 4 - place.priceLevel))}</span>
                  </span>
                </span>
              )
            }
            note={place.priceNote}
          />
        )}
        {place.stops.length === 0 ? (
          <Row icon={<path d="M12 21s-7-6.2-7-11a7 7 0 0 1 14 0c0 4.8-7 11-7 11z" />} title={t('noStop')} />
        ) : (
          place.stops.map((s, i) => (
            <Row
              key={s.name}
              icon={
                <>
                  <rect x="6" y="3" width="12" height="13" rx="3" />
                  <path d="M6 10h12M9 20l1.5-4M15 20l-1.5-4" />
                </>
              }
              title={s.name}
              note={i === 0 && s.walk ? `${t('walk', { min: s.walkMin })} · ${t('routeShown')}` : t('walk', { min: s.walkMin })}
            />
          ))
        )}
      </div>

      <div className="mt-5 flex gap-2.5">
        <Button variant={isSaved ? 'ghost' : 'primary'} aria-pressed={isSaved} onClick={() => toggle(place.id)} className="flex-1">
          <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill={isSaved ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="1.5">
            <path d="M6 3h12v18l-6-4-6 4z" />
          </svg>
          {isSaved ? t('saved') : t('save')}
        </Button>
        <IconButton label={t('share')} onClick={share}>
          <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4">
            <path d="M12 3v13M7 8l5-5 5 5M5 14v6h14v-6" />
          </svg>
        </IconButton>
      </div>
      <p aria-live="polite" className="mt-2 min-h-5 text-[13px] text-ink-2">
        {shareNote}
      </p>
      {place.website && (
        <a href={place.website} target="_blank" rel="noopener noreferrer" className="text-sm font-medium text-copper underline-offset-4 hover:underline">
          {t('website')}
        </a>
      )}
    </div>
  )
}

/**
 * Place details: right-hand panel on desktop (Map.dc.html), bottom sheet on mobile
 * (MapMobile.dc.html). Escape or Close dismisses it; focus moves to Close when it opens.
 */
export function PlaceDrawer({
  slug,
  status,
  place,
  onClose,
  onRetry,
}: {
  slug: string
  status: DrawerStatus
  place: PlaceWithStatus | null
  onClose: () => void
  onRetry: () => void
}) {
  const t = useTranslations('map.drawer')
  const tList = useTranslations('map.list')
  const closeRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    closeRef.current?.focus({ preventScroll: true })
  }, [slug])

  return (
    <aside
      aria-label={t('label')}
      onKeyDown={(e) => {
        if (e.key === 'Escape') onClose()
      }}
      className="fixed inset-x-0 bottom-0 z-30 max-h-[78dvh] overflow-y-auto rounded-t-[18px] border border-line bg-surface shadow-(--shadow) md:absolute md:inset-x-auto md:top-5 md:right-5 md:bottom-5 md:z-10 md:max-h-none md:w-[420px] md:rounded-[10px]"
    >
      <div className="sticky top-0 flex justify-end bg-surface px-3 pt-3">
        <IconButton ref={closeRef} label={t('close')} onClick={onClose} className="size-10 bg-surface">
          <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M6 6l12 12M18 6L6 18" />
          </svg>
        </IconButton>
      </div>
      <div aria-live="polite">
        {status === 'loading' && <p className="px-7 pb-7 text-sm text-ink-2">{t('loading')}</p>}
        {status === 'error' && (
          <p className="flex items-center gap-3 px-7 pb-7 text-sm text-ink-2">
            {t('error')}
            <button type="button" onClick={onRetry} className="min-h-11 cursor-pointer font-medium text-copper">
              {tList('retry')}
            </button>
          </p>
        )}
      </div>
      {status === 'ready' && place && <Details key={place.slug} place={place} />}
    </aside>
  )
}

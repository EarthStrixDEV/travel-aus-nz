'use client'

import { useLocale, useTranslations } from 'next-intl'
import type { ReactNode } from 'react'
import type { TransitMode } from '@/lib/content/shared'
import { formatDuration } from '@/lib/format/money'
import type { RouteOption } from '@/lib/routing/types'

// ---- mode marks ----------------------------------------------------------------------------
// Every transit_mode has its own icon and its own line pattern (solid / double / dashed / dotted), so modes are
// told apart by shape, never by colour alone.

const ICON_PATHS: Record<TransitMode, ReactNode> = {
  train: (
    <>
      <rect x="5" y="3" width="14" height="14" rx="3" />
      <path d="M5 10h14M8 17l-2 4M16 17l2 4" />
      <circle cx="9" cy="13.5" r=".9" />
      <circle cx="15" cy="13.5" r=".9" />
    </>
  ),
  metro: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M8 16V8l4 5 4-5v8" />
    </>
  ),
  tram: (
    <>
      <path d="M9 2h6M12 2v3" />
      <rect x="6" y="5" width="12" height="13" rx="2" />
      <path d="M6 11h12M8 21l1.5-3M16 21l-1.5-3" />
    </>
  ),
  bus: (
    <>
      <rect x="4" y="3" width="16" height="15" rx="2" />
      <path d="M4 11h16M7 21v-3M17 21v-3" />
      <circle cx="8" cy="14.5" r=".9" />
      <circle cx="16" cy="14.5" r=".9" />
    </>
  ),
  coach: (
    <>
      <rect x="2" y="5" width="20" height="11" rx="2" />
      <path d="M2 10h20M14 5v5" />
      <circle cx="6.5" cy="18" r="1.6" />
      <circle cx="17.5" cy="18" r="1.6" />
    </>
  ),
  ferry: (
    <>
      <path d="M4 16l1.5 3h13l1.5-3zM7 16v-5h10v5M10 11V7h4v4" />
      <path d="M2 22c2 0 2-1 4-1s2 1 4 1 2-1 4-1 2 1 4 1 2-1 4-1" />
    </>
  ),
  walk: (
    <>
      <circle cx="13" cy="4" r="1.6" />
      <path d="M10 21l2-6 3 3v3M12 15l-1-5 4 1 2 3M11 10l-3 2v3" />
    </>
  ),
}

export function ModeIcon({ mode, size = 16, className }: { mode: TransitMode; size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" aria-hidden="true" className={className}>
      {ICON_PATHS[mode]}
    </svg>
  )
}

const H_STROKE: Record<TransitMode, string> = {
  train: 'border-t-4 border-solid',
  metro: 'border-t-4 border-solid',
  tram: 'h-1.5 border-y-[1.5px] border-solid',
  bus: 'border-t-[3px] border-dashed',
  coach: 'border-t-[3px] border-dashed',
  ferry: 'border-t-4 border-dotted',
  walk: 'border-t-2 border-dotted opacity-60',
}

const V_STROKE: Record<TransitMode, string> = {
  train: 'border-l-4 border-solid',
  metro: 'border-l-4 border-solid',
  tram: 'w-[7px] border-x-[1.5px] border-solid',
  bus: 'border-l-[3px] border-dashed',
  coach: 'border-l-[3px] border-dashed',
  ferry: 'border-l-4 border-dotted',
  walk: 'border-l-2 border-dotted opacity-60',
}

/** The design's line pattern for a mode (`.m-*` horizontal, `.v-*` vertical), drawn in `currentColor`. */
export function ModeStroke({ mode, vertical = false, className = '' }: { mode: TransitMode; vertical?: boolean; className?: string }) {
  return <span aria-hidden="true" className={`block border-current ${vertical ? V_STROKE[mode] : H_STROKE[mode]} ${className}`} />
}

/** Icon + uppercase label, the design's leg tag. */
export function ModeBadge({ mode }: { mode: TransitMode }) {
  const t = useTranslations('transport.mode')
  return (
    <span className="inline-flex items-center gap-1.5 rounded-[4px] border border-line px-2 py-0.5 text-[11px] font-medium tracking-[.12em] text-ink uppercase">
      <ModeIcon mode={mode} size={13} />
      {t(mode)}
    </span>
  )
}

// ---- formatting ----------------------------------------------------------------------------

/** `HH:mm` of an ISO UTC instant, in the city's timezone. */
export function formatClock(iso: string, timeZone: string, locale: string): string {
  return new Intl.DateTimeFormat(locale, { hour: '2-digit', minute: '2-digit', hourCycle: 'h23', timeZone }).format(new Date(iso))
}

/** "2 h 12" / "2 h" / "45 min", from `transport.duration`. */
export function useDurationText(): (minutes: number) => string {
  const t = useTranslations('transport.duration')
  return (minutes) => {
    const { h, m } = formatDuration(Math.max(0, Math.round(minutes)))
    return h === 0 ? t('m', { m }) : m === 0 ? t('h', { h }) : t('hm', { h, m })
  }
}

// ---- selected route legs -------------------------------------------------------------------

/** Selected route, leg by leg: time, stop, mode and detail, ending at the arrival point. */
export function RouteLegs({ option, timeZone }: { option: RouteOption; timeZone: string }) {
  const locale = useLocale()
  const t = useTranslations('transport.results')
  const duration = useDurationText()
  const last = option.legs[option.legs.length - 1]

  return (
    <ol className="mt-6">
      {option.legs.map((leg, i) => (
        <li key={i} className="grid grid-cols-[52px_24px_minmax(0,1fr)] gap-x-3 md:grid-cols-[64px_28px_minmax(0,1fr)] md:gap-x-4">
          <span className="pt-px text-sm font-medium tabular-nums">
            <time dateTime={leg.depart}>{formatClock(leg.depart, timeZone, locale)}</time>
          </span>
          <div className="flex flex-col items-center text-copper">
            <span aria-hidden="true" className="size-3.5 flex-none rounded-full border-2 border-copper bg-surface" />
            <ModeStroke mode={leg.mode} vertical className="min-h-16 flex-1" />
          </div>
          <div className="pb-6">
            <p className="text-base font-medium">{leg.from}</p>
            <p className="mt-1.5 flex flex-wrap items-center gap-2 text-[13px] text-ink-2">
              <ModeBadge mode={leg.mode} />
              <span>
                {leg.detail} · {duration(leg.duration_min)}
              </span>
            </p>
          </div>
        </li>
      ))}
      <li className="grid grid-cols-[52px_24px_minmax(0,1fr)] gap-x-3 md:grid-cols-[64px_28px_minmax(0,1fr)] md:gap-x-4">
        <span className="text-sm font-medium tabular-nums">
          <time dateTime={option.arrive}>{formatClock(option.arrive, timeZone, locale)}</time>
        </span>
        <div className="flex justify-center">
          <span aria-hidden="true" className="size-3.5 rounded-full bg-copper" />
        </div>
        <p className="text-base font-medium">
          <span className="sr-only">{t('arrive')}: </span>
          {last?.to}
        </p>
      </li>
    </ol>
  )
}

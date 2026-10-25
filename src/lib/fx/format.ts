import type { Locale } from '@/lib/i18n/t'

// Gregorian in both locales (th-TH would default to the Buddhist calendar), fixed zones so the server
// render and the browser agree and hydration never mismatches.
const INTL: Record<Locale, string> = { th: 'th-TH-u-ca-gregory', en: 'en-AU' }

/** "2026-10-14" -> "14 Oct 2026" (a calendar day, zone-free). */
export function formatDay(day: string, locale: Locale): string {
  return new Intl.DateTimeFormat(INTL[locale], { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${day}T00:00:00Z`))
}

/** Snapshot time in Sydney time, as the artboard shows it: "15 Oct 2026, 09:30 AEDT". */
export function formatUpdated(iso: string, locale: Locale): string {
  return new Intl.DateTimeFormat(INTL[locale], {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone: 'Australia/Sydney',
    timeZoneName: 'short',
  }).format(new Date(iso))
}

/** Just the date part of a snapshot, for "last saved rates from {date}". */
export function formatSnapshotDate(iso: string, locale: Locale): string {
  return new Intl.DateTimeFormat(INTL[locale], { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Australia/Sydney' }).format(new Date(iso))
}

/** "2026-10-15" -> "October 2026". */
export function formatMonthYear(day: string, locale: Locale): string {
  return new Intl.DateTimeFormat(INTL[locale], { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${day}T00:00:00Z`))
}

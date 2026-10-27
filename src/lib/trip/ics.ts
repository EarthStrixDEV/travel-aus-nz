import type { TripDay } from './model'

/**
 * iCalendar export (RFC 5545) of a trip: one 60-minute VEVENT per stop that has both a date and a time.
 * Times are wall-clock in the stop's city zone (`DTSTART;TZID=Australia/Sydney:...`); calendar apps resolve
 * IANA zone ids. Lines end in CRLF and are folded at 75 octets; text values are escaped.
 */

const STOP_MINUTES = 60
const FALLBACK_TZ = 'Australia/Sydney'

/** Escapes a TEXT value: backslash, semicolon, comma and newlines. */
export function escapeText(s: string): string {
  return s.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n')
}

/** Folds a content line at 75 octets (UTF-8), continuing with CRLF + one space, never splitting a character. */
export function foldLine(line: string): string {
  const enc = new TextEncoder()
  const out: string[] = []
  let current = ''
  let size = 0
  for (const ch of line) {
    const n = enc.encode(ch).length
    // The first line holds 75 octets; continuation lines carry a leading space, so 74.
    const limit = out.length === 0 ? 75 : 74
    if (size + n > limit) {
      out.push(current)
      current = ''
      size = 0
    }
    current += ch
    size += n
  }
  out.push(current)
  return out.join('\r\n ')
}

const stamp = (d: Date) => d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '')
const local = (date: string, time: string) => `${date.replace(/-/g, '')}T${time.replace(':', '')}00`

export function buildIcs(trip: { id: string; title: string; days: TripDay[] }, now = new Date()): string {
  const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//TravelAusNZ//My Trip//EN', 'CALSCALE:GREGORIAN', `X-WR-CALNAME:${escapeText(trip.title)}`]
  for (const day of trip.days) {
    if (!day.date) continue
    for (const stop of day.stops) {
      if (!stop.time) continue
      const tz = stop.place.cityTimezone ?? FALLBACK_TZ
      const location = [stop.place.name, stop.place.area].filter(Boolean).join(', ')
      lines.push(
        'BEGIN:VEVENT',
        `UID:${stop.id}@travelausnz`,
        `DTSTAMP:${stamp(now)}`,
        `DTSTART;TZID=${tz}:${local(day.date, stop.time)}`,
        `DURATION:PT${STOP_MINUTES}M`,
        `SUMMARY:${escapeText(stop.place.name)}`,
        `LOCATION:${escapeText(location)}`,
        ...(stop.note ? [`DESCRIPTION:${escapeText(stop.note)}`] : []),
        'END:VEVENT',
      )
    }
  }
  lines.push('END:VCALENDAR')
  return lines.map(foldLine).join('\r\n') + '\r\n'
}

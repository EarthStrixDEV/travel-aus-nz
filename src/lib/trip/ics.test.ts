import { describe, expect, it } from 'vitest'
import { buildIcs, escapeText, foldLine } from './ics'
import type { TripDay, TripStop } from './model'

const stop = (id: string, name: string, time: string | null, note = ''): TripStop => ({
  id,
  position: 1,
  time,
  note,
  place: { id, slug: id, type: 'attraction', name, area: 'The Rocks', lng: 151.2, lat: -33.86, citySlug: 'sydney', cityBbox: null, cityTimezone: 'Australia/Sydney' },
  legToNext: null,
})

const day = (date: string | null, stops: TripStop[]): TripDay => ({ id: 'd', dayNo: 1, date, title: '', stops, transitMin: 0, offMap: false })

const NOW = new Date('2026-10-27T03:04:05.678Z')

describe('buildIcs', () => {
  const ics = buildIcs(
    {
      id: 't',
      title: 'Sydney, NSW; harbour',
      days: [day('2026-11-02', [stop('s1', 'Opera House, Sydney; tour', '09:00', 'Line 1\nLine 2'), stop('s2', 'No time', null)]), day(null, [stop('s3', 'Undated', '10:00')])],
    },
    NOW,
  )

  it('uses CRLF everywhere and ends with one', () => {
    expect(ics.endsWith('\r\n')).toBe(true)
    expect(ics.replace(/\r\n/g, '')).not.toMatch(/[\r\n]/)
  })

  it('one event per timed stop on a dated day, in the city zone', () => {
    expect(ics.match(/BEGIN:VEVENT/g)).toHaveLength(1)
    expect(ics).toContain('DTSTART;TZID=Australia/Sydney:20261102T090000')
    expect(ics).toContain('DTSTAMP:20261027T030405Z')
    expect(ics).toContain('UID:s1@travelausnz')
  })

  it('escapes commas, semicolons and newlines', () => {
    expect(ics).toContain('SUMMARY:Opera House\\, Sydney\\; tour')
    expect(ics).toContain('DESCRIPTION:Line 1\\nLine 2')
    expect(ics).toContain('X-WR-CALNAME:Sydney\\, NSW\\; harbour')
  })
})

describe('foldLine', () => {
  it('folds a long line at 75 octets with CRLF + space', () => {
    const folded = foldLine(`SUMMARY:${'x'.repeat(100)}`)
    const parts = folded.split('\r\n')
    expect(parts[0]).toHaveLength(75)
    expect(parts[1].startsWith(' ')).toBe(true)
    expect(parts.map((p, i) => (i ? p.slice(1) : p)).join('')).toBe(`SUMMARY:${'x'.repeat(100)}`)
  })

  it('never splits a multi-byte character (Thai is 3 octets each)', () => {
    const line = `SUMMARY:${'ก'.repeat(40)}`
    for (const part of foldLine(line).split('\r\n')) expect(new TextEncoder().encode(part).length).toBeLessThanOrEqual(75)
    expect(foldLine(line).replace(/\r\n /g, '')).toBe(line)
  })

  it('leaves short lines alone; escapeText handles backslashes first', () => {
    expect(foldLine('VERSION:2.0')).toBe('VERSION:2.0')
    expect(escapeText('a\\b,c')).toBe('a\\\\b\\,c')
  })
})

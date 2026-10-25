import type { PlaceHours } from '@/lib/content/places'

/** Mon-first display order of `place_hours.weekday` (0 = Sunday). */
const WEEK = [1, 2, 3, 4, 5, 6, 0] as const

function dayNames(locale: string): Record<number, string> {
  // 2023-01-01 was a Sunday, so day offset === weekday.
  const fmt = new Intl.DateTimeFormat(locale, { weekday: 'short', timeZone: 'UTC' })
  return Object.fromEntries([0, 1, 2, 3, 4, 5, 6].map((d) => [d, fmt.format(new Date(Date.UTC(2023, 0, 1 + d)))]))
}

/**
 * "Tue–Sat 17:30–23:00 · Sun 12:00–16:00": days sharing the same ranges are grouped, consecutive
 * days (Mon-first) collapse into a run, and an all-week group reads `daily` (pass the translated word). Empty without hours.
 */
export function summariseHours(hours: PlaceHours[], locale: string, daily = 'Daily'): string {
  if (hours.length === 0) return ''
  const names = dayNames(locale)

  const ranges = new Map<number, string[]>()
  for (const h of [...hours].sort((a, b) => a.open.localeCompare(b.open))) {
    ranges.set(h.weekday, [...(ranges.get(h.weekday) ?? []), `${h.open}–${h.close}`])
  }

  const groups = new Map<string, number[]>()
  for (const day of WEEK) {
    const r = ranges.get(day)
    if (r) groups.set(r.join(', '), [...(groups.get(r.join(', ')) ?? []), day])
  }

  return [...groups.entries()]
    .map(([range, days]) => {
      if (days.length === 7) return `${daily} ${range}`
      const runs: number[][] = []
      for (const day of days) {
        const last = runs[runs.length - 1]
        if (last && WEEK.indexOf(day as (typeof WEEK)[number]) === WEEK.indexOf(last[last.length - 1] as (typeof WEEK)[number]) + 1) last.push(day)
        else runs.push([day])
      }
      const label = runs
        .map((r) => (r.length > 2 ? `${names[r[0]]}–${names[r[r.length - 1]]}` : r.map((d) => names[d]).join(', ')))
        .join(', ')
      return `${label} ${range}`
    })
    .join(' · ')
}

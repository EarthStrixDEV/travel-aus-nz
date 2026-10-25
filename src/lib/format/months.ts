/** Short month name in the given locale ("Sep", "ก.ย."). `month` is 1-12. */
function monthName(month: number, locale: string): string {
  return new Intl.DateTimeFormat(locale, { month: 'short', timeZone: 'UTC' }).format(new Date(Date.UTC(2000, month - 1, 1)))
}

/**
 * "Sep–Nov" from `regions.best_months`. Contiguous runs (wrapping Dec -> Jan) collapse to
 * first–last; separate runs are comma-joined. Out-of-range values are ignored.
 */
export function formatBestMonths(months: readonly number[] | null | undefined, locale: string): string {
  const set = new Set((months ?? []).filter((m) => Number.isInteger(m) && m >= 1 && m <= 12))
  if (set.size === 0) return ''
  if (set.size === 12) return `${monthName(1, locale)}–${monthName(12, locale)}`

  // Start at a month whose predecessor is absent, so a run wrapping the year end stays in one piece.
  const start = [...set].find((m) => !set.has(m === 1 ? 12 : m - 1)) as number
  const runs: [number, number][] = []
  for (let i = 0; i < 12; i++) {
    const m = ((start - 1 + i) % 12) + 1
    if (!set.has(m)) continue
    const last = runs[runs.length - 1]
    if (last && last[1] === (m === 1 ? 12 : m - 1)) last[1] = m
    else runs.push([m, m])
  }
  return runs
    .map(([a, b]) => (a === b ? monthName(a, locale) : `${monthName(a, locale)}–${monthName(b, locale)}`))
    .join(', ')
}

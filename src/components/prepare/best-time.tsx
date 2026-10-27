'use client'

import { useLocale, useTranslations } from 'next-intl'
import { formatBestMonths } from '@/lib/format/months'
import { southernSeason, type RegionMonths } from '@/lib/prepare/data'

const MONTHS = Array.from({ length: 12 }, (_, i) => i + 1)

/** Comfort 0-3 as fill strength (never colour alone: the cell's label carries the number). */
const COMFORT_BG = ['bg-transparent', 'bg-line-2', 'bg-line', 'bg-ph-3']

function monthName(m: number, locale: string, style: 'short' | 'narrow' = 'short') {
  return new Intl.DateTimeFormat(locale, { month: style, timeZone: 'UTC' }).format(new Date(Date.UTC(2000, m - 1, 1)))
}

/**
 * "Best time to go" (spec §12): the southern seasons strip, then one row of 12 months per region with weather
 * comfort (fill), crowds (dots) and the recommended window (copper underline). Each cell has a full text label.
 */
export function BestTime({ regions }: { regions: RegionMonths[] }) {
  const t = useTranslations('prepare.seasons')
  const locale = useLocale()

  if (!regions.length) return <p className="text-[15px] text-ink-2">{t('empty')}</p>

  const seasonStart = (m: number) => m === 12 || m === 3 || m === 6 || m === 9

  return (
    <div>
      <p className="max-w-[640px] text-[17px] leading-[1.7] text-ink-2">{t('lede')}</p>
      <div className="mt-8 overflow-x-auto">
        <table className="w-full min-w-[720px] border-separate border-spacing-x-1 border-spacing-y-1.5 text-sm">
          <caption className="sr-only">{t('title')}</caption>
          <thead>
            <tr>
              <th scope="col" className="w-[220px] text-left font-normal">
                <span className="sr-only">{t('southern')}</span>
              </th>
              {MONTHS.map((m) => (
                <th key={m} scope="col" className="text-center text-[12px] font-medium text-ink-2">
                  {monthName(m, locale)}
                </th>
              ))}
            </tr>
            <tr>
              <th scope="row" className="eyebrow text-left font-normal text-ink-3">
                {t('southern')}
              </th>
              {MONTHS.map((m) => (
                <td key={m} className="text-center text-[11px] text-ink-2">
                  {seasonStart(m) ? t(`season.${southernSeason(m)}`) : ''}
                </td>
              ))}
            </tr>
          </thead>
          <tbody>
            {regions.map((r) => (
              <tr key={r.slug}>
                <th scope="row" className="pr-3 text-left align-middle font-normal">
                  <span className="block font-medium">{r.name}</span>
                  {r.bestMonths.length > 0 && (
                    <span className="block text-[12px] text-ink-2">{t('best', { months: formatBestMonths(r.bestMonths, locale) })}</span>
                  )}
                </th>
                {r.months.map((cell, i) => {
                  const month = monthName(i + 1, locale)
                  if (!cell) {
                    return <td key={i} aria-label={t('noData', { region: r.name, month })} className="h-9 rounded-[4px] border border-dashed border-line-2" />
                  }
                  const comfort = Math.max(0, Math.min(3, cell.comfort ?? 0))
                  const crowds = Math.max(0, Math.min(3, cell.crowds ?? 0))
                  const label = t(cell.recommended ? 'cellRecommended' : 'cell', { region: r.name, month, comfort, crowds })
                  return (
                    <td key={i} className={`h-9 rounded-[4px] align-middle ${COMFORT_BG[comfort]} ${cell.recommended ? 'shadow-[inset_0_-3px_0_var(--copper)]' : ''}`}>
                      <span className="sr-only">{label}</span>
                      <span aria-hidden="true" title={label} className="flex justify-center gap-[3px]">
                        {Array.from({ length: crowds }, (_, k) => (
                          <span key={k} className="size-[5px] rounded-full bg-ink" />
                        ))}
                      </span>
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <ul className="mt-5 flex flex-wrap gap-x-8 gap-y-2 text-[13px] text-ink-2">
        <li className="flex items-center gap-2">
          <span aria-hidden="true" className="flex gap-0.5">
            {COMFORT_BG.slice(1).map((c) => (
              <span key={c} className={`size-3 rounded-[2px] border border-line ${c}`} />
            ))}
          </span>
          {t('comfort')}
        </li>
        <li className="flex items-center gap-2">
          <span aria-hidden="true" className="flex gap-[3px]">
            <span className="size-[5px] rounded-full bg-ink" />
            <span className="size-[5px] rounded-full bg-ink" />
          </span>
          {t('crowds')}
        </li>
        <li className="flex items-center gap-2">
          <span aria-hidden="true" className="h-[3px] w-4 bg-copper" />
          {t('recommended')}
        </li>
      </ul>
    </div>
  )
}

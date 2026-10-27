'use client'

import { useLocale, useTranslations } from 'next-intl'
import { useId } from 'react'
import { formatMoney } from '@/lib/format/money'
import type { RouteOption } from '@/lib/routing/types'
import { formatClock, ModeStroke, useDurationText } from './route-legs'

/** "A$5–9", "A$4.20", or null when neither end is known (the caller shows "Check fare with operator"). */
export function fareRange(min: number | null, max: number | null, currency: string): string | null {
  const lo = min ?? max
  const hi = max ?? min
  if (lo === null || hi === null) return null
  if (lo === hi) return formatMoney(lo, currency)
  // Only the first figure carries the symbol, as in the design ("A$5–9").
  return `${formatMoney(lo, currency)}–${formatMoney(hi, currency).replace(/^[^\d]+/, '')}`
}

/**
 * The (up to 3) options as a radio group: arrow keys move between them, the checked one drives the legs panel.
 * Native radios keep keyboard and screen-reader behaviour; the card is their label.
 */
export function RouteOptions({
  options,
  selected,
  onSelect,
  timeZone,
}: {
  options: RouteOption[]
  selected: number
  onSelect: (index: number) => void
  timeZone: string
}) {
  const t = useTranslations('transport.results')
  const locale = useLocale()
  const duration = useDurationText()
  const name = useId()

  return (
    <fieldset className="flex flex-col gap-3">
      <legend className="eyebrow mb-3 text-ink-2">{t('count', { count: options.length })}</legend>
      {options.map((o, i) => {
        const fare = fareRange(o.fare_min, o.fare_max, o.currency) ?? t('checkFare')
        const total = o.legs.reduce((s, l) => s + Math.max(l.duration_min, 1), 0)
        return (
          <label
            key={i}
            className="flex cursor-pointer flex-col gap-2.5 rounded-lg border border-line bg-surface px-5 py-[18px] text-ink transition-[border-color,box-shadow] duration-500 ease-out hover:border-ink has-checked:border-copper has-checked:shadow-[inset_0_0_0_1px_var(--copper)] has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-copper"
          >
            <input
              type="radio"
              name={name}
              value={i}
              checked={selected === i}
              onChange={() => onSelect(i)}
              className="sr-only"
            />
            <span className="flex w-full items-baseline justify-between gap-3">
              <span className="text-xl font-semibold tabular-nums">
                {formatClock(o.depart, timeZone, locale)} – {formatClock(o.arrive, timeZone, locale)}
              </span>
              <span className="text-sm font-medium whitespace-nowrap">{duration(o.duration_min)}</span>
            </span>
            <span aria-hidden="true" className="flex w-full items-center gap-1">
              {o.legs.map((l, j) => (
                <span key={j} style={{ flex: Math.max(l.duration_min, 1) / total }} className="text-ink">
                  <ModeStroke mode={l.mode} />
                </span>
              ))}
            </span>
            <span className="flex w-full justify-between gap-3 text-[13px] text-ink-2">
              <span>{o.summary}</span>
              <span className="text-right">{fare}</span>
            </span>
          </label>
        )
      })}
    </fieldset>
  )
}

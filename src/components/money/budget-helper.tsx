'use client'

import { useTranslations } from 'next-intl'
import { useState } from 'react'
import { convert, formatHome } from '@/lib/fx/convert'
import type { BudgetPreset } from '@/lib/fx/queries'
import { formatMoney } from '@/lib/format/money'
import { PlaceholderTag } from './placeholder-tag'
import { Segmented } from './segmented'

type Style = BudgetPreset['style']
const STYLES: Style[] = ['budget', 'comfortable', 'luxury']
const MIN_DAYS = 3
const MAX_DAYS = 21

/** Trip length × daily style → a per-person total in A$ and NZ$, with the home-currency equivalent. */
export function BudgetHelper({ budgets, home, rates }: { budgets: BudgetPreset[]; home: string; rates: Record<string, number> | null }) {
  const t = useTranslations('money.budget')
  const [days, setDays] = useState(10)
  const [style, setStyle] = useState<Style>('comfortable')
  if (!budgets.length) return null

  const preset = (country: 'AU' | 'NZ') => budgets.find((b) => b.country === country && b.style === style)
  const au = preset('AU')
  const nz = preset('NZ')
  const note = (au ?? nz)?.note

  const card = (label: string, p: BudgetPreset | undefined, currency: 'AUD' | 'NZD') => (
    <div className="flex flex-col gap-2 rounded-[10px] border border-line-2 bg-surface p-6">
      <p className="eyebrow text-ink-2">{label}</p>
      <p className="text-[32px] font-medium tracking-[-0.01em]">{p ? formatMoney(p.perDay * days, currency) : '—'}</p>
      <p className="text-base text-ink-2">{p && rates ? t('approx', { amount: formatHome(convert(p.perDay * days, currency, home, rates), home) }) : '—'}</p>
      <p className="mt-auto border-t border-line-2 pt-2.5 text-xs text-ink-2">{p ? t('perDay', { amount: formatMoney(p.perDay, currency) }) : '—'}</p>
    </div>
  )

  return (
    <section aria-label={t('label')} className="mt-24 md:mt-[120px]">
      <div className="flex flex-wrap gap-12 rounded-xl border border-line p-[clamp(24px,3vw,44px)]">
        <div className="flex flex-1 basis-[380px] flex-col gap-7">
          <div>
            <p className="eyebrow text-copper">{t('eyebrow')}</p>
            <h2 className="mt-3 flex flex-wrap items-center gap-3 text-[clamp(24px,2.6vw,34px)] leading-[1.15] font-semibold">
              {t('title')}
              <PlaceholderTag />
            </h2>
            <p className="mt-2 text-sm leading-[1.6] text-ink-2">{t('text')}</p>
          </div>
          <div className="flex flex-col gap-2.5">
            <label htmlFor="budget-days" className="flex justify-between">
              <span className="eyebrow text-ink-2">{t('length')}</span>
              <span className="text-[15px] font-medium">{t('days', { n: days })}</span>
            </label>
            <input
              id="budget-days"
              type="range"
              min={MIN_DAYS}
              max={MAX_DAYS}
              step={1}
              value={days}
              onChange={(e) => setDays(Number(e.target.value))}
              className="h-7 w-full cursor-pointer accent-copper"
            />
            <span aria-hidden="true" className="flex justify-between text-xs text-ink-2">
              <span>{MIN_DAYS}</span>
              <span>{MAX_DAYS}</span>
            </span>
          </div>
          <div className="flex flex-col gap-2.5">
            <span className="eyebrow text-ink-2">{t('style')}</span>
            <Segmented label={t('styleLabel')} value={style} options={STYLES.map((s) => ({ value: s, label: t(`styles.${s}`) }))} onChange={setStyle} className="self-start" />
            {note ? <p className="text-[13px] text-ink-2">{note}</p> : null}
          </div>
        </div>
        <div className="grid flex-1 basis-[420px] grid-cols-[repeat(auto-fit,minmax(200px,1fr))] gap-5 tabular-nums">
          {card(t('inAu'), au, 'AUD')}
          {card(t('inNz'), nz, 'NZD')}
        </div>
      </div>
    </section>
  )
}

'use client'

import { useTranslations } from 'next-intl'
import { useEffect, useMemo, useRef, useState } from 'react'
import { track } from '@/lib/analytics/track'
import { HOME_CURRENCIES } from '@/lib/fx/constants'
import { convert, formatNumber, parseAmount } from '@/lib/fx/convert'
import { Segmented } from './segmented'

export type ConverterStatus = 'ready' | 'loading' | 'error'
type Target = 'aud' | 'nzd' | 'both'

const QUICK = ['1,000', '5,000', '10,000', '50,000']
const TRACK_DEBOUNCE_MS = 800

const digitsFor = (code: string) => (code === 'JPY' ? 0 : 2)

function HomeSelect({ home, onHome, label, className = '' }: { home: string; onHome: (code: string) => void; label: string; className?: string }) {
  return (
    <span className={`relative inline-flex ${className}`}>
      <select
        aria-label={label}
        value={home}
        onChange={(e) => onHome(e.target.value)}
        className="min-h-11 cursor-pointer appearance-none rounded-full border border-line bg-surface py-0 pr-9 pl-4 text-[15px] font-medium tracking-[.08em] text-ink max-md:min-h-10 max-md:pr-8 max-md:pl-3.5 max-md:text-[13px]"
      >
        {HOME_CURRENCIES.map((c) => (
          <option key={c} value={c}>
            {c}
          </option>
        ))}
      </select>
      <svg
        width="12"
        height="12"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        aria-hidden="true"
        className="pointer-events-none absolute top-1/2 right-3.5 -mt-1.5"
      >
        <path d="M6 9l6 6 6-6" />
      </svg>
    </span>
  )
}

function CodePill({ code }: { code: string }) {
  return (
    <span className="inline-flex min-h-11 items-center rounded-full border border-line px-4 text-[15px] font-medium tracking-[.08em] max-md:min-h-10 max-md:px-3.5 max-md:text-[13px]">
      {code}
    </span>
  )
}

/**
 * You have / You get. Everything is computed from the one snapshot already on the page: typing never
 * calls the network. Only a debounced `fx_convert` analytics event (currencies, never amounts) leaves.
 */
export function Converter({
  home,
  onHome,
  rates,
  status,
  banner,
  rateLine,
  onRetry,
}: {
  home: string
  onHome: (code: string) => void
  /** AUD-based rates of the snapshot on the page; null when none is saved. */
  rates: Record<string, number> | null
  status: ConverterStatus
  /** Error/stale banner copy (title + text), or null. */
  banner: { title: string; text: string } | null
  /** Already formatted "1 AUD = … · 1 NZD = … · Updated …" line. */
  rateLine: string | null
  onRetry: () => void
}) {
  const t = useTranslations('money')
  const [amountStr, setAmountStr] = useState('10,000')
  const [target, setTarget] = useState<Target>('both')
  const [swapped, setSwapped] = useState(false)

  const ready = status === 'ready' && rates !== null
  const showResults = rates !== null && status !== 'loading'
  const amount = parseAmount(amountStr)

  const haveCode = swapped ? (target === 'nzd' ? 'NZD' : 'AUD') : home
  const outCodes = useMemo(
    () => (swapped ? (target === 'both' ? [home, 'NZD'] : [home]) : target === 'both' ? ['AUD', 'NZD'] : [target.toUpperCase()]),
    [swapped, target, home],
  )
  const results = outCodes.map((code) => ({ code, value: rates ? convert(amount, haveCode, code, rates) : NaN }))

  // Analytics only: debounced, skips the first render, carries currencies and no amounts.
  const first = useRef(true)
  useEffect(() => {
    if (first.current) {
      first.current = false
      return
    }
    if (!ready) return
    const id = setTimeout(() => track('fx_convert', { from: haveCode, to: outCodes.join('+') }), TRACK_DEBOUNCE_MS)
    return () => clearTimeout(id)
  }, [amountStr, haveCode, outCodes, ready])

  const targets: { value: Target; label: string }[] = [
    { value: 'aud', label: 'AUD' },
    { value: 'nzd', label: 'NZD' },
    { value: 'both', label: t('converter.both') },
  ]
  const two = results.length > 1

  return (
    <div className="max-md:sticky max-md:top-[65px] max-md:z-10 max-md:-mx-4 max-md:border-y max-md:border-line max-md:bg-bg max-md:px-4 max-md:py-3 max-md:shadow-soft md:rounded-xl md:border md:border-line md:bg-surface md:p-9 md:shadow-soft lg:px-10">
      <div className="flex flex-wrap items-center justify-between gap-3 md:gap-5">
        <Segmented label={t('converter.target')} value={target} options={targets} onChange={setTarget} />
        <div role="group" aria-label={t('converter.quickLabel')} className="flex items-center gap-2 max-md:hidden">
          <span className="eyebrow mr-1.5 text-ink-2">{t('converter.quick')}</span>
          {QUICK.map((v) => (
            <button
              key={v}
              type="button"
              aria-pressed={amountStr === v}
              onClick={() => setAmountStr(v)}
              className={`min-h-10 cursor-pointer rounded-full border px-4 text-[13px] whitespace-nowrap transition-colors duration-500 ease-out ${
                amountStr === v ? 'border-copper bg-copper-tint font-medium text-copper' : 'border-line text-ink-2 hover:border-ink hover:text-ink'
              }`}
            >
              {v}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-3 flex flex-col md:mt-8 md:flex-row md:items-stretch md:border-t md:border-line-2">
        <label className="flex min-w-0 flex-1 flex-col gap-1 md:gap-3.5 md:py-7 md:pr-8">
          <span className="eyebrow text-ink-2 max-md:text-[10px]">
            {t('converter.have')}
            <span className="md:hidden"> · {haveCode}</span>
          </span>
          <span className="flex items-center gap-3 md:gap-4">
            <input
              inputMode="decimal"
              maxLength={14}
              aria-label={t('converter.amount')}
              value={amountStr}
              onChange={(e) => setAmountStr(e.target.value.replace(/[^0-9.,]/g, ''))}
              className="w-full min-w-0 bg-transparent text-[30px] font-light tracking-[-0.02em] text-ink tabular-nums outline-none md:text-[clamp(34px,4vw,52px)]"
            />
            {swapped ? <CodePill code={haveCode} /> : <HomeSelect home={home} onHome={onHome} label={t('converter.home')} />}
            <button
              type="button"
              aria-label={t('converter.swap')}
              onClick={() => setSwapped((s) => !s)}
              className="inline-flex size-10 shrink-0 cursor-pointer items-center justify-center rounded-full border border-line bg-surface text-ink transition-colors duration-500 ease-out hover:border-ink md:hidden"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
                <path d="M7 4v16M4 7l3-3 3 3M17 20V4M14 17l3 3 3-3" />
              </svg>
            </button>
          </span>
          <span className="text-[13px] text-ink-2 max-md:hidden">{t(`currency.${haveCode}`)}</span>
        </label>

        <div className="relative flex w-[72px] flex-none items-center justify-center max-md:hidden">
          <span aria-hidden="true" className="absolute top-0 bottom-0 left-1/2 w-px bg-line-2" />
          <button
            type="button"
            aria-label={t('converter.swap')}
            onClick={() => setSwapped((s) => !s)}
            className={`relative inline-flex size-[52px] cursor-pointer items-center justify-center rounded-full border border-line bg-surface text-ink transition-[border-color,transform] duration-700 ease-out hover:border-ink ${swapped ? 'rotate-180' : ''}`}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" aria-hidden="true">
              <path d="M4 8h16M16 4l4 4-4 4M20 16H4M8 12l-4 4 4 4" />
            </svg>
          </button>
        </div>

        <div className="mt-2 flex min-w-0 flex-1 flex-col gap-1 border-t border-line-2 pt-2 md:mt-0 md:gap-3.5 md:border-t-0 md:py-7 md:pl-8">
          <span className="eyebrow text-ink-2 max-md:text-[10px]">{t('converter.get')}</span>
          {status === 'loading' ? (
            <div aria-busy="true" aria-label={t('converter.loading')} className="flex flex-col gap-3.5">
              <div className="h-8 w-3/4 animate-pulse rounded-sm bg-ink/10 md:h-14" />
              <div className="h-3.5 w-2/5 animate-pulse rounded-sm bg-ink/10 max-md:hidden" />
            </div>
          ) : null}
          {showResults ? (
            <div aria-live="polite" className="flex gap-6 md:gap-8">
              {results.map((r) => (
                <div key={r.code} className="flex min-w-0 flex-1 flex-col gap-1 md:gap-3.5">
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
                    <span
                      className={`font-medium tracking-[-0.02em] tabular-nums ${
                        two ? 'text-xl md:text-[clamp(26px,2.6vw,36px)]' : 'text-[28px] md:text-[clamp(34px,4vw,52px)]'
                      }`}
                    >
                      {formatNumber(r.value, digitsFor(r.code))}
                    </span>
                    {swapped && r.code === home ? <HomeSelect home={home} onHome={onHome} label={t('converter.home')} className="max-md:hidden" /> : <CodePill code={r.code} />}
                  </div>
                  <span className="text-[13px] text-ink-2 max-md:hidden">{t(`currency.${r.code}`)}</span>
                </div>
              ))}
            </div>
          ) : null}
          {status !== 'loading' && !showResults ? (
            <p className="text-sm text-ink-2 md:text-[15px]">
              {t('converter.unavailable')}{' '}
              <button type="button" onClick={onRetry} className="min-h-8 cursor-pointer font-medium text-copper">
                {t('converter.retry')}
              </button>
            </p>
          ) : null}
        </div>
      </div>

      {banner ? (
        <div role="alert" className="mt-3 flex items-start gap-3.5 rounded-lg border border-line px-[18px] py-4 md:mt-0">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" aria-hidden="true" className="mt-0.5 flex-none">
            <path d="M12 3l9 16H3z" />
            <path d="M12 10v4M12 17v.5" />
          </svg>
          <div className="flex-1">
            <p className="text-[15px] font-medium">{banner.title}</p>
            <p className="mt-1 text-[13px] leading-[1.6] text-ink-2">{banner.text}</p>
          </div>
          <button
            type="button"
            onClick={onRetry}
            className="inline-flex min-h-11 cursor-pointer items-center rounded-[6px] border border-line px-5 text-sm font-medium text-ink hover:border-ink"
          >
            {t('converter.retry')}
          </button>
        </div>
      ) : null}

      <div className="mt-2 flex flex-wrap items-center justify-between gap-3 md:mt-0 md:gap-4 md:border-t md:border-line-2 md:pt-[18px]">
        {status === 'loading' ? (
          <div className="h-3.5 w-[380px] max-w-full animate-pulse rounded-sm bg-ink/10" />
        ) : rateLine ? (
          <p className="text-[11px] text-ink-2 tabular-nums md:text-[13px]">{rateLine}</p>
        ) : (
          <span />
        )}
        <p className="text-xs text-ink-2 max-md:hidden">{t('converter.midMarket')}</p>
      </div>
    </div>
  )
}

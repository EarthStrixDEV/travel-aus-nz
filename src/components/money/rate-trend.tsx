'use client'

import { useLocale, useTranslations } from 'next-intl'
import { useEffect, useState } from 'react'
import { formatDay } from '@/lib/fx/format'
import { formatNumber } from '@/lib/fx/convert'
import type { History, HistoryRange } from '@/lib/fx/history'
import { INITIAL_TREND } from '@/lib/fx/initial-trend'
import type { Locale } from '@/lib/i18n/t'
import { Segmented } from './segmented'

type Base = 'AUD' | 'NZD'
const RANGES: HistoryRange[] = ['7d', '1m', '3m', '1y']

const W = 1000
const H = 300
const PAD = 24

function Chart({ history, home, base, range, locale }: { history: History; home: string; base: Base; range: HistoryRange; locale: Locale }) {
  const t = useTranslations('money.trend')
  const [hover, setHover] = useState<number | null>(null)
  const { points, high, low, change } = history
  const n = points.length
  const last = points[n - 1].close
  const dp = last < 10 ? 4 : 2
  const max = high as number
  const min = low as number
  const span = max - min || 1
  const yMax = max + span * 0.08
  const yMin = min - span * 0.08
  const ys = yMax - yMin
  const x = (i: number) => (n === 1 ? W / 2 : (i / (n - 1)) * W)
  const y = (v: number) => PAD + ((yMax - v) / ys) * (H - 2 * PAD)
  const line = points.map((p, i) => `${x(i).toFixed(1)},${y(p.close).toFixed(1)}`).join(' ')
  const area = `0,${H} ${line} ${W},${H}`

  const pct = `${(change as number) >= 0 ? '+' : '−'}${formatNumber(Math.abs(change as number))}%`
  const summary = t('chart', {
    pair: base,
    home,
    range: t(`rangeName.${range}`),
    now: formatNumber(last, dp),
    change: pct,
    high: formatNumber(max, dp),
    low: formatNumber(min, dp),
  })
  const hp = hover !== null ? points[Math.min(hover, n - 1)] : null
  const hx = hover !== null ? (x(Math.min(hover, n - 1)) / W) * 100 : 0
  const hy = hp ? (y(hp.close) / H) * 100 : 0

  function onMove(e: React.PointerEvent<HTMLDivElement>) {
    const box = e.currentTarget.getBoundingClientRect()
    const ratio = Math.min(1, Math.max(0, (e.clientX - box.left) / box.width))
    setHover(Math.round(ratio * (n - 1)))
  }

  const stats: [string, string, boolean][] = [
    [t('now'), formatNumber(last, dp), true],
    [t('change'), pct, true],
    [t('high'), formatNumber(max, dp), false],
    [t('low'), formatNumber(min, dp), false],
  ]

  return (
    <>
      <dl className="flex flex-wrap gap-x-12 gap-y-4 py-6 tabular-nums">
        {stats.map(([label, value, strong]) => (
          <div key={label}>
            <dt className="eyebrow text-ink-2">{label}</dt>
            <dd className={`mt-1.5 text-2xl ${strong ? 'font-medium' : 'font-light'}`}>{value}</dd>
          </div>
        ))}
      </dl>
      <figure className="m-0 flex gap-4">
        <div className="relative h-[340px] flex-1" onPointerMove={onMove} onPointerLeave={() => setHover(null)}>
          <div aria-hidden="true" className="absolute inset-0 flex flex-col justify-between py-6">
            <span className="border-t border-line-2" />
            <span className="border-t border-line-2" />
            <span className="border-t border-line-2" />
          </div>
          <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" role="img" aria-label={summary} className="absolute inset-0 size-full overflow-visible">
            <polygon points={area} style={{ fill: 'var(--line2)' }} />
            <polyline
              points={line}
              style={{ fill: 'none', stroke: 'var(--ink)', strokeWidth: 1.6, vectorEffect: 'non-scaling-stroke', strokeLinejoin: 'round' }}
            />
          </svg>
          <span
            aria-hidden="true"
            className="absolute size-3 -translate-x-1/2 -translate-y-1/2 rounded-full bg-copper shadow-[0_0_0_6px_var(--copper-tint)]"
            style={{ left: `${(x(n - 1) / W) * 100}%`, top: `${(y(last) / H) * 100}%` }}
          />
          {hp ? (
            <>
              <span aria-hidden="true" className="absolute top-0 bottom-0 border-l border-line" style={{ left: `${hx}%` }} />
              <span
                aria-hidden="true"
                className="absolute size-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-ink bg-surface"
                style={{ left: `${hx}%`, top: `${hy}%` }}
              />
              <div
                aria-hidden="true"
                className="pointer-events-none absolute rounded-md bg-ink px-3 py-2 whitespace-nowrap text-bg tabular-nums"
                style={{
                  left: `${hx}%`,
                  top: `${hy}%`,
                  transform: `translate(${hx > 75 ? '-100%' : hx < 20 ? '0%' : '-50%'}, -130%)`,
                }}
              >
                <p className="text-[11px] opacity-80">{formatDay(hp.day, locale)}</p>
                <p className="text-[15px] font-medium">
                  {formatNumber(hp.close, dp)} {home}
                </p>
              </div>
            </>
          ) : null}
        </div>
        <div aria-hidden="true" className="flex w-16 flex-col justify-between py-3.5 text-xs text-ink-2 tabular-nums">
          <span>{formatNumber(yMax - (ys * PAD) / H, dp)}</span>
          <span>{formatNumber((yMax + yMin) / 2, dp)}</span>
          <span>{formatNumber(yMin + (ys * PAD) / H, dp)}</span>
        </div>
      </figure>
      <div aria-hidden="true" className="mt-2.5 flex justify-between pr-20 text-xs text-ink-2 tabular-nums">
        <span>{formatDay(points[0].day, locale)}</span>
        <span>{formatDay(points[n - 1].day, locale)}</span>
      </div>
    </>
  )
}

/** AUD or NZD in the home currency over 7D / 1M / 3M / 1Y. The default view ships with the page; others load once and are kept. */
export function RateTrend({ home, initial }: { home: string; initial: History | null }) {
  const t = useTranslations('money.trend')
  const retryLabel = useTranslations('money.converter')('retry')
  const locale = useLocale() as Locale
  const [base, setBase] = useState<Base>('AUD')
  const [range, setRange] = useState<HistoryRange>('1m')
  const [cache, setCache] = useState<Record<string, History>>(
    initial ? { [`${INITIAL_TREND.base}-${INITIAL_TREND.quote}|${INITIAL_TREND.range}`]: initial } : {},
  )
  const [failed, setFailed] = useState(false)
  const [attempt, setAttempt] = useState(0)

  const key = `${base}-${home}|${range}`
  const history = cache[key]
  const has = history !== undefined

  useEffect(() => {
    if (has) return
    const ctrl = new AbortController()
    setFailed(false)
    fetch(`/api/v1/fx/history?pair=${base}-${home}&range=${range}`, { signal: ctrl.signal })
      .then((res) => (res.ok ? (res.json() as Promise<History>) : Promise.reject(new Error(String(res.status)))))
      .then((data) => setCache((c) => ({ ...c, [key]: data })))
      .catch((err) => {
        if (!ctrl.signal.aborted) {
          console.error('[rate-trend] history failed', err)
          setFailed(true)
        }
      })
    return () => ctrl.abort()
  }, [has, key, base, home, range, attempt])

  const pairs: { value: Base; label: string }[] = [
    { value: 'AUD', label: 'AUD' },
    { value: 'NZD', label: 'NZD' },
  ]
  const ranges = RANGES.map((r) => ({ value: r, label: t(`range.${r}`) }))

  return (
    <section aria-label={t('label')} className="mt-24 md:mt-[120px]">
      <div className="flex flex-wrap items-end justify-between gap-6 border-b border-line pb-6">
        <div>
          <p className="eyebrow text-copper">{t('eyebrow')}</p>
          <h2 className="mt-3 text-[clamp(26px,3vw,40px)] leading-[1.1] font-semibold">{t('title', { pair: base, home })}</h2>
        </div>
        <div className="flex flex-wrap gap-3">
          <Segmented label={t('pair')} value={base} options={pairs} onChange={setBase} />
          <Segmented label={t('period')} value={range} options={ranges} onChange={setRange} />
        </div>
      </div>

      {history && history.points.length ? (
        <Chart history={history} home={home} base={base} range={range} locale={locale} />
      ) : history ? (
        <p className="py-10 text-[15px] text-ink-2">{t('empty')}</p>
      ) : failed ? (
        <p role="alert" className="py-10 text-[15px] text-ink-2">
          {t('error')}{' '}
          <button type="button" onClick={() => setAttempt((a) => a + 1)} className="min-h-8 cursor-pointer font-medium text-copper">
            {retryLabel}
          </button>
        </p>
      ) : (
        <div aria-busy="true" aria-label={t('loading')} className="mt-6 h-[340px] animate-pulse rounded-lg bg-ink/10" />
      )}
    </section>
  )
}

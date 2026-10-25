import { useTranslations } from 'next-intl'
import type { CSSProperties } from 'react'
import { Link } from '@/i18n/navigation'
import type { RouteShowcase } from '@/lib/content/home'
import type { JourneyLeg } from '@/lib/content/journeys'
import { formatDuration, formatMoney } from '@/lib/format/money'

// Design colours for the dark band (copper on --deep needs the lighter tone in both themes).
const ACCENT = 'border-[#D08A5E]'

/** Line style per mode: rail solid, bus/coach dashed, ferry dotted (matches the legend). */
function lineStyle(mode: JourneyLeg['mode']): string {
  if (mode === 'bus' || mode === 'coach') return 'border-dashed'
  if (mode === 'ferry') return 'border-dotted'
  return 'border-solid'
}

function Legend({ style, label }: { style: string; label: string }) {
  return (
    <span className="flex items-center gap-2">
      <span aria-hidden="true" className={`w-7 border-t-2 border-current ${style}`} />
      {label}
    </span>
  )
}

/** "Car-free, by design" band with the route showcase journey (`journeys.kind = 'route_showcase'`). */
export function CarFreeWidget({ showcase }: { showcase: RouteShowcase | null }) {
  const t = useTranslations('home.carFree')
  const tMode = useTranslations('home.mode')

  const duration = (min: number) => {
    const { h, m } = formatDuration(min)
    return h > 0 ? t('durationHm', { h, m, mm: String(m).padStart(2, '0') }) : t('durationM', { m })
  }

  const legs = showcase?.legs ?? []
  const last = legs[legs.length - 1]

  return (
    <section aria-label={t('section')} className="mt-20 bg-deep text-on-deep md:mt-40">
      <div className="mx-auto flex max-w-[1440px] flex-wrap items-center gap-12 px-[clamp(16px,4vw,56px)] py-14 md:gap-16 md:py-[120px]">
        <div className="max-w-[520px] flex-[1_1_420px]">
          <p className="eyebrow mb-3 text-[#D08A5E] md:mb-[18px]">{t('eyebrow')}</p>
          <h2 className="text-[30px] leading-[1.12] font-semibold tracking-[-0.015em] md:text-[clamp(32px,3.4vw,48px)] md:leading-[1.1]">{t('title')}</h2>
          <p className="mt-4 text-[15px] leading-[1.65] text-on-deep/80 md:mt-[22px] md:text-[17px] md:leading-[1.7]">{t('body')}</p>
          <div className="mt-5 flex flex-wrap gap-3 md:mt-9">
            <Link
              href="/transport"
              className="inline-flex min-h-11 items-center justify-center rounded-[6px] border border-transparent bg-[#D08A5E] px-[22px] text-sm font-medium text-[#0E1729] transition-[filter] duration-500 hover:brightness-107"
            >
              {t('plan')}
            </Link>
            <Link
              href="/map"
              className="inline-flex min-h-11 items-center justify-center rounded-[6px] border border-on-deep/30 px-[22px] text-sm font-medium text-on-deep transition-[border-color] duration-500 hover:border-on-deep"
            >
              {t('map')}
            </Link>
          </div>
        </div>

        {showcase && legs.length > 0 && last && (
          <div className="flex-[1_1_560px] rounded-[10px] border border-on-deep/15 p-5 md:p-9">
            <div className="flex flex-wrap items-baseline justify-between gap-3">
              <p className="text-lg font-medium">{showcase.title}</p>
              {showcase.priceFrom !== null && showcase.currency && (
                <p className="text-[13px] text-on-deep/70">{t('fareFrom', { price: formatMoney(showcase.priceFrom, showcase.currency) })}</p>
              )}
            </div>

            <ol aria-label={t('route')} className="mt-6 flex flex-col md:mt-7 md:flex-row">
              {legs.map((leg) => (
                <li
                  key={leg.seq}
                  style={{ '--g': leg.durationMin ?? 30 } as CSSProperties}
                  className="flex gap-3.5 md:min-w-0 md:basis-0 md:grow-[var(--g)] md:flex-col md:gap-2.5"
                >
                  <span className="eyebrow hidden tracking-[.16em] text-on-deep/70 md:block">{tMode(leg.mode)}</span>
                  <div aria-hidden="true" className="flex flex-col items-center md:flex-row">
                    <span className={`size-3.5 shrink-0 rounded-full border-2 bg-[#0A1222] ${ACCENT}`} />
                    <span className={`min-h-10 flex-1 border-l-[3px] md:min-h-0 md:border-t-[3px] md:border-l-0 ${ACCENT} ${lineStyle(leg.mode)}`} />
                  </div>
                  <div className="pb-3.5 md:pb-0 md:pt-1">
                    <p className="text-sm font-medium">{leg.from}</p>
                    <p className="text-xs text-on-deep/70">
                      <span className="md:hidden">{tMode(leg.mode)} · </span>
                      {[leg.operator, leg.frequency, leg.durationMin ? duration(leg.durationMin) : null].filter(Boolean).join(' · ')}
                    </p>
                  </div>
                </li>
              ))}
              <li className="flex gap-3.5 md:flex-col md:items-end md:gap-2.5 md:text-right">
                <span aria-hidden="true" className="eyebrow invisible hidden md:block">·</span>
                <span aria-hidden="true" className="size-3.5 shrink-0 rounded-full bg-[#D08A5E]" />
                <p className="text-sm font-medium md:pt-1">{last.to}</p>
              </li>
            </ol>

            <div className="mt-2 flex flex-wrap gap-x-7 gap-y-2 border-t border-on-deep/15 pt-[18px] text-xs text-on-deep/80">
              <Legend style="border-solid" label={t('rail')} />
              <Legend style="border-dashed" label={t('bus')} />
              <Legend style="border-dotted" label={t('ferry')} />
              {showcase.line && <span className="md:ml-auto">{showcase.line}</span>}
            </div>
          </div>
        )}
      </div>
    </section>
  )
}

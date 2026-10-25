import { useTranslations } from 'next-intl'
import { buttonClass } from '@/components/ui/button'
import { Link } from '@/i18n/navigation'
import type { JourneyCard } from '@/lib/content/journeys'
import { formatMoney } from '@/lib/format/money'
import { MediaImage } from './media-image'

function ArrowRight() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" aria-hidden="true">
      <path d="M5 12h14M13 6l6 6-6 6" />
    </svg>
  )
}

/** Curated journeys grid (spec §4: journeys, itineraries only). */
export function JourneyCards({ journeys }: { journeys: JourneyCard[] }) {
  const t = useTranslations('home.journeys')
  const tMode = useTranslations('home.mode')
  const tRegions = useTranslations('home.regions')
  if (journeys.length === 0) return null

  return (
    <section aria-label={t('section')} className="mx-auto max-w-[1440px] px-[clamp(16px,4vw,56px)] pt-20 md:pt-40">
      <div className="flex flex-wrap items-end justify-between gap-6 border-b border-line pb-7">
        <div>
          <p className="eyebrow mb-4 text-copper">{t('eyebrow')}</p>
          <h2 className="text-[28px] leading-[1.15] font-semibold tracking-[-0.015em] md:text-[clamp(30px,3.2vw,46px)] md:leading-[1.1]">{t('title')}</h2>
        </div>
        <Link href="/transport" className={buttonClass('ghost')}>
          {t('all')}
          <ArrowRight />
        </Link>
      </div>

      <ul className="mt-7 grid gap-9 md:mt-10 md:grid-cols-[repeat(auto-fit,minmax(320px,1fr))] md:gap-10">
        {journeys.map((j) => {
          const modes = [...new Set(j.modes)].map((m) => tMode(m)).join(' · ')
          const meta = [j.country ? tRegions(j.country) : null, modes].filter(Boolean).join(' · ')
          return (
            <li key={j.slug}>
              <Link href={`/transport?journey=${encodeURIComponent(j.slug)}`} className="group flex flex-col gap-3 text-ink hover:text-ink md:gap-[22px]">
                <div className="relative aspect-[4/3] overflow-hidden rounded-lg bg-ph-2">
                  <div className="absolute inset-0 bg-ph-3 transition-transform duration-[1800ms] ease-[cubic-bezier(.2,.6,.2,1)] group-hover:scale-[1.035]">
                    <MediaImage media={j.image} />
                  </div>
                </div>
                <div className="flex flex-col gap-3">
                  {meta && <p className="eyebrow text-ink-2">{meta}</p>}
                  <h3 className="text-[21px] leading-[1.25] font-semibold md:text-2xl">{j.title}</h3>
                  {j.line && <p className="text-[15px] leading-[1.65] text-ink-2">{j.line}</p>}
                </div>
                {(j.from || j.to) && (
                  <div>
                    <div aria-hidden="true" className="flex items-center py-1.5">
                      <span className="size-[9px] shrink-0 rounded-full border-[1.5px] border-ink bg-bg" />
                      <span className="h-px flex-1 bg-ink" />
                      <span className="size-[9px] shrink-0 rounded-full border-[1.5px] border-ink bg-bg" />
                    </div>
                    <p className="mt-1 flex justify-between gap-4 text-xs text-ink-2">
                      <span>{j.from}</span>
                      <span>{j.to}</span>
                    </p>
                  </div>
                )}
                <div className="flex items-center justify-between gap-4 border-t border-line-2 pt-4">
                  <span className="text-sm text-ink-2">
                    {j.priceFrom !== null && j.currency
                      ? t.rich('from', {
                          price: formatMoney(j.priceFrom, j.currency),
                          b: (c) => <span className="font-medium text-ink">{c}</span>,
                        })
                      : null}
                  </span>
                  <span className="text-sm font-medium whitespace-nowrap text-copper">{t('view')}</span>
                </div>
              </Link>
            </li>
          )
        })}
      </ul>
    </section>
  )
}

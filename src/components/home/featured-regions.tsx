'use client'

import { useLocale, useTranslations } from 'next-intl'
import { useState } from 'react'
import { Link } from '@/i18n/navigation'
import type { HomeRegion } from '@/lib/content/home'
import type { Country } from '@/lib/content/shared'
import { formatBestMonths } from '@/lib/format/months'
import { MediaImage } from './media-image'

type Size = 'large' | 'wide' | 'small'

const PHOTO: Record<Size, string> = {
  large: 'h-[720px] rounded-lg',
  wide: 'h-[340px] rounded-lg',
  small: 'h-[260px] rounded-lg',
}

function RegionCard({ region, size, rail = false }: { region: HomeRegion; size: Size; rail?: boolean }) {
  const t = useTranslations('home.regions')
  const locale = useLocale()
  const best = formatBestMonths(region.bestMonths, locale)
  const bestTag = best && (
    <span className="whitespace-nowrap rounded-full border border-line px-2.5 py-1 text-xs font-normal text-ink-2">{t('best', { range: best })}</span>
  )

  return (
    <Link
      href={`/gallery?region=${encodeURIComponent(region.slug)}`}
      className={`group flex flex-col text-ink hover:text-ink ${rail ? 'gap-3' : size === 'large' ? 'gap-5' : size === 'wide' ? 'gap-4' : 'gap-3.5'}`}
    >
      <div className={`relative overflow-hidden bg-ph-2 ${rail ? 'h-[380px] rounded-lg' : PHOTO[size]}`}>
        <div className="absolute inset-0 bg-ph-3 transition-transform duration-[1800ms] ease-[cubic-bezier(.2,.6,.2,1)] group-hover:scale-[1.035]">
          <MediaImage media={region.image} />
        </div>
      </div>
      <div className={size === 'small' || rail ? '' : 'flex items-start justify-between gap-6'}>
        <div>
          {region.state && <p className="eyebrow text-ink-2">{region.state}</p>}
          <h3
            className={`mt-1.5 font-semibold ${rail ? 'text-[22px]' : size === 'large' ? 'mt-2 text-4xl tracking-[-0.01em]' : size === 'wide' ? 'text-[26px]' : 'text-[22px]'}`}
          >
            {region.name}
          </h3>
          {region.lede && (
            <p className={`mt-2 leading-[1.65] text-ink-2 ${size === 'large' ? 'max-w-[460px] text-base' : size === 'wide' ? 'text-[15px]' : 'text-sm'} ${rail ? 'text-sm' : ''}`}>
              {region.lede}
            </p>
          )}
        </div>
        {size !== 'small' && !rail && bestTag}
      </div>
      {(size === 'small' || rail) && best && <div>{bestTag}</div>}
    </Link>
  )
}

/** Featured regions with an AU / NZ switch. Both payloads are preloaded, so switching never hits the network. */
export function FeaturedRegions({ regions }: { regions: Record<Country, HomeRegion[]> }) {
  const t = useTranslations('home.regions')
  const [country, setCountry] = useState<Country>('au')
  const list = regions[country]
  const [large, wide, ...small] = list

  return (
    <>
      <section className="mx-auto flex max-w-[1440px] flex-wrap items-end justify-between gap-8 px-[clamp(16px,4vw,56px)] pt-14 pb-6 md:pt-[120px] md:pb-14">
        <div className="max-w-[640px]">
          <p className="eyebrow mb-3 text-copper md:mb-4">{t('eyebrow')}</p>
          <h2 className="text-[30px] leading-[1.12] font-semibold tracking-[-0.015em] md:text-[clamp(32px,3.6vw,52px)]">{t(country)}</h2>
        </div>
        <div role="group" aria-label={t('chooseCountry')} className="inline-flex rounded-full border border-line p-[3px] max-md:w-full">
          {(['au', 'nz'] as const).map((c) => (
            <button
              key={c}
              type="button"
              aria-pressed={country === c}
              onClick={() => setCountry(c)}
              className={`min-h-11 cursor-pointer rounded-full px-[22px] text-sm font-medium transition-[background-color,color] duration-[600ms] max-md:flex-1 ${country === c ? 'bg-ink text-bg' : 'text-ink-2 hover:text-ink'}`}
            >
              {t(c)}
            </button>
          ))}
        </div>
      </section>

      {list.length === 0 ? (
        <p className="mx-auto max-w-[1440px] px-[clamp(16px,4vw,56px)] text-ink-2">{t('empty')}</p>
      ) : (
        <>
          {/* Mobile: horizontal rail, no slider */}
          <div
            role="region"
            aria-label={t('list')}
            tabIndex={0}
            className="flex snap-x snap-mandatory gap-3.5 overflow-x-auto px-[clamp(16px,4vw,56px)] [scrollbar-width:none] lg:hidden [&::-webkit-scrollbar]:hidden"
          >
            {list.map((r) => (
              <div key={r.slug} className="shrink-0 basis-[300px] snap-start">
                <RegionCard region={r} size="small" rail />
              </div>
            ))}
          </div>

          {/* Desktop: large + wide + small */}
          <section aria-label={t('list')} className="mx-auto hidden max-w-[1440px] gap-6 px-[clamp(16px,4vw,56px)] lg:flex">
            {large && (
              <div className="flex-[1_1_520px]">
                <RegionCard region={large} size="large" />
              </div>
            )}
            {wide && (
              <div className="flex flex-[1_1_520px] flex-col gap-6">
                <RegionCard region={wide} size="wide" />
                {small.length > 0 && (
                  <div className="flex flex-wrap gap-6">
                    {small.map((r) => (
                      <div key={r.slug} className="flex-[1_1_240px]">
                        <RegionCard region={r} size="small" />
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </section>
        </>
      )}
    </>
  )
}

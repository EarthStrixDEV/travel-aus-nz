'use client'

import { useSearchParams } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { useState } from 'react'
import { usePathname, useRouter, Link } from '@/i18n/navigation'
import { pickVenueRegion, type RegionVenues } from '@/lib/dishes/filter'

/**
 * "Where to try it": up to three venues for one region with their nearest stop. The region comes from
 * `?region=` (a deep link from the filtered catalog), else the dish's home region (see `pickVenueRegion`).
 * Without `onRegion` (the server fallback, no search params yet) there is no region switcher.
 */
function Venues({ groups, home, region, onRegion }: { groups: RegionVenues[]; home: string | null; region?: string; onRegion?: (slug: string) => void }) {
  const t = useTranslations('dishes.detail')
  const shown = pickVenueRegion(groups, region, home)
  const choices = groups.filter((g) => g.venues.length > 0)

  if (!shown) return <p className="text-[15px] text-ink-2">{t('noVenues')}</p>

  return (
    <>
      {onRegion && choices.length > 1 && (
        <label className="mb-5 flex items-center gap-2 text-[13px] text-ink-2">
          <span className="eyebrow">{t('region')}</span>
          <select
            value={shown.region.slug}
            onChange={(e) => onRegion(e.target.value)}
            className="min-h-11 cursor-pointer rounded-full border border-line bg-transparent px-3 text-[13px] text-ink"
          >
            {choices.map((g) => (
              <option key={g.region.slug} value={g.region.slug}>
                {g.region.name}
              </option>
            ))}
          </select>
        </label>
      )}
      <ol aria-live="polite" className="flex flex-col">
        {shown.venues.map((v, i) => (
          <li key={v.slug} className="flex items-start gap-4 border-t border-line-2 py-4">
            <span aria-hidden="true" className="mt-0.5 flex size-7 flex-none items-center justify-center rounded-full border border-ink text-[13px] font-medium">
              {i + 1}
            </span>
            <div className="min-w-0 flex-1">
              <p className="font-medium">{v.name}</p>
              <p className="text-sm text-ink-2">{[v.area, v.priceText].filter(Boolean).join(' · ')}</p>
              {v.note && <p className="mt-1 text-sm text-ink-2">{v.note}</p>}
              {v.stop && <p className="mt-1 text-[13px] text-ink-3">{t('walk', { stop: v.stop.name, min: v.stop.walkMin })}</p>}
            </div>
            <Link
              href={`/map?place=${encodeURIComponent(v.slug)}`}
              aria-label={t('openMapFor', { name: v.name })}
              className="flex min-h-11 flex-none items-center text-[13px] text-copper hover:underline"
            >
              {t('openMap')}
            </Link>
          </li>
        ))}
      </ol>
    </>
  )
}

export function WhereToTryFallback({ groups, home }: { groups: RegionVenues[]; home: string | null }) {
  return <Venues groups={groups} home={home} />
}

export function WhereToTry({ groups, home }: { groups: RegionVenues[]; home: string | null }) {
  const router = useRouter()
  const pathname = usePathname()
  const fromUrl = useSearchParams().get('region') ?? undefined
  const [region, setRegion] = useState(fromUrl)

  function onRegion(slug: string) {
    setRegion(slug)
    router.replace(`${pathname}?region=${encodeURIComponent(slug)}`, { scroll: false })
  }

  return <Venues groups={groups} home={home} region={region} onRegion={onRegion} />
}

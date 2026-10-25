'use client'

import { useTranslations } from 'next-intl'
import { useSavedPlaces } from '@/components/trip/use-saved-places'
import { buttonClass } from '@/components/ui/button'
import { Link } from '@/i18n/navigation'
import type { DiningEdit as DiningEditData, DiningVenue } from '@/lib/content/home'

function Price({ level }: { level: number }) {
  const t = useTranslations('home.dining')
  if (level <= 0) return <p className="text-[13px] font-medium">{t('free')}</p>
  return (
    <p aria-label={t('priceLevel', { n: level })} className="text-[13px] font-medium tracking-[.06em]">
      <span aria-hidden="true">
        {'$'.repeat(level)}
        <span className="text-ink-3">{'$'.repeat(Math.max(0, 4 - level))}</span>
      </span>
    </p>
  )
}

function VenueCard({ venue, saved, onToggle }: { venue: DiningVenue; saved: boolean; onToggle: () => void }) {
  const t = useTranslations('home.dining')
  const tType = useTranslations('home.placeType')
  return (
    <article className="flex flex-col gap-4">
      <div className="relative aspect-[4/5] overflow-hidden rounded-lg bg-ph-2">
        <button
          type="button"
          aria-pressed={saved}
          aria-label={saved ? t('unsave', { name: venue.name }) : t('save', { name: venue.name })}
          onClick={onToggle}
          className={`absolute top-3 right-3 inline-flex size-11 cursor-pointer items-center justify-center rounded-full border bg-surface transition-colors duration-500 ${saved ? 'border-copper text-copper' : 'border-line text-ink'}`}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill={saved ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
            <path d="M6 3h12v18l-6-4-6 4z" />
          </svg>
        </button>
      </div>
      <div className="flex items-baseline justify-between gap-3">
        <p className="eyebrow text-ink-2">{venue.cuisine ?? tType(venue.type)}</p>
        {venue.priceLevel !== null && <Price level={venue.priceLevel} />}
      </div>
      <h3 className="-mt-1.5 text-[21px] font-semibold">
        <Link href="/eat-drink" className="text-ink hover:text-copper">
          {venue.name}
        </Link>
      </h3>
      {venue.where && <p className="-mt-2 text-sm text-ink-2">{venue.where}</p>}
      {venue.tags.length > 0 && (
        <ul className="flex flex-wrap gap-1.5">
          {venue.tags.map((tag) => (
            <li key={tag} className="rounded-full border border-line px-2.5 py-1 text-xs font-normal text-ink-2">
              {tag}
            </li>
          ))}
        </ul>
      )}
    </article>
  )
}

/** "Where to eat & drink now": the `home_dining` collection. */
export function DiningEdit({ edit }: { edit: DiningEditData | null }) {
  const t = useTranslations('home.dining')
  const { saved, toggle } = useSavedPlaces(edit?.venues.map((v) => v.id) ?? [])
  if (!edit || edit.venues.length === 0) return null

  return (
    <section aria-label={t('section')} className="mx-auto max-w-[1440px] px-[clamp(16px,4vw,56px)] pt-20 md:pt-40">
      <div className="flex flex-wrap items-end justify-between gap-6 border-b border-line pb-7">
        <div>
          {edit.sub && <p className="eyebrow mb-4 text-copper">{edit.sub}</p>}
          <h2 className="text-[28px] leading-[1.15] font-semibold tracking-[-0.015em] md:text-[clamp(30px,3.2vw,46px)] md:leading-[1.1]">{edit.title}</h2>
        </div>
        <Link href="/eat-drink" className={buttonClass('ghost')}>
          {t('all')}
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" aria-hidden="true">
            <path d="M5 12h14M13 6l6 6-6 6" />
          </svg>
        </Link>
      </div>
      <ul aria-label={t('list')} className="mt-6 grid grid-cols-2 gap-x-3.5 gap-y-5 md:mt-10 md:grid-cols-[repeat(auto-fit,minmax(260px,1fr))] md:gap-8">
        {edit.venues.map((v) => (
          <li key={v.id}>
            <VenueCard venue={v} saved={saved.has(v.id)} onToggle={() => toggle(v.id)} />
          </li>
        ))}
      </ul>
    </section>
  )
}

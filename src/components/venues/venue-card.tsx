'use client'

import { useTranslations } from 'next-intl'
import type { VenueCard as Venue } from '@/lib/venues/filter'

/** Price level as on/off dollar signs; screen readers get "Price level n of 4". */
export function PriceLevel({ level, className = '' }: { level: number | null; className?: string }) {
  const t = useTranslations('eatDrink.card')
  if (level === null) return null
  if (level <= 0) return <p className={`text-[13px] font-medium ${className}`}>{t('free')}</p>
  return (
    <p aria-label={t('priceLevel', { n: level })} className={`text-[13px] font-medium tracking-[.06em] ${className}`}>
      <span aria-hidden="true">
        {'$'.repeat(level)}
        <span className="text-ink-3">{'$'.repeat(Math.max(0, 4 - level))}</span>
      </span>
    </p>
  )
}

export function BookmarkIcon({ filled, size = 15 }: { filled: boolean; size?: number }) {
  return (
    <svg aria-hidden="true" width={size} height={size} viewBox="0 0 24 24" fill={filled ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="1.5">
      <path d="M6 3h12v18l-6-4-6 4z" />
    </svg>
  )
}

/**
 * One venue in the grid. The name is the real button (opens the drawer); its ::after stretches over the
 * whole card so the image and text are clickable too, while Save stays a separate control above it.
 */
export function VenueCard({
  venue,
  saved,
  selected,
  onOpen,
  onToggleSave,
}: {
  venue: Venue
  saved: boolean
  selected: boolean
  onOpen: () => void
  onToggleSave: () => void
}) {
  const t = useTranslations('eatDrink.card')
  return (
    <article className="relative flex flex-col gap-3">
      <div
        className={`relative aspect-[4/3] overflow-hidden rounded-lg bg-ph-2 outline-1 outline-offset-[3px] transition-[outline-color] duration-500 ${selected ? 'outline-copper' : 'outline-transparent'}`}
      >
        <button
          type="button"
          aria-pressed={saved}
          aria-label={saved ? t('unsave', { name: venue.name }) : t('save', { name: venue.name })}
          onClick={onToggleSave}
          className={`absolute top-2.5 right-2.5 z-10 inline-flex size-11 cursor-pointer items-center justify-center rounded-full border bg-surface transition-colors duration-500 ${saved ? 'border-copper text-copper' : 'border-line text-ink'}`}
        >
          <BookmarkIcon filled={saved} />
        </button>
      </div>
      <div className="flex items-baseline justify-between gap-3">
        <p className="eyebrow text-ink-2">{venue.cuisine?.name}</p>
        <PriceLevel level={venue.priceLevel} />
      </div>
      <h3 className="-mt-1 text-xl font-semibold">
        <button
          type="button"
          aria-haspopup="dialog"
          aria-label={t('details', { name: venue.name })}
          onClick={onOpen}
          className="cursor-pointer text-left transition-colors duration-500 after:absolute after:inset-0 after:content-[''] hover:text-copper"
        >
          {venue.name}
        </button>
      </h3>
      <p className="-mt-1.5 text-sm text-ink-2">{[venue.hood, venue.city.name].filter(Boolean).join(', ')}</p>
      {venue.tags.length > 0 && (
        <ul className="flex flex-wrap gap-1.5">
          {venue.tags.slice(0, 2).map((tag) => (
            <li key={tag.slug} className="rounded-full border border-line px-2.5 py-0.5 text-xs text-ink-2">
              {tag.name}
            </li>
          ))}
        </ul>
      )}
    </article>
  )
}

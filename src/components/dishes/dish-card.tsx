'use client'

import { useTranslations } from 'next-intl'
import { GalleryImage } from '@/components/gallery/gallery-image'
import { BookmarkIcon, PriceLevel } from '@/components/venues/venue-card'
import { Link } from '@/i18n/navigation'
import type { DishCard as Dish, DishImage } from '@/lib/dishes/filter'

/** Cover photo in its own ratio, or a placeholder block of `ratio` when the dish has none. */
export function DishPhoto({ image, sizes, ratio = '4 / 5', className = '' }: { image: DishImage | null; sizes: string; ratio?: string; className?: string }) {
  if (image) return <GalleryImage image={image} sizes={sizes} className={`rounded-lg ${className}`} />
  return <div aria-hidden="true" className={`rounded-lg bg-ph-2 ${className}`} style={{ aspectRatio: ratio }} />
}

/** "Australia · Sydney" eyebrow. */
export function useDishOrigin() {
  const t = useTranslations('dishes')
  return (d: Pick<Dish, 'country' | 'region'>) => [t(`country.${d.country}`), d.region?.name].filter(Boolean).join(' · ')
}

/**
 * One dish in a grid. The name links to the detail page and its ::after stretches over the card, so the photo is
 * clickable too; Save stays a separate control above it.
 */
export function DishCard({
  dish,
  saved,
  onToggleSave,
  sizes = '(min-width: 1440px) 320px, (min-width: 768px) 25vw, 50vw',
  large = false,
}: {
  dish: Dish
  saved: boolean
  onToggleSave: () => void
  sizes?: string
  large?: boolean
}) {
  const t = useTranslations('dishes.card')
  const origin = useDishOrigin()
  return (
    <article className="relative flex flex-col gap-3">
      <div className="relative">
        <DishPhoto image={dish.image} sizes={sizes} />
        <button
          type="button"
          aria-pressed={saved}
          aria-label={saved ? t('unsave', { name: dish.name }) : t('save', { name: dish.name })}
          onClick={onToggleSave}
          className={`absolute top-2.5 right-2.5 z-10 inline-flex size-11 cursor-pointer items-center justify-center rounded-full border bg-surface transition-colors duration-500 ${saved ? 'border-copper text-copper' : 'border-line text-ink'}`}
        >
          <BookmarkIcon filled={saved} />
        </button>
      </div>
      <p className="eyebrow text-ink-2">{origin(dish)}</p>
      <h3 className={`-mt-1 font-semibold ${large ? 'text-2xl' : 'text-xl'}`}>
        <Link href={`/dishes/${dish.slug}`} className="transition-colors duration-500 after:absolute after:inset-0 after:content-[''] hover:text-copper">
          {dish.name}
        </Link>
      </h3>
      {dish.line && <p className="-mt-1.5 text-[15px] leading-[1.6] text-ink-2">{dish.line}</p>}
      <div className="flex items-baseline justify-between gap-3 text-[13px] text-ink-2">
        <span>{dish.priceText}</span>
        <PriceLevel level={dish.priceLevel} />
      </div>
    </article>
  )
}

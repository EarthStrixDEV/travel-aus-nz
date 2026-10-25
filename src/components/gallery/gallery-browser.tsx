'use client'

import { useSearchParams } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { useMemo, useRef, useState } from 'react'
import { useSavedPlaces } from '@/components/trip/use-saved-places'
import { Button } from '@/components/ui/button'
import { usePathname, useRouter } from '@/i18n/navigation'
import {
  filterGallery,
  galleryFilterToParams,
  galleryOptions,
  hasActiveFilters,
  parseGalleryFilter,
  type GalleryFilter,
  type GalleryPhoto,
} from '@/lib/gallery/filter'
import { GalleryFilters } from './gallery-filters'
import { Lightbox } from './lightbox'
import { MasonryGrid } from './masonry-grid'

/**
 * Filter bar, masonry grid and lightbox. Filters live in the URL query (`router.replace`, no scroll) and are
 * applied to the full list that shipped with the page; the lightbox steps through the filtered list.
 */
export function GalleryBrowser({ photos }: { photos: GalleryPhoto[] }) {
  const t = useTranslations('gallery')
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [openIndex, setOpenIndex] = useState<number | null>(null)
  const opener = useRef<HTMLElement | null>(null)

  const query = searchParams.toString()
  const filter = useMemo(() => parseGalleryFilter(new URLSearchParams(query)), [query])
  const items = useMemo(() => filterGallery(photos, filter), [photos, filter])
  const options = useMemo(() => galleryOptions(photos), [photos])

  // One lookup for the whole catalogue (not per filter change); the lightbox reads the shown place from it.
  const { saved, toggle } = useSavedPlaces(useMemo(() => photos.map((p) => p.place.id), [photos]))
  const index = openIndex !== null && openIndex < items.length ? openIndex : null
  const shown = index === null ? null : items[index]

  function apply(next: GalleryFilter) {
    const qs = galleryFilterToParams(next).toString()
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false })
  }

  return (
    <>
      {/* Pinned under the sticky site header (65px below lg, 73px from lg); not pinned on phones, where three chip rows would cover the photos. */}
      <div className="z-10 border-y border-line-2 bg-bg md:sticky md:top-[65px] lg:top-[73px]">
        <div className="mx-auto max-w-[1440px] px-[clamp(16px,4vw,56px)] py-3.5">
          <GalleryFilters filter={filter} options={options} onChange={apply} />
        </div>
      </div>

      <section className="mx-auto max-w-[1440px] px-[clamp(16px,4vw,56px)] pt-10 pb-24 md:pb-36">
        <p aria-live="polite" className="mb-6 text-sm text-ink-2">
          {t('count', { count: items.length })}
        </p>

        {items.length === 0 ? (
          <div className="flex flex-col items-center gap-4 py-20 text-center">
            <p className="text-lg font-medium">{t('empty.title')}</p>
            {hasActiveFilters(filter) && (
              <Button variant="ghost" onClick={() => apply({})}>
                {t('filters.clear')}
              </Button>
            )}
          </div>
        ) : (
          <MasonryGrid
            photos={items}
            onOpen={(i, el) => {
              opener.current = el
              setOpenIndex(i)
            }}
          />
        )}
      </section>

      <Lightbox
        photos={items}
        index={index}
        saved={shown ? saved.has(shown.place.id) : false}
        onIndex={setOpenIndex}
        onClose={() => {
          setOpenIndex(null)
          opener.current?.focus({ preventScroll: true })
          opener.current = null
        }}
        onToggleSave={() => shown && toggle(shown.place.id)}
      />
    </>
  )
}

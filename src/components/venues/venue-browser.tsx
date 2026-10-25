'use client'

import { useSearchParams } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { useMemo, useRef, useState } from 'react'
import { useSavedPlaces } from '@/components/trip/use-saved-places'
import { Button } from '@/components/ui/button'
import { usePathname, useRouter } from '@/i18n/navigation'
import {
  countByKind,
  filterVenues,
  hasActiveFilters,
  parseVenueFilter,
  venueFilterToParams,
  VENUE_KINDS,
  type Facets,
  type VenueCard as Venue,
  type VenueFilter,
  type VenueKind,
} from '@/lib/venues/filter'
import { VenueCard } from './venue-card'
import { VenueDrawer } from './venue-drawer'
import { VenueFilters, type FilterOptions } from './venue-filters'

const DRINK_ORDER = ['wine', 'cocktails', 'beer', 'coffee', 'non_alc']
const DIET_ORDER = ['vegetarian', 'vegan', 'gluten_free']

const byName = (a: { name: string }, b: { name: string }) => a.name.localeCompare(b.name)
const byOrder = (order: string[]) => (a: string, b: string) => {
  const ia = order.indexOf(a)
  const ib = order.indexOf(b)
  return (ia === -1 ? order.length : ia) - (ib === -1 ? order.length : ib) || a.localeCompare(b)
}

/** Everything the current tab can be filtered by (independent of the selected filters, so chips stay put). */
function optionsFor(pool: Venue[], facets: Facets): FilterOptions {
  const unique = (list: { slug: string; name: string }[]) => [...new Map(list.map((o) => [o.slug, o])).values()].sort(byName)
  return {
    cities: unique(pool.map((v) => v.city)),
    moods: unique(pool.flatMap((v) => v.tags)),
    cuisines: unique(pool.flatMap((v) => (v.cuisine ? [v.cuisine] : []))),
    drinks: Object.keys(facets.drink).sort(byOrder(DRINK_ORDER)),
    diets: Object.keys(facets.diet).sort(byOrder(DIET_ORDER)),
  }
}

/** Tabs, filters, grid and drawer. All filter state lives in the URL query (`router.replace`, no scroll). */
export function VenueBrowser({ venues }: { venues: Venue[] }) {
  const t = useTranslations('eatDrink')
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const tabRefs = useRef<Record<VenueKind, HTMLButtonElement | null>>({ restaurant: null, bar: null })
  const [openSlug, setOpenSlug] = useState<string | null>(null)

  const query = searchParams.toString()
  const filter = useMemo(() => parseVenueFilter(new URLSearchParams(query)), [query])
  const { items, facets } = useMemo(() => filterVenues(venues, filter), [venues, filter])
  const kindCounts = useMemo(() => countByKind(venues, filter), [venues, filter])
  const pool = useMemo(() => venues.filter((v) => v.kind === filter.kind), [venues, filter.kind])
  const options = useMemo(() => optionsFor(pool, filterVenues(venues, { kind: filter.kind, diet: [] }).facets), [pool, venues, filter.kind])

  // One lookup per tab (not per filter change); the grid and the drawer share the result.
  const { saved, toggle } = useSavedPlaces(useMemo(() => pool.map((v) => v.id), [pool]))
  const selected = useMemo(() => venues.find((v) => v.slug === openSlug) ?? null, [venues, openSlug])

  function apply(next: VenueFilter) {
    const qs = venueFilterToParams(next).toString()
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false })
  }

  function pickKind(kind: VenueKind) {
    // Moods and cuisines belong to a tab, so they do not carry across.
    if (kind !== filter.kind) apply({ ...filter, kind, mood: undefined, cuisine: undefined })
  }

  function onTabKey(e: React.KeyboardEvent, index: number) {
    const move = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0
    if (!move) return
    e.preventDefault()
    const next = VENUE_KINDS[(index + move + VENUE_KINDS.length) % VENUE_KINDS.length]
    pickKind(next)
    tabRefs.current[next]?.focus()
  }

  return (
    <>
      <div className="mx-auto max-w-[1440px] px-[clamp(16px,4vw,56px)]">
        <div role="tablist" aria-label={t('tabs.label')} className="flex gap-10 border-b border-line">
          {VENUE_KINDS.map((kind, i) => (
            <button
              key={kind}
              ref={(el) => {
                tabRefs.current[kind] = el
              }}
              type="button"
              role="tab"
              id={`venue-tab-${kind}`}
              aria-selected={filter.kind === kind}
              aria-controls="venue-panel"
              tabIndex={filter.kind === kind ? 0 : -1}
              onClick={() => pickKind(kind)}
              onKeyDown={(e) => onTabKey(e, i)}
              className={`-mb-px cursor-pointer border-b-2 py-4 text-lg font-medium transition-colors duration-500 ${
                filter.kind === kind ? 'border-copper text-ink' : 'border-transparent text-ink-2 hover:text-ink'
              }`}
            >
              {t(`tabs.${kind}`)}
              <span className="ml-2 text-sm text-ink-3 tabular-nums">{kindCounts[kind]}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="border-b border-line-2">
        <div className="mx-auto max-w-[1440px] px-[clamp(16px,4vw,56px)] py-3.5">
          <VenueFilters filter={filter} facets={facets} options={options} onChange={apply} />
        </div>
      </div>

      <section
        id="venue-panel"
        role="tabpanel"
        aria-labelledby={`venue-tab-${filter.kind}`}
        className="mx-auto max-w-[1440px] px-[clamp(16px,4vw,56px)] pt-10 pb-24 md:pb-36"
      >
        <p aria-live="polite" className="mb-6 text-sm text-ink-2">
          {t(`count.${filter.kind}`, { count: items.length })}
        </p>

        {items.length === 0 ? (
          <div className="flex max-w-md flex-col items-start gap-3 rounded-lg border border-line-2 bg-surface p-7">
            <h2 className="text-xl font-semibold">{t('empty.title')}</h2>
            <p className="text-[15px] leading-[1.6] text-ink-2">{t('empty.text')}</p>
            {hasActiveFilters(filter) && (
              <Button variant="ghost" onClick={() => apply({ kind: filter.kind, diet: [] })}>
                {t('filters.clear')}
              </Button>
            )}
          </div>
        ) : (
          <ul aria-label={t('results.label')} className="grid grid-cols-[repeat(auto-fill,minmax(250px,1fr))] gap-x-7 gap-y-10">
            {items.map((v) => (
              <li key={v.id}>
                <VenueCard
                  venue={v}
                  saved={saved.has(v.id)}
                  selected={v.slug === openSlug}
                  onOpen={() => setOpenSlug(v.slug)}
                  onToggleSave={() => toggle(v.id)}
                />
              </li>
            ))}
          </ul>
        )}
      </section>

      <VenueDrawer venue={selected} saved={selected ? saved.has(selected.id) : false} onToggleSave={() => selected && toggle(selected.id)} onClose={() => setOpenSlug(null)} />
    </>
  )
}

'use client'

import { useSearchParams } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { useMemo, useState } from 'react'
import { useSaved } from '@/components/trip/use-saved-places'
import { Button } from '@/components/ui/button'
import { Link, usePathname, useRouter } from '@/i18n/navigation'
import type { DishCollection, DishesData } from '@/lib/content/dishes'
import {
  DISH_DIETS,
  DISH_TYPES,
  dishFilterToParams,
  filterDishes,
  hasActiveFilters,
  parseDishFilter,
  type DishCard as Dish,
  type DishFilter,
} from '@/lib/dishes/filter'
import { DishCard, DishPhoto, useDishOrigin } from './dish-card'
import { DishFilters, FilterSheet, type DishFilterOptions } from './dish-filters'

const NO_FILTER: DishFilter = { diet: [] }

function optionsFor(dishes: Dish[]): DishFilterOptions {
  const regions = new Map<string, string>()
  for (const d of dishes) if (d.region) regions.set(d.region.slug, d.region.name)
  const present = (all: readonly string[], values: string[]) => all.filter((v) => values.includes(v))
  return {
    countries: present(['au', 'nz'], dishes.map((d) => d.country)) as ('au' | 'nz')[],
    regions: [...regions].map(([slug, name]) => ({ slug, name })).sort((a, b) => a.name.localeCompare(b.name)),
    types: present(DISH_TYPES, dishes.map((d) => d.type)),
    diets: present(DISH_DIETS, dishes.flatMap((d) => d.dietary)),
  }
}

function Heading({ eyebrow, title }: { eyebrow: string; title: string }) {
  return (
    <div className="mb-8">
      <p className="eyebrow text-copper">{eyebrow}</p>
      <h2 className="mt-3 text-[clamp(28px,3vw,40px)] leading-[1.1] font-semibold tracking-[-0.01em]">{title}</h2>
    </div>
  )
}

function Collections({ collections }: { collections: DishCollection[] }) {
  const t = useTranslations('dishes')
  const origin = useDishOrigin()
  if (!collections.length) return null
  return (
    <section aria-labelledby="dish-collections" className="mx-auto max-w-[1440px] px-[clamp(16px,4vw,56px)] pb-24 md:pb-36">
      <div className="mb-8">
        <p className="eyebrow text-copper">{t('collections.eyebrow')}</p>
        <h2 id="dish-collections" className="mt-3 text-[clamp(28px,3vw,40px)] leading-[1.1] font-semibold tracking-[-0.01em]">
          {t('collections.title')}
        </h2>
      </div>
      <ul className="grid grid-cols-[repeat(auto-fill,minmax(300px,1fr))] gap-7">
        {collections.map((c) => (
          <li key={c.slug} className="flex flex-col gap-4 rounded-[10px] border border-line bg-surface p-6">
            <div>
              <h3 className="text-xl font-semibold">{c.title}</h3>
              {c.sub && <p className="mt-1 text-[15px] leading-[1.6] text-ink-2">{c.sub}</p>}
              <p className="mt-2 text-[13px] text-ink-3">{t('count', { count: c.count })}</p>
            </div>
            <ul className="flex flex-col gap-3">
              {c.previews.map((d) => (
                <li key={d.slug} className="relative flex items-center gap-3">
                  <DishPhoto image={d.image} sizes="64px" ratio="1 / 1" className="w-16 flex-none" />
                  <div className="min-w-0">
                    <p className="eyebrow truncate text-ink-3">{origin(d)}</p>
                    <Link
                      href={`/dishes/${d.slug}`}
                      className="block truncate font-medium transition-colors duration-500 after:absolute after:inset-0 after:content-[''] hover:text-copper"
                    >
                      {d.name}
                    </Link>
                    {d.priceText && <p className="text-[13px] text-ink-2">{d.priceText}</p>}
                  </div>
                </li>
              ))}
            </ul>
          </li>
        ))}
      </ul>
    </section>
  )
}

function Grid({ dishes, saved, toggle }: { dishes: Dish[]; saved: ReadonlySet<string>; toggle: (id: string) => void }) {
  return (
    <ul className="grid grid-cols-2 gap-x-5 gap-y-10 md:grid-cols-[repeat(auto-fill,minmax(250px,1fr))] md:gap-x-7">
      {dishes.map((d) => (
        <li key={d.id}>
          <DishCard dish={d} saved={saved.has(d.id)} onToggleSave={() => toggle(d.id)} />
        </li>
      ))}
    </ul>
  )
}

/**
 * Must-try, filters, the editors' grid and collections (spec §9). Filter state lives in the URL query;
 * `filter` is null in the server fallback (no search params yet), which renders the unfiltered catalog.
 */
function DishSections({ data, filter, onChange }: { data: DishesData; filter: DishFilter; onChange?: (next: DishFilter) => void }) {
  const t = useTranslations('dishes')
  const [sheetOpen, setSheetOpen] = useState(false)
  const { items, facets, count } = useMemo(() => filterDishes(data.dishes, filter), [data.dishes, filter])
  const options = useMemo(() => optionsFor(data.dishes), [data.dishes])
  const { saved, toggle } = useSaved('dish', useMemo(() => data.dishes.map((d) => d.id), [data.dishes]))
  const active = hasActiveFilters(filter)
  const activeCount = [filter.country, filter.region, filter.type, filter.priceMax].filter((v) => v !== undefined).length + filter.diet.length

  const filters = onChange && <DishFilters filter={filter} facets={facets} options={options} onChange={onChange} />

  return (
    <>
      {onChange && (
        <div className="border-y border-line-2">
          <div className="mx-auto flex max-w-[1440px] items-center justify-between gap-4 px-[clamp(16px,4vw,56px)] py-3.5">
            <div className="hidden md:block">{filters}</div>
            <Button variant="ghost" className="md:hidden" onClick={() => setSheetOpen(true)} aria-haspopup="dialog">
              {t('filters.open')}
              {activeCount > 0 && <span className="rounded-full bg-copper px-2 text-xs text-on-copper tabular-nums">{activeCount}</span>}
            </Button>
            <div className="flex items-center gap-4 text-sm text-ink-2">
              <span aria-live="polite">{t('count', { count })}</span>
              {active && (
                <button type="button" onClick={() => onChange(NO_FILTER)} className="min-h-11 cursor-pointer text-copper">
                  {t('filters.clear')}
                </button>
              )}
            </div>
          </div>
          <FilterSheet open={sheetOpen} onClose={() => setSheetOpen(false)} count={count} onClear={() => onChange(NO_FILTER)}>
            <DishFilters filter={filter} facets={facets} options={options} onChange={onChange} stacked />
          </FilterSheet>
        </div>
      )}

      {data.mustTry.length > 0 && (
        <section aria-label={t('mustTry.title')} className="mx-auto max-w-[1440px] px-[clamp(16px,4vw,56px)] pt-12 md:pt-16">
          <Heading eyebrow={t('mustTry.eyebrow')} title={t('mustTry.title')} />
          <ul className="grid gap-7 md:grid-cols-3">
            {data.mustTry.map((d) => (
              <li key={d.id}>
                <DishCard dish={d} saved={saved.has(d.id)} onToggleSave={() => toggle(d.id)} sizes="(min-width: 768px) 33vw, 100vw" large />
              </li>
            ))}
          </ul>
        </section>
      )}

      <section aria-label={t('all.eyebrow')} className="mx-auto max-w-[1440px] px-[clamp(16px,4vw,56px)] pt-16 pb-24 md:pt-24">
        <Heading eyebrow={t('all.eyebrow')} title={t('all.title')} />
        {items.length === 0 ? (
          <div className="flex max-w-md flex-col items-start gap-3 rounded-lg border border-line-2 bg-surface p-7">
            <h3 className="text-xl font-semibold">{t('empty.title')}</h3>
            <p className="text-[15px] leading-[1.6] text-ink-2">{t('empty.text')}</p>
            {active && onChange && (
              <Button variant="ghost" onClick={() => onChange(NO_FILTER)}>
                {t('filters.clear')}
              </Button>
            )}
          </div>
        ) : (
          <Grid dishes={items} saved={saved} toggle={toggle} />
        )}
      </section>

      <Collections collections={data.collections} />
    </>
  )
}

/** Server-rendered default view (no filters), so crawlers get real dish names and links. */
export function DishFallback({ data }: { data: DishesData }) {
  return <DishSections data={data} filter={NO_FILTER} />
}

export function DishBrowser({ data }: { data: DishesData }) {
  const router = useRouter()
  const pathname = usePathname()
  const query = useSearchParams().toString()
  const filter = useMemo(() => parseDishFilter(new URLSearchParams(query)), [query])

  function apply(next: DishFilter) {
    const qs = dishFilterToParams(next).toString()
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false })
  }

  return <DishSections data={data} filter={filter} onChange={apply} />
}

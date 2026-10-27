'use client'

import { useTranslations } from 'next-intl'
import { useEffect, useRef } from 'react'
import { Button, IconButton } from '@/components/ui/button'
import { Chip, Group } from '@/components/venues/venue-filters'
import { PRICE_LEVELS, type DishFilter, type Facets } from '@/lib/dishes/filter'

export type DishFilterOptions = {
  countries: ('au' | 'nz')[]
  regions: { slug: string; name: string }[]
  types: string[]
  diets: string[]
}

/** Every filter group (spec §9: country, region, type, price, dietary). Used inline on desktop and in the mobile sheet. */
export function DishFilters({
  filter,
  facets,
  options,
  onChange,
  stacked = false,
}: {
  filter: DishFilter
  facets: Facets
  options: DishFilterOptions
  onChange: (next: DishFilter) => void
  stacked?: boolean
}) {
  const t = useTranslations('dishes')
  const label = (ns: 'type' | 'diet', slug: string) => (t.has(`${ns}.${slug}`) ? t(`${ns}.${slug}`) : slug.replace(/_/g, ' '))

  return (
    <div className={stacked ? 'flex flex-col gap-6' : 'flex flex-wrap items-center gap-x-8 gap-y-3.5'} role="group" aria-label={t('filters.label')}>
      {options.countries.length > 1 && (
        <Group label={t('filters.country')}>
          <Chip pressed={!filter.country} onClick={() => onChange({ ...filter, country: undefined, region: undefined })} label={t('filters.allCountries')} />
          {options.countries.map((c) => (
            <Chip
              key={c}
              pressed={filter.country === c}
              disabled={!facets.country[c] && filter.country !== c}
              // A region belongs to one country, so switching country clears it.
              onClick={() => onChange({ ...filter, country: filter.country === c ? undefined : c, region: undefined })}
              label={t(`country.${c}`)}
              count={facets.country[c] ?? 0}
            />
          ))}
        </Group>
      )}

      {options.regions.length > 1 && (
        <Group label={t('filters.region')}>
          <Chip pressed={!filter.region} onClick={() => onChange({ ...filter, region: undefined })} label={t('filters.allRegions')} />
          {options.regions.map((r) => (
            <Chip
              key={r.slug}
              pressed={filter.region === r.slug}
              disabled={!facets.region[r.slug] && filter.region !== r.slug}
              onClick={() => onChange({ ...filter, region: filter.region === r.slug ? undefined : r.slug })}
              label={r.name}
              count={facets.region[r.slug] ?? 0}
            />
          ))}
        </Group>
      )}

      {options.types.length > 1 && (
        <Group label={t('filters.type')}>
          {options.types.map((ty) => (
            <Chip
              key={ty}
              pressed={filter.type === ty}
              disabled={!facets.type[ty] && filter.type !== ty}
              onClick={() => onChange({ ...filter, type: filter.type === ty ? undefined : ty })}
              label={label('type', ty)}
              count={facets.type[ty] ?? 0}
            />
          ))}
        </Group>
      )}

      <Group label={t('filters.price')}>
        {PRICE_LEVELS.map((n) => (
          <Chip
            key={n}
            pressed={filter.priceMax === n}
            disabled={!facets.price[n] && filter.priceMax !== n}
            ariaLabel={t('filters.priceUpTo', { n })}
            onClick={() => onChange({ ...filter, priceMax: filter.priceMax === n ? undefined : n })}
            label={'$'.repeat(n)}
            className="tracking-[.06em]"
          />
        ))}
      </Group>

      {options.diets.length > 0 && (
        <Group label={t('filters.diet')}>
          {options.diets.map((d) => {
            const on = filter.diet.includes(d)
            return (
              <Chip
                key={d}
                pressed={on}
                disabled={!facets.diet[d] && !on}
                onClick={() => onChange({ ...filter, diet: on ? filter.diet.filter((x) => x !== d) : [...filter.diet, d] })}
                label={label('diet', d)}
                count={facets.diet[d] ?? 0}
              />
            )
          })}
        </Group>
      )}
    </div>
  )
}

/**
 * Mobile filter bottom sheet (DishFiltersMobile): a native modal <dialog>, so focus is trapped and Esc closes it.
 * Filters apply live; "Show n dishes" closes the sheet.
 */
export function FilterSheet({
  open,
  onClose,
  count,
  onClear,
  children,
}: {
  open: boolean
  onClose: () => void
  count: number
  onClear: () => void
  children: React.ReactNode
}) {
  const t = useTranslations('dishes.filters')
  const ref = useRef<HTMLDialogElement>(null)

  useEffect(() => {
    const d = ref.current
    if (!d) return
    if (open && !d.open) d.showModal()
    else if (!open && d.open) d.close()
  }, [open])

  return (
    <dialog
      ref={ref}
      aria-labelledby="dish-filter-title"
      onClose={onClose}
      onClick={(e) => {
        if (e.target === e.currentTarget) e.currentTarget.close()
      }}
      className="fixed inset-x-0 top-auto bottom-0 m-0 max-h-[85dvh] w-full max-w-none overflow-y-auto rounded-t-[18px] border border-line bg-surface p-0 text-ink shadow-soft backdrop:bg-deep/40"
    >
      <div className="sticky top-0 z-10 flex items-center justify-between border-b border-line-2 bg-surface px-5 py-3">
        <h2 id="dish-filter-title" className="text-lg font-semibold">
          {t('open')}
        </h2>
        <div className="flex items-center gap-2">
          <button type="button" onClick={onClear} className="min-h-11 cursor-pointer px-2 text-sm text-copper">
            {t('clear')}
          </button>
          <IconButton label={t('close')} onClick={() => ref.current?.close()}>
            <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M6 6l12 12M18 6L6 18" />
            </svg>
          </IconButton>
        </div>
      </div>
      <div className="px-5 py-6">{children}</div>
      <div className="sticky bottom-0 border-t border-line-2 bg-surface px-5 py-3">
        <Button className="w-full" onClick={() => ref.current?.close()}>
          {t('show', { count })}
        </Button>
      </div>
    </dialog>
  )
}

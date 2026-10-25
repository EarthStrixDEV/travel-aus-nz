'use client'

import { useTranslations } from 'next-intl'
import { useId } from 'react'
import { PRICE_LEVELS, type Facets, type VenueFilter } from '@/lib/venues/filter'

export type FilterOptions = {
  cities: { slug: string; name: string }[]
  moods: { slug: string; name: string }[]
  cuisines: { slug: string; name: string }[]
  drinks: string[]
  diets: string[]
}

function Chip({
  pressed,
  disabled,
  onClick,
  label,
  count,
  ariaLabel,
  className = '',
}: {
  pressed: boolean
  disabled?: boolean
  onClick: () => void
  label: string
  count?: number
  ariaLabel?: string
  className?: string
}) {
  return (
    <button
      type="button"
      aria-pressed={pressed}
      aria-label={ariaLabel}
      disabled={disabled}
      onClick={onClick}
      className={`min-h-9 cursor-pointer rounded-full border px-3.5 text-[13px] whitespace-nowrap transition-[color,border-color,background-color] duration-500 disabled:cursor-not-allowed disabled:opacity-45 ${
        pressed ? 'border-copper bg-copper-tint font-medium text-copper' : 'border-line bg-transparent text-ink-2 hover:border-ink'
      } ${className}`}
    >
      {label}
      {count !== undefined && <span className="ml-1.5 text-ink-3 tabular-nums">{count}</span>}
    </button>
  )
}

function Group({ label, children }: { label: string; children: React.ReactNode }) {
  const id = useId()
  return (
    <div role="group" aria-labelledby={id} className="flex flex-wrap items-center gap-1.5">
      <span id={id} className="eyebrow mr-1.5 text-ink-2">
        {label}
      </span>
      {children}
    </div>
  )
}

/**
 * Filter bar (spec §8). Chips show facet counts; a chip with no matches is disabled unless selected.
 * Only values present in the current tab are offered.
 */
export function VenueFilters({
  filter,
  facets,
  options,
  onChange,
}: {
  filter: VenueFilter
  facets: Facets
  options: FilterOptions
  onChange: (next: VenueFilter) => void
}) {
  const t = useTranslations('eatDrink')
  const label = (ns: 'drink' | 'diet', slug: string) => (t.has(`${ns}.${slug}`) ? t(`${ns}.${slug}`) : slug.replace(/_/g, ' '))

  return (
    <div className="flex flex-wrap items-center gap-x-8 gap-y-3.5" role="group" aria-label={t('filters.label')}>
      {options.cities.length > 1 && (
        <Group label={t('filters.city')}>
          <Chip pressed={!filter.city} onClick={() => onChange({ ...filter, city: undefined })} label={t('filters.allCities')} />
          {options.cities.map((c) => (
            <Chip
              key={c.slug}
              pressed={filter.city === c.slug}
              disabled={!facets.city[c.slug] && filter.city !== c.slug}
              onClick={() => onChange({ ...filter, city: filter.city === c.slug ? undefined : c.slug })}
              label={c.name}
              count={facets.city[c.slug] ?? 0}
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

      {options.drinks.length > 0 && (
        <Group label={t('filters.drink')}>
          {options.drinks.map((d) => (
            <Chip
              key={d}
              pressed={filter.drink === d}
              disabled={!facets.drink[d] && filter.drink !== d}
              onClick={() => onChange({ ...filter, drink: filter.drink === d ? undefined : d })}
              label={label('drink', d)}
              count={facets.drink[d] ?? 0}
            />
          ))}
        </Group>
      )}

      {options.moods.length > 0 && (
        <Group label={t('filters.mood')}>
          {options.moods.map((m) => (
            <Chip
              key={m.slug}
              pressed={filter.mood === m.slug}
              disabled={!facets.mood[m.slug] && filter.mood !== m.slug}
              onClick={() => onChange({ ...filter, mood: filter.mood === m.slug ? undefined : m.slug })}
              label={m.name}
              count={facets.mood[m.slug] ?? 0}
            />
          ))}
        </Group>
      )}

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

      {options.cuisines.length > 0 && (
        <label className="flex items-center gap-2 text-[13px] text-ink-2 md:ml-auto">
          <span className="eyebrow">{t('filters.cuisine')}</span>
          <select
            value={filter.cuisine ?? ''}
            onChange={(e) => onChange({ ...filter, cuisine: e.target.value || undefined })}
            className="min-h-9 cursor-pointer rounded-full border border-line bg-transparent px-3 text-[13px] text-ink"
          >
            <option value="">{t('filters.allCuisines')}</option>
            {options.cuisines.map((c) => (
              <option key={c.slug} value={c.slug} disabled={!facets.cuisine[c.slug] && filter.cuisine !== c.slug}>
                {c.name} ({facets.cuisine[c.slug] ?? 0})
              </option>
            ))}
          </select>
        </label>
      )}
    </div>
  )
}

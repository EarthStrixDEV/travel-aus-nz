'use client'

import { useTranslations } from 'next-intl'
import type { Country } from '@/lib/content/shared'
import type { MapCity } from '@/lib/content/places'

const COUNTRIES: Country[] = ['au', 'nz']

/**
 * Country switch (Australia / New Zealand) + breadcrumb "Australia / Sydney".
 * The country crumb returns to the country overview; the city select fits that city.
 */
export function Breadcrumb({
  country,
  cities,
  activeCity,
  onCountry,
  onCity,
}: {
  country: Country
  cities: MapCity[]
  activeCity: MapCity | null
  onCountry: (c: Country) => void
  onCity: (c: MapCity) => void
}) {
  const t = useTranslations('map')
  const own = cities.filter((c) => c.country === country)
  const other: Country = country === 'au' ? 'nz' : 'au'

  return (
    <div className="flex flex-wrap items-center gap-2.5">
      <div role="group" aria-label={t('country.label')} className="hidden rounded-full border border-line bg-surface p-[3px] shadow-(--shadow) md:inline-flex">
        {COUNTRIES.map((c) => (
          <button
            key={c}
            type="button"
            aria-pressed={c === country}
            onClick={() => onCountry(c)}
            className={`min-h-9 cursor-pointer rounded-full px-4 text-[13px] font-medium transition-colors duration-500 ${c === country ? 'bg-ink text-bg' : 'text-ink-2'}`}
          >
            {t(`country.${c}`)}
          </button>
        ))}
      </div>
      <button
        type="button"
        onClick={() => onCountry(other)}
        aria-label={t('country.switch', { country: t(`country.${country}`) })}
        className="min-h-12 cursor-pointer rounded-full border border-line bg-surface px-3.5 text-[13px] font-medium text-ink shadow-(--shadow) md:hidden"
      >
        AU · NZ
      </button>

      <nav aria-label={t('breadcrumb.label')} className="flex min-h-11 items-center rounded-[6px] border border-line bg-surface pr-1 pl-4 text-[13px] font-medium shadow-(--shadow)">
        <ol className="flex items-center gap-1.5">
          <li>
            <button
              type="button"
              onClick={() => onCountry(country)}
              aria-current={activeCity ? undefined : 'location'}
              className="min-h-10 cursor-pointer text-ink hover:text-copper"
            >
              {t(`country.${country}`)}
            </button>
          </li>
          <li aria-hidden="true" className="text-ink-3">
            /
          </li>
          <li>
            <label className="relative inline-flex items-center">
              <span className="sr-only">{t('breadcrumb.city')}</span>
              <select
                value={activeCity?.slug ?? ''}
                onChange={(e) => {
                  const city = own.find((c) => c.slug === e.target.value)
                  if (city) onCity(city)
                  else onCountry(country)
                }}
                className="min-h-10 cursor-pointer appearance-none bg-transparent py-0 pr-7 pl-1 text-copper outline-offset-2"
              >
                <option value="">{t('breadcrumb.allCities')}</option>
                {own.map((c) => (
                  <option key={c.slug} value={c.slug}>
                    {c.name}
                  </option>
                ))}
              </select>
              <svg aria-hidden="true" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" className="pointer-events-none absolute right-2 text-ink-2">
                <path d="M6 9l6 6 6-6" />
              </svg>
            </label>
          </li>
        </ol>
      </nav>
    </div>
  )
}

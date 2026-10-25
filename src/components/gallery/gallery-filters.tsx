'use client'

import { useTranslations } from 'next-intl'
import { Chip, Group } from '@/components/venues/venue-filters'
import { SEASONS, type GalleryFilter } from '@/lib/gallery/filter'
import { typeName, type T } from './labels'

export type GalleryFilterOptions = {
  regions: { slug: string; name: string }[]
  types: { slug: string; label: string }[]
}

/** Region · Type · Season chips (spec §6). Each group leads with "All" / "Any"; picking the active chip again clears it. */
export function GalleryFilters({
  filter,
  options,
  onChange,
}: {
  filter: GalleryFilter
  options: GalleryFilterOptions
  onChange: (next: GalleryFilter) => void
}) {
  const t = useTranslations('gallery') as unknown as T

  return (
    <div className="flex flex-wrap items-center gap-x-9 gap-y-3.5" role="group" aria-label={t('filters.label')}>
      <Group label={t('filters.region')}>
        <Chip pressed={!filter.region} onClick={() => onChange({ ...filter, region: undefined })} label={t('filters.all')} />
        {options.regions.map((r) => (
          <Chip
            key={r.slug}
            pressed={filter.region === r.slug}
            onClick={() => onChange({ ...filter, region: filter.region === r.slug ? undefined : r.slug })}
            label={r.name}
          />
        ))}
      </Group>

      <Group label={t('filters.type')}>
        <Chip pressed={!filter.type} onClick={() => onChange({ ...filter, type: undefined })} label={t('filters.all')} />
        {options.types.map((o) => (
          <Chip
            key={o.slug}
            pressed={filter.type === o.slug}
            onClick={() => onChange({ ...filter, type: filter.type === o.slug ? undefined : o.slug })}
            label={typeName(o.slug, o.label, t)}
          />
        ))}
      </Group>

      <Group label={t('filters.season')}>
        <Chip pressed={!filter.season} onClick={() => onChange({ ...filter, season: undefined })} label={t('filters.any')} />
        {SEASONS.map((s) => (
          <Chip
            key={s}
            pressed={filter.season === s}
            onClick={() => onChange({ ...filter, season: filter.season === s ? undefined : s })}
            label={t(`season.${s}`)}
          />
        ))}
      </Group>
    </div>
  )
}

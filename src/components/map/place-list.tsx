'use client'

import { useTranslations } from 'next-intl'
import type { MapCluster, MapPinProps } from '@/lib/content/places'
import { LayerShape } from './layer-toggle'
import { layerOf } from './layers'

export type Pin = MapPinProps & { lng: number; lat: number }
export type ListStatus = 'loading' | 'ready' | 'error'

type Props = {
  level: 'clusters' | 'places'
  clusters: MapCluster[]
  places: Pin[]
  selected: string | null
  status: ListStatus
  /** The API returned its 500-feature cap. */
  capped: boolean
  onSelect: (pin: Pin) => void
  onCluster: (c: MapCluster) => void
  onRetry: () => void
}

function Status({ status, empty, onRetry }: { status: ListStatus; empty: boolean; onRetry: () => void }) {
  const t = useTranslations('map.list')
  if (status === 'loading') return <p className="px-5 py-4 text-sm text-ink-2">{t('loading')}</p>
  if (status === 'error')
    return (
      <p className="flex items-center gap-3 px-5 py-4 text-sm text-ink-2">
        {t('error')}
        <button type="button" onClick={onRetry} className="min-h-11 cursor-pointer font-medium text-copper underline-offset-4 hover:underline">
          {t('retry')}
        </button>
      </p>
    )
  if (empty) return <p className="px-5 py-4 text-sm text-ink-2">{t('empty')}</p>
  return null
}

/**
 * Accessible list view of the same results as the map (spec §15): every place in view is a
 * button that opens the drawer; at cluster level each area is a button that zooms into it.
 */
export function PlaceList({ level, clusters, places, selected, status, capped, onSelect, onCluster, onRetry }: Props) {
  const t = useTranslations('map')
  const tType = useTranslations('map.layerName')
  const empty = level === 'clusters' ? clusters.length === 0 : places.length === 0

  return (
    <section aria-label={level === 'clusters' ? t('list.areas') : t('list.label')} className="flex min-h-0 flex-col">
      <div aria-live="polite">
        <Status status={status} empty={empty} onRetry={onRetry} />
      </div>
      {status === 'ready' && level === 'clusters' && clusters.length > 0 && (
        <>
          <p className="px-5 pt-4 pb-2 text-sm text-ink-2">{t('list.zoomHint')}</p>
          <ul className="overflow-y-auto">
            {clusters.map((c) => (
              <li key={`${c.city}-${c.neighbourhoodId ?? 'city'}`} className="border-t border-line-2">
                <button
                  type="button"
                  onClick={() => onCluster(c)}
                  className="flex min-h-12 w-full cursor-pointer items-center justify-between gap-3 px-5 py-3 text-left text-sm hover:text-copper"
                >
                  <span className="font-medium">{c.name}</span>
                  <span className="text-ink-2">
                    <span aria-hidden="true">{c.count}</span>
                    <span className="sr-only">{t('list.area', { count: c.count, name: c.name })}</span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </>
      )}
      {status === 'ready' && level === 'places' && places.length > 0 && (
        <ul className="overflow-y-auto">
          {places.map((p) => {
            const layer = layerOf(p.type)
            return (
              <li key={p.slug} className="border-t border-line-2">
                <button
                  type="button"
                  aria-current={p.slug === selected ? 'true' : undefined}
                  onClick={() => onSelect(p)}
                  className="flex min-h-12 w-full cursor-pointer items-center gap-3 px-5 py-3 text-left text-sm hover:text-copper aria-[current=true]:text-copper"
                >
                  <LayerShape layer={layer} />
                  <span className="flex min-w-0 flex-col">
                    <span className="truncate font-medium">{p.name}</span>
                    <span className="text-xs text-ink-2">{tType(layer)}</span>
                  </span>
                </button>
              </li>
            )
          })}
        </ul>
      )}
      {status === 'ready' && capped && <p className="border-t border-line-2 px-5 py-3 text-xs text-ink-2">{t('list.capped', { count: places.length })}</p>}
    </section>
  )
}

/** MapMobile.dc.html bottom sheet: "N places in view" with horizontally scrolling cards. */
export function PlaceSheet({
  level,
  clusters,
  places,
  selected,
  heading,
  onSelect,
  onCluster,
}: Pick<Props, 'level' | 'clusters' | 'places' | 'selected' | 'onSelect' | 'onCluster'> & { heading: string }) {
  const t = useTranslations('map')
  const tType = useTranslations('map.layerName')
  const count = level === 'clusters' ? clusters.reduce((n, c) => n + c.count, 0) : places.length

  return (
    <section aria-label={t('list.label')} className="rounded-t-[18px] bg-bg pt-2.5 pb-4 shadow-(--shadow)">
      <div aria-hidden="true" className="mx-auto mb-3.5 h-1 w-10 rounded-full bg-line" />
      <div className="flex items-baseline justify-between px-5 pb-3">
        <div>
          {heading && <p className="eyebrow text-copper">{heading}</p>}
          <h2 className="mt-1 text-xl font-semibold">{t('sheet.inView', { count })}</h2>
        </div>
        <span className="text-xs text-ink-2">{t('sheet.swipe')}</span>
      </div>
      <ul className="flex snap-x gap-3 overflow-x-auto px-5 [scrollbar-width:none]">
        {level === 'clusters'
          ? clusters.map((c) => (
              <li key={`${c.city}-${c.neighbourhoodId ?? 'city'}`} className="shrink-0 snap-start">
                <button
                  type="button"
                  onClick={() => onCluster(c)}
                  className="flex min-h-14 cursor-pointer items-center gap-3 rounded-[10px] border border-line bg-surface px-4 text-sm"
                >
                  <span className="inline-flex size-9 items-center justify-center rounded-full border-[1.5px] border-ink text-[13px] font-semibold">{c.count}</span>
                  <span className="font-medium">{c.name}</span>
                </button>
              </li>
            ))
          : places.map((p) => {
              const layer = layerOf(p.type)
              return (
                <li key={p.slug} className="w-[240px] shrink-0 snap-start">
                  <button
                    type="button"
                    aria-current={p.slug === selected ? 'true' : undefined}
                    onClick={() => onSelect(p)}
                    className="flex min-h-[88px] w-full cursor-pointer flex-col items-start gap-1.5 rounded-[10px] border border-line bg-surface p-3.5 text-left aria-[current=true]:border-copper"
                  >
                    <span className="eyebrow flex items-center gap-1.5 text-ink-2">
                      <LayerShape layer={layer} />
                      {tType(layer)}
                    </span>
                    <span className="text-[15px] leading-[1.3] font-semibold">{p.name}</span>
                  </button>
                </li>
              )
            })}
      </ul>
    </section>
  )
}

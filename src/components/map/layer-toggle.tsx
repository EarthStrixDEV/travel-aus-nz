'use client'

import { useTranslations } from 'next-intl'
import { LAYER_KEYS, type LayerKey, type LayerState } from './layers'

/** Icon shapes from Map.dc.html: circle, rounded square, diamond, outlined square. */
export const SHAPE_CLASS: Record<LayerKey, string> = {
  attraction: 'size-3 rounded-full bg-current',
  restaurant: 'size-3 rounded-[3px] bg-current',
  bar: 'size-2.5 rotate-45 bg-current',
  transport: 'size-3 border-[1.5px] border-current',
}

export function LayerShape({ layer }: { layer: LayerKey }) {
  return (
    <span aria-hidden="true" className="inline-flex size-[18px] items-center justify-center">
      <span className={SHAPE_CLASS[layer]} />
    </span>
  )
}

/** Attraction / Restaurant / Bar / Transport toggles; counts come from the places response. */
export function LayerToggle({
  layers,
  counts,
  onToggle,
}: {
  layers: LayerState
  /** null while unknown (loading, or the layer is off). */
  counts: Record<LayerKey, number | null>
  onToggle: (key: LayerKey) => void
}) {
  const t = useTranslations('map.layers')
  return (
    <div role="group" aria-label={t('label')} className="flex gap-2 overflow-x-auto [scrollbar-width:none]">
      {LAYER_KEYS.map((key) => {
        const on = layers[key]
        const n = counts[key]
        return (
          <button
            key={key}
            type="button"
            aria-pressed={on}
            onClick={() => onToggle(key)}
            className={`inline-flex min-h-10 shrink-0 cursor-pointer items-center gap-2 rounded-full border bg-surface py-0 pr-3.5 pl-2.5 text-[13px] font-medium whitespace-nowrap shadow-(--shadow) transition-[border-color,color,box-shadow] duration-500 ${on ? 'border-copper text-ink inset-ring inset-ring-copper' : 'border-line text-ink-2'}`}
          >
            <LayerShape layer={key} />
            {t(key)}
            {on && n !== null && (
              <span className="text-[11px] font-normal text-ink-2">
                <span aria-hidden="true">{n}</span>
                <span className="sr-only">{t('count', { count: n })}</span>
              </span>
            )}
          </button>
        )
      })}
    </div>
  )
}

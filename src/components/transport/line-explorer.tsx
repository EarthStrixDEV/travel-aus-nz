'use client'

import { useTranslations } from 'next-intl'
import { useEffect, useId, useState } from 'react'
import { Segmented } from '@/components/money/segmented'
import type { CityLine, TransportCity } from '@/lib/content/transport'
import { ModeIcon, ModeStroke, useDurationText } from './route-legs'
import { fareRange } from './route-options'

type Lines = { status: 'loading' } | { status: 'error' } | { status: 'ready'; lines: CityLine[] }

/** At most five labelled stops on the track: both ends and three evenly spaced between. */
function sampleStops(stops: string[]): { name: string; edge: boolean }[] {
  if (stops.length <= 5) return stops.map((name, i) => ({ name, edge: i === 0 || i === stops.length - 1 }))
  const last = stops.length - 1
  return [0, Math.round(last / 4), Math.round(last / 2), Math.round((3 * last) / 4), last].map((i) => ({ name: stops[i], edge: i === 0 || i === last }))
}

function Legend() {
  const t = useTranslations('transport.explorer')
  const items = [
    { mode: 'train', label: t('legendTrain') },
    { mode: 'tram', label: t('legendTram') },
    { mode: 'bus', label: t('legendBus') },
    { mode: 'ferry', label: t('legendFerry') },
  ] as const
  return (
    <ul aria-label={t('legend')} className="mt-8 mb-2 flex flex-wrap gap-x-7 gap-y-3 text-xs text-ink-2">
      {items.map((i) => (
        <li key={i.mode} className="flex items-center gap-2">
          <ModeStroke mode={i.mode} className="w-8" />
          {i.label}
        </li>
      ))}
      <li className="flex items-center gap-2 text-copper">
        <ModeStroke mode="train" className="w-8" />
        {t('legendSelected')}
      </li>
    </ul>
  )
}

function LineRow({ line, currency, open, onToggle }: { line: CityLine; currency: string; open: boolean; onToggle: () => void }) {
  const t = useTranslations('transport.explorer')
  const tMode = useTranslations('transport.mode')
  const tResults = useTranslations('transport.results')
  const duration = useDurationText()
  const panelId = useId()
  const name = [line.short_name, line.long_name].filter(Boolean).join(' · ')
  const { headway_peak_min: peak, headway_offpeak_min: off } = line
  const every =
    peak !== null && off !== null && peak !== off
      ? t('headway', { peak: Math.min(peak, off), offpeak: Math.max(peak, off) })
      : (peak ?? off) !== null
        ? t('headwayOne', { min: (peak ?? off)! })
        : t('unknown')
  const fare = fareRange(line.fare_min, line.fare_max, currency) ?? tResults('checkFare')
  const stops = sampleStops(line.stops)

  return (
    <li className={`border-t border-line-2 ${open ? 'text-copper' : 'text-ink'}`}>
      <button
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={onToggle}
        className="grid w-full cursor-pointer grid-cols-1 items-center gap-4 py-6 text-left transition-colors duration-500 hover:text-copper md:grid-cols-[200px_minmax(0,1fr)_220px] md:gap-8 md:py-[26px]"
      >
        <span>
          <span className="eyebrow flex items-center gap-1.5 text-ink-2">
            <ModeIcon mode={line.mode} size={13} />
            {tMode(line.mode)}
          </span>
          <span className="mt-1.5 block text-lg font-semibold">{name}</span>
        </span>
        <span aria-hidden="true" className="relative block pt-3.5 pb-1">
          <ModeStroke mode={line.mode} className="absolute top-5 right-1.5 left-1.5" />
          <span className="relative flex justify-between">
            {stops.map((s, i) => (
              <span key={i} className={`w-3 flex-col items-center gap-2 overflow-visible ${s.edge ? 'flex' : 'hidden md:flex'}`}>
                <span className="size-[13px] flex-none rounded-full border-2 border-current bg-bg" />
                <span className="text-xs font-normal whitespace-nowrap text-ink-2">{s.name}</span>
              </span>
            ))}
          </span>
        </span>
        <span className="grid grid-cols-3 gap-3 text-xs text-ink-2">
          {[
            [t('time'), line.end_to_end_min !== null ? duration(line.end_to_end_min) : t('unknown')],
            [t('every'), every],
            [t('fare'), fare],
          ].map(([label, value]) => (
            <span key={label}>
              <span className="eyebrow block text-[9px]">{label}</span>
              <span className="mt-1 block text-sm font-medium text-ink">{value}</span>
            </span>
          ))}
        </span>
      </button>
      <div id={panelId} hidden={!open} className="pb-6 text-ink">
        <p className="eyebrow text-ink-2">
          {t('allStops')} · {t('stops', { count: line.stops.length })}
        </p>
        <ol className="mt-3 flex flex-wrap gap-x-3 gap-y-1.5 text-sm">
          {line.stops.map((s, i) => (
            <li key={i} className="after:ml-3 after:text-ink-3 after:content-['→'] last:after:content-none">
              {s}
            </li>
          ))}
        </ol>
      </div>
    </li>
  )
}

/** §7 route explorer: pick a city, see each line's stops, end-to-end time, frequency and fare. */
export function LineExplorer({ cities, initial }: { cities: TransportCity[]; initial: { city: string; lines: CityLine[] } | null }) {
  const t = useTranslations('transport.explorer')
  const [city, setCity] = useState(initial?.city ?? cities[0]?.slug ?? '')
  const [byCity, setByCity] = useState<Record<string, Lines>>(initial ? { [initial.city]: { status: 'ready', lines: initial.lines } } : {})
  const [open, setOpen] = useState<number | null>(0)

  const current = cities.find((c) => c.slug === city)
  const state = byCity[city]

  function load(slug: string) {
    setByCity((m) => ({ ...m, [slug]: { status: 'loading' } }))
    fetch(`/api/v1/transit/cities/${encodeURIComponent(slug)}/lines`)
      .then(async (res) => {
        if (!res.ok) throw new Error(String(res.status))
        const body: { lines: CityLine[] } = await res.json()
        setByCity((m) => ({ ...m, [slug]: { status: 'ready', lines: body.lines } }))
      })
      .catch(() => setByCity((m) => ({ ...m, [slug]: { status: 'error' } })))
  }

  // Each city is fetched once; switching back shows what is already loaded.
  useEffect(() => {
    if (city && !state) load(city)
  }, [city, state])

  if (!current) return null
  const currency = current.country === 'nz' ? 'NZD' : 'AUD'

  return (
    <section aria-labelledby="route-explorer" className="mx-auto max-w-[1440px] px-[clamp(16px,4vw,56px)] pt-24 md:pt-[140px]">
      <div className="flex flex-wrap items-end justify-between gap-6">
        <div>
          <p className="eyebrow text-copper">{t('eyebrow')}</p>
          <h2 id="route-explorer" className="mt-3.5 text-[28px] leading-[1.1] font-semibold md:text-[clamp(30px,3.2vw,46px)]">
            {t('title', { city: current.name })}
          </h2>
        </div>
        {cities.length > 1 && (
          <Segmented
            label={t('city')}
            value={city}
            options={cities.map((c) => ({ value: c.slug, label: c.name }))}
            onChange={(v) => {
              setCity(v)
              setOpen(0)
            }}
            className="flex-wrap"
          />
        )}
      </div>
      <Legend />
      <div aria-live="polite">
        {(!state || state.status === 'loading') && <p className="border-t border-line-2 py-6 text-sm text-ink-2">{t('loading')}</p>}
        {state?.status === 'error' && (
          <p className="flex items-center gap-3 border-t border-line-2 py-6 text-sm text-ink-2">
            {t('error')}
            <button type="button" onClick={() => load(city)} className="min-h-11 cursor-pointer font-medium text-copper underline-offset-4 hover:underline">
              {t('retry')}
            </button>
          </p>
        )}
        {state?.status === 'ready' && state.lines.length === 0 && (
          <p className="border-t border-line-2 py-6 text-sm text-ink-2">{t('empty', { city: current.name })}</p>
        )}
      </div>
      {state?.status === 'ready' && state.lines.length > 0 && (
        <ul className="border-b border-line-2">
          {state.lines.map((line, i) => (
            <LineRow
              key={`${line.mode}:${line.short_name}:${i}`}
              line={line}
              currency={currency}
              open={open === i}
              onToggle={() => setOpen((o) => (o === i ? null : i))}
            />
          ))}
        </ul>
      )}
    </section>
  )
}

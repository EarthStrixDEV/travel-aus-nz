'use client'

import dynamic from 'next/dynamic'
import { useSearchParams } from 'next/navigation'
import { useLocale, useTranslations } from 'next-intl'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { track } from '@/lib/analytics/track'
import type { Bbox } from '@/lib/content/geo'
import type { MapCity, MapCluster, MapPlaces, MapTransit, PlaceWithStatus } from '@/lib/content/places'
import type { Country } from '@/lib/content/shared'
import type { Locale } from '@/lib/i18n/t'
import { Breadcrumb } from './breadcrumb'
import { LayerShape, LayerToggle } from './layer-toggle'
import {
  ALL_LAYERS,
  apiBbox,
  CITY_ZOOM,
  containsPoint,
  COUNTRY_BOUNDS,
  LAYER_KEYS,
  layerCount,
  layerOf,
  matchesQuery,
  PLACES_ZOOM,
  typesFor,
  type LayerKey,
  type LayerState,
} from './layers'
import type { CameraCommand, CameraTarget, WalkRoute } from './map-canvas'
import { PlaceDrawer, type DrawerStatus } from './place-drawer'
import { PlaceList, PlaceSheet, type ListStatus, type Pin } from './place-list'

// maplibre-gl touches `window`: client only, never in the server bundle.
const MapCanvas = dynamic(() => import('./map-canvas'), {
  ssr: false,
  loading: () => <div className="absolute inset-0 bg-ph-1" />,
})

const API_CAP = 500
const SLUG = /^[a-z0-9-]{1,120}$/
type Viewport = { bbox: Bbox; zoom: number }

function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false)
  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
    setReduced(mq.matches)
    const on = (e: MediaQueryListEvent) => setReduced(e.matches)
    mq.addEventListener('change', on)
    return () => mq.removeEventListener('change', on)
  }, [])
  return reduced
}

function setPlaceParam(slug: string | null) {
  const url = new URL(window.location.href)
  if (slug) url.searchParams.set('place', slug)
  else url.searchParams.delete('place')
  window.history.replaceState(null, '', url)
}

/**
 * Interactive map (spec §5): overview (country, neighbourhood clusters) and city level
 * (places, transit, walk route). Without a map style (production, R7) it is list view only.
 */
export function MapView({ cities, styleUrl }: { cities: MapCity[]; styleUrl: string | null }) {
  const t = useTranslations('map')
  const tLayer = useTranslations('map.layerName')
  const locale = useLocale() as Locale
  const searchParams = useSearchParams()
  const reducedMotion = useReducedMotion()
  const listOnly = styleUrl === null

  // R1: `?place=<slug>` opens that drawer and centres the map on it.
  const [deepLink] = useState(() => {
    const s = searchParams.get('place')
    return s && SLUG.test(s) ? s : null
  })

  const [country, setCountry] = useState<Country>('au')
  const [listCity, setListCity] = useState<MapCity | null>(() => cities.find((c) => c.country === 'au' && c.bbox) ?? null)
  const cmdId = useRef(0)
  const [command, setCommand] = useState<CameraCommand>({ id: 0, kind: 'fit', bbox: COUNTRY_BOUNDS.au })
  const camera = useCallback((c: CameraTarget) => setCommand({ ...c, id: ++cmdId.current }), [])
  const [mapViewport, setMapViewport] = useState<Viewport | null>(null)

  const viewport: Viewport | null = listOnly ? (listCity?.bbox ? { bbox: listCity.bbox, zoom: CITY_ZOOM } : null) : mapViewport

  const activeCity = useMemo(() => {
    if (listOnly) return listCity
    if (!mapViewport || mapViewport.zoom < 8) return null
    const [w, s, e, n] = mapViewport.bbox
    const center: [number, number] = [(w + e) / 2, (s + n) / 2]
    return cities.find((c) => c.bbox && containsPoint(c.bbox, center)) ?? null
  }, [cities, listOnly, listCity, mapViewport])
  const shownCountry = activeCity?.country ?? country

  // --- places in view ---------------------------------------------------------
  const [layers, setLayers] = useState<LayerState>(ALL_LAYERS)
  const [data, setData] = useState<MapPlaces | null>(null)
  const [status, setStatus] = useState<ListStatus>('loading')
  const [reload, setReload] = useState(0)
  const types = typesFor(layers)
  const noLayers = LAYER_KEYS.every((k) => !layers[k])
  const box = viewport ? apiBbox(viewport.bbox).join(',') : ''
  const zoom = viewport ? Math.min(22, Math.max(0, Math.floor(viewport.zoom))) : 0
  const typesKey = types.join(',')

  useEffect(() => {
    if (!box) return
    if (noLayers) {
      setData(
        zoom < PLACES_ZOOM
          ? { level: 'clusters', clusters: [], counts: {} }
          : { level: 'places', features: { type: 'FeatureCollection', features: [] }, counts: {} },
      )
      setStatus('ready')
      return
    }
    const ctrl = new AbortController()
    const timer = setTimeout(() => {
      const qs = new URLSearchParams({ bbox: box, zoom: String(zoom), locale })
      for (const ty of typesKey ? typesKey.split(',') : []) qs.append('types[]', ty)
      fetch(`/api/v1/map/places?${qs}`, { signal: ctrl.signal })
        .then((r) => (r.ok ? (r.json() as Promise<MapPlaces>) : Promise.reject(new Error(String(r.status)))))
        .then((d) => {
          setData(d)
          setStatus('ready')
        })
        .catch((e: unknown) => {
          if ((e as Error).name !== 'AbortError') setStatus('error')
        })
    }, 200)
    return () => {
      clearTimeout(timer)
      ctrl.abort()
    }
  }, [box, zoom, typesKey, noLayers, locale, reload])

  const [query, setQuery] = useState('')
  const pins: Pin[] = useMemo(
    () =>
      data?.level === 'places'
        ? data.features.features
            .map((f) => ({ ...f.properties, lng: f.geometry.coordinates[0], lat: f.geometry.coordinates[1] }))
            .filter((p) => matchesQuery(p.name, query))
        : [],
    [data, query],
  )
  const clusters: MapCluster[] = useMemo(
    () => (data?.level === 'clusters' ? data.clusters.filter((c) => matchesQuery(c.name, query)) : []),
    [data, query],
  )
  const level = data?.level ?? 'clusters'
  const capped = data?.level === 'places' && data.features.features.length >= API_CAP
  const counts = Object.fromEntries(
    LAYER_KEYS.map((k) => [k, layers[k] && data && status === 'ready' ? layerCount(data.counts, k) : null]),
  ) as Record<LayerKey, number | null>

  // --- transit lines for the city in view ---------------------------------------
  const [transit, setTransit] = useState<MapTransit | null>(null)
  const transitCache = useRef(new Map<number, MapTransit>())
  const transitCityId = !listOnly && layers.transport && activeCity && (mapViewport?.zoom ?? 0) >= 11 ? activeCity.id : null
  useEffect(() => {
    if (transitCityId === null) {
      setTransit(null)
      return
    }
    const hit = transitCache.current.get(transitCityId)
    if (hit) {
      setTransit(hit)
      return
    }
    const ctrl = new AbortController()
    fetch(`/api/v1/map/transit?city_id=${transitCityId}`, { signal: ctrl.signal })
      .then((r) => (r.ok ? (r.json() as Promise<MapTransit>) : Promise.reject(new Error(String(r.status)))))
      .then((d) => {
        transitCache.current.set(transitCityId, d)
        setTransit(d)
      })
      .catch(() => {
        // Transit lines are decoration; places still work without them.
      })
    return () => ctrl.abort()
  }, [transitCityId])

  // --- selected place / drawer --------------------------------------------------
  const [selected, setSelected] = useState<string | null>(deepLink)
  const [detail, setDetail] = useState<PlaceWithStatus | null>(null)
  const [detailStatus, setDetailStatus] = useState<DrawerStatus>('loading')
  const [detailReload, setDetailReload] = useState(0)
  const recenter = useRef(deepLink !== null)
  const returnFocus = useRef<HTMLElement | null>(null)

  // Analytics: one `place_view` per drawer opening, slug only.
  useEffect(() => {
    if (selected) track('place_view', { slug: selected })
  }, [selected])

  const select = useCallback((slug: string, center: boolean) => {
    returnFocus.current = document.activeElement instanceof HTMLElement ? document.activeElement : null
    recenter.current = center
    setSelected(slug)
    setPlaceParam(slug)
  }, [])

  const close = useCallback(() => {
    setSelected(null)
    setDetail(null)
    setPlaceParam(null)
    returnFocus.current?.focus({ preventScroll: true })
  }, [])

  useEffect(() => {
    if (!selected) return
    const ctrl = new AbortController()
    setDetailStatus('loading')
    fetch(`/api/v1/places/${selected}?locale=${locale}`, { signal: ctrl.signal })
      .then((r) => (r.ok ? (r.json() as Promise<PlaceWithStatus>) : Promise.reject(new Error(String(r.status)))))
      .then((d) => {
        setDetail(d)
        setDetailStatus('ready')
        if (recenter.current) {
          recenter.current = false
          if (d.country) setCountry(d.country)
          if (listOnly) {
            const city = cities.find((c) => c.slug === d.city?.slug)
            if (city) setListCity(city)
          } else {
            camera({ kind: 'center', lng: d.lng, lat: d.lat, zoom: CITY_ZOOM })
          }
        }
      })
      .catch((e: unknown) => {
        if ((e as Error).name !== 'AbortError') setDetailStatus('error')
      })
    return () => ctrl.abort()
  }, [selected, locale, detailReload, listOnly, cities, camera])

  const walk: WalkRoute | null = useMemo(() => {
    const stop = detail && detail.slug === selected ? detail.stops[0] : undefined
    return stop ? { line: stop.walk, stop: [stop.lng, stop.lat] } : null
  }, [detail, selected])

  // --- navigation ------------------------------------------------------------------
  const goCountry = (c: Country) => {
    setCountry(c)
    if (listOnly) setListCity(cities.find((x) => x.country === c && x.bbox) ?? null)
    else camera({ kind: 'fit', bbox: COUNTRY_BOUNDS[c] })
  }
  const goCity = (c: MapCity) => {
    setCountry(c.country)
    if (listOnly) setListCity(c)
    else camera({ kind: 'center', lng: c.center[0], lat: c.center[1], zoom: PLACES_ZOOM })
  }
  const goCluster = (c: MapCluster) => camera({ kind: 'center', lng: c.lng, lat: c.lat, zoom: CITY_ZOOM })

  // --- my location (client only; coordinates are never sent to the server) ---------
  const [user, setUser] = useState<[number, number] | null>(null)
  const [locNote, setLocNote] = useState('')
  const locate = () => {
    if (!('geolocation' in navigator)) {
      setLocNote(t('controls.locateError'))
      return
    }
    setLocNote(t('controls.locating'))
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const p: [number, number] = [pos.coords.longitude, pos.coords.latitude]
        setUser(p)
        camera({ kind: 'center', lng: p[0], lat: p[1], zoom: CITY_ZOOM })
        setLocNote(t('controls.located'))
      },
      () => setLocNote(t('controls.locateError')),
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 60000 },
    )
  }

  const [listOpen, setListOpen] = useState(false)
  const showList = listOnly || listOpen
  const countryName = t(`country.${shownCountry}`)
  const area = activeCity?.name ?? countryName
  const total = data ? Object.values(data.counts).reduce((n, v) => n + (v ?? 0), 0) : 0
  const overviewCity = cities.find((c) => c.country === shownCountry)

  const list = (
    <PlaceList
      level={level}
      clusters={clusters}
      places={pins}
      selected={selected}
      status={status}
      capped={capped}
      onSelect={(p) => select(p.slug, true)}
      onCluster={goCluster}
      onRetry={() => setReload((n) => n + 1)}
    />
  )

  return (
    <div className={`relative overflow-hidden ${listOnly ? 'min-h-[70dvh] bg-bg' : 'h-[calc(100dvh-65px-72px)] bg-ph-1 lg:h-[calc(100dvh-73px)]'}`}>
      <h1 className="sr-only">{t('title')}</h1>
      <p id="map-canvas-hint" className="sr-only">
        {t('canvasHint')}
      </p>

      {/* Filter bar (Map.dc.html), first in tab order. */}
      <div className="absolute inset-x-4 top-4 z-20 flex flex-col gap-3 md:inset-x-auto md:top-5 md:left-6 md:max-w-[calc(100%-480px)]">
        <div className="flex flex-wrap items-center gap-2.5">
          <label className="flex h-12 min-w-0 basis-full items-center gap-2.5 rounded-full border border-line bg-surface px-4 shadow-(--shadow) md:w-[340px] md:basis-auto">
            <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="flex-none text-ink-2">
              <circle cx="11" cy="11" r="7" />
              <path d="M20 20l-4-4" />
            </svg>
            <span className="sr-only">{t('search.label')}</span>
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t('search.placeholder', { area })}
              className="w-full min-w-0 bg-transparent text-sm text-ink outline-none placeholder:text-ink-2"
            />
          </label>
          <Breadcrumb country={shownCountry} cities={cities} activeCity={activeCity} onCountry={goCountry} onCity={goCity} />
        </div>
        <LayerToggle layers={layers} counts={counts} onToggle={(k) => setLayers((l) => ({ ...l, [k]: !l[k] }))} />
        {!listOnly && (
          <div>
            <Button
              variant="ghost"
              aria-expanded={listOpen}
              aria-controls="map-place-list"
              onClick={() => setListOpen((o) => !o)}
              className="min-h-10 bg-surface text-[13px] shadow-(--shadow)"
            >
              {listOpen ? t('view.map') : t('view.list')}
            </Button>
          </div>
        )}
      </div>

      {showList && (
        <div
          id="map-place-list"
          className={
            listOnly
              ? 'relative z-10 mx-auto max-w-[720px] px-4 pt-[220px] pb-10 md:pt-[180px]'
              : 'absolute inset-x-0 top-[248px] bottom-0 z-20 overflow-y-auto bg-surface md:inset-x-auto md:top-[200px] md:bottom-6 md:left-6 md:w-[380px] md:rounded-[10px] md:border md:border-line md:shadow-(--shadow)'
          }
        >
          {listOnly && <p className="mb-4 rounded-[10px] border border-line bg-surface px-5 py-4 text-sm text-ink-2">{t('noStyle')}</p>}
          <div className={listOnly ? 'rounded-[10px] border border-line bg-surface' : undefined}>{list}</div>
        </div>
      )}

      {styleUrl && (
        <div role="region" aria-label={t('canvas')} className="absolute inset-0 z-0">
          <MapCanvas
            styleUrl={styleUrl}
            label={t('canvas')}
            hintId="map-canvas-hint"
            command={command}
            reducedMotion={reducedMotion}
            clusters={clusters}
            pins={pins}
            selected={selected}
            walk={walk}
            transit={transit}
            user={user}
            pinLabel={(p) => t('pin', { type: tLayer(layerOf(p.type)), name: p.name })}
            clusterLabel={(c) => t('list.area', { count: c.count, name: c.name })}
            onViewport={(bbox, z) => setMapViewport({ bbox, zoom: z })}
            onSelect={(p) => select(p.slug, false)}
            onCluster={goCluster}
          />
        </div>
      )}

      {/* Zoom, my location, legend */}
      {!listOnly && (
        <div className="absolute bottom-6 left-6 z-10 hidden items-end gap-3 md:flex">
          <div className="flex flex-col overflow-hidden rounded-[8px] border border-line bg-surface shadow-(--shadow)">
            {(
              [
                ['zoomIn', () => camera({ kind: 'zoom', delta: 1 }), <path key="i" d="M12 5v14M5 12h14" />],
                ['zoomOut', () => camera({ kind: 'zoom', delta: -1 }), <path key="o" d="M5 12h14" />],
                ['locate', locate, <g key="l"><circle cx="12" cy="12" r="3" /><path d="M12 2v4M12 18v4M2 12h4M18 12h4" /></g>],
              ] as const
            ).map(([key, onClick, icon]) => (
              <button
                key={key}
                type="button"
                aria-label={t(`controls.${key}`)}
                onClick={onClick}
                className="flex size-11 cursor-pointer items-center justify-center border-b border-line-2 text-ink last:border-b-0 hover:text-copper"
              >
                <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                  {icon}
                </svg>
              </button>
            ))}
          </div>
          <div aria-label={t('legend.label')} role="group" className="flex items-center gap-5 rounded-[8px] border border-line bg-surface px-[18px] py-3.5 text-xs text-ink-2 shadow-(--shadow)">
            {LAYER_KEYS.map((k) => (
              <span key={k} className="flex items-center gap-1.5">
                <LayerShape layer={k} />
                {tLayer(k)}
              </span>
            ))}
            <span aria-hidden="true" className="h-4 w-px bg-line" />
            <span className="flex items-center gap-2">
              <span aria-hidden="true" className="w-[22px] border-t-[3px] border-dotted border-copper" />
              {t('legend.route')}
            </span>
          </div>
        </div>
      )}
      <p aria-live="polite" className="sr-only">
        {locNote}
      </p>

      {/* Overview card: country level, nothing selected. */}
      {!listOnly && !activeCity && !selected && data?.level === 'clusters' && overviewCity && (
        <div className="absolute top-5 right-6 z-10 hidden w-[340px] rounded-[10px] border border-line bg-surface p-6 shadow-(--shadow) md:block">
          <p className="eyebrow text-copper">{t('overview.eyebrow', { country: countryName, count: total })}</p>
          <h2 className="mt-2.5 text-2xl font-semibold">{t('overview.title')}</h2>
          <p className="mt-2.5 text-sm leading-[1.65] text-ink-2">{t('overview.text')}</p>
          <Button onClick={() => goCity(overviewCity)} className="mt-5 w-full">
            {t('overview.open', { city: overviewCity.name })}
          </Button>
        </div>
      )}

      {/* Mobile bottom sheet (MapMobile.dc.html) when nothing is selected. */}
      {!listOnly && !listOpen && !selected && data && status === 'ready' && (
        <div className="absolute inset-x-0 bottom-0 z-10 md:hidden">
          <PlaceSheet
            level={level}
            clusters={clusters}
            places={pins}
            selected={selected}
            heading={area}
            onSelect={(p) => select(p.slug, true)}
            onCluster={goCluster}
          />
        </div>
      )}

      {selected && (
        <PlaceDrawer
          slug={selected}
          status={detailStatus}
          place={detail?.slug === selected ? detail : null}
          onClose={close}
          onRetry={() => setDetailReload((n) => n + 1)}
        />
      )}
    </div>
  )
}

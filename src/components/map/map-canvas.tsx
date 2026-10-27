'use client'

import maplibregl from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import { useEffect, useRef, useState } from 'react'
import type { Bbox, LineString } from '@/lib/content/geo'
import type { MapCluster, MapTransit } from '@/lib/content/places'
import { layerOf, type LayerKey } from './layers'
import type { Pin } from './place-list'

export type CameraTarget =
  | { kind: 'fit'; bbox: Bbox }
  | { kind: 'center'; lng: number; lat: number; zoom: number }
  | { kind: 'zoom'; delta: number }
export type CameraCommand = CameraTarget & { id: number }

export type WalkRoute = { line: LineString | null; stop: [number, number] }

type Props = {
  styleUrl: string
  label: string
  hintId: string
  command: CameraCommand
  reducedMotion: boolean
  clusters: MapCluster[]
  pins: Pin[]
  selected: string | null
  walk: WalkRoute | null
  transit: MapTransit | null
  user: [number, number] | null
  pinLabel: (pin: Pin) => string
  clusterLabel: (c: MapCluster) => string
  onViewport: (bbox: Bbox, zoom: number) => void
  onSelect: (pin: Pin) => void
  onCluster: (c: MapCluster) => void
  /** The style never loaded (error before `load`, or `STYLE_TIMEOUT_MS` passed): the page falls back to list view. */
  onStyleError: () => void
}

export const STYLE_TIMEOUT_MS = 10_000

// Shapes from Map.dc.html (circle, rounded square, diamond, outlined square): never colour alone.
const SHAPE: Record<LayerKey, string> = {
  attraction: 'size-[30px] rounded-full bg-ink',
  restaurant: 'size-[27px] rounded-[7px] bg-ink',
  bar: 'size-[23px] rotate-45 rounded-[3px] bg-ink',
  transport: 'size-[26px] rounded-[2px] border-[1.5px] border-ink bg-surface',
}
const SELECTED = 'border-copper! bg-copper! ring-[7px] ring-copper-tint'
const PADDING = 48

const EMPTY = { type: 'FeatureCollection', features: [] } as const

type GeoData = Parameters<maplibregl.GeoJSONSource['setData']>[0]

function cssVar(name: string, fallback: string): string {
  const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim()
  return v || fallback
}

function addOverlayLayers(map: maplibregl.Map) {
  const ink = cssVar('--ink', '#13213A')
  const ink3 = cssVar('--ink3', '#8A92A3')
  const surface = cssVar('--surface', '#FBF9F4')
  const copper = cssVar('--copper', '#9E5229')
  for (const id of ['transit-lines', 'transit-stations', 'walk-route', 'walk-stop', 'user-location']) {
    map.addSource(id, { type: 'geojson', data: EMPTY as unknown as GeoData })
  }
  // Modes are told apart by dash pattern, not colour.
  map.addLayer({
    id: 'transit-rail', type: 'line', source: 'transit-lines',
    filter: ['in', ['get', 'mode'], ['literal', ['train', 'metro']]],
    paint: { 'line-color': ink3, 'line-width': 3 },
  })
  map.addLayer({
    id: 'transit-ferry', type: 'line', source: 'transit-lines',
    filter: ['==', ['get', 'mode'], 'ferry'],
    paint: { 'line-color': ink3, 'line-width': 2, 'line-dasharray': [4, 3] },
  })
  map.addLayer({
    id: 'transit-road', type: 'line', source: 'transit-lines',
    filter: ['in', ['get', 'mode'], ['literal', ['tram', 'bus', 'coach']]],
    paint: { 'line-color': ink3, 'line-width': 2, 'line-dasharray': [1, 2] },
  })
  map.addLayer({
    id: 'transit-stations', type: 'circle', source: 'transit-stations',
    paint: { 'circle-radius': 4, 'circle-color': surface, 'circle-stroke-color': ink, 'circle-stroke-width': 1.5 },
  })
  map.addLayer({
    id: 'walk-route', type: 'line', source: 'walk-route',
    layout: { 'line-cap': 'round' },
    paint: { 'line-color': copper, 'line-width': 3.5, 'line-dasharray': [0.6, 2] },
  })
  map.addLayer({
    id: 'walk-stop', type: 'circle', source: 'walk-stop',
    paint: { 'circle-radius': 6, 'circle-color': surface, 'circle-stroke-color': copper, 'circle-stroke-width': 2.5 },
  })
  map.addLayer({
    id: 'user-location', type: 'circle', source: 'user-location',
    paint: { 'circle-radius': 7, 'circle-color': ink, 'circle-stroke-color': surface, 'circle-stroke-width': 3 },
  })
}

function setData(map: maplibregl.Map, id: string, data: unknown) {
  const src = map.getSource(id) as maplibregl.GeoJSONSource | undefined
  void src?.setData(data as GeoData)
}

/** Markers are pointer affordances; keyboard and screen-reader users get the list view (WCAG). */
function pinElement(pin: Pin, label: string, onClick: () => void): HTMLButtonElement {
  const el = document.createElement('button')
  el.type = 'button'
  el.tabIndex = -1
  el.setAttribute('aria-hidden', 'true')
  el.title = label
  el.className = 'flex size-11 cursor-pointer items-center justify-center'
  const shape = document.createElement('span')
  shape.className = `${SHAPE[layerOf(pin.type)]} block transition-[background-color,box-shadow] duration-500 hover:ring-[5px] hover:ring-line`
  el.appendChild(shape)
  el.addEventListener('click', (e) => {
    e.stopPropagation()
    onClick()
  })
  return el
}

function clusterElement(c: MapCluster, label: string, onClick: () => void): HTMLButtonElement {
  const el = document.createElement('button')
  el.type = 'button'
  el.tabIndex = -1
  el.setAttribute('aria-hidden', 'true')
  el.title = label
  el.className = 'flex cursor-pointer flex-col items-center gap-1.5 text-ink'
  const size = Math.round(34 + Math.min(c.count, 30) * 0.4)
  const badge = document.createElement('span')
  badge.className =
    'flex items-center justify-center rounded-full border-[1.5px] border-ink bg-surface text-[13px] font-semibold transition-shadow duration-500 hover:ring-[6px] hover:ring-line'
  badge.style.width = badge.style.height = `${size}px`
  badge.textContent = String(c.count)
  const name = document.createElement('span')
  name.className = 'bg-bg/80 px-1 text-[11px] font-medium tracking-[.12em] text-ink-2 uppercase'
  name.textContent = c.name
  el.append(badge, name)
  el.addEventListener('click', (e) => {
    e.stopPropagation()
    onClick()
  })
  return el
}

export default function MapCanvas(props: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<maplibregl.Map | null>(null)
  const markersRef = useRef<Map<string, { marker: maplibregl.Marker; shape: HTMLElement | null }>>(new Map())
  const appliedRef = useRef<number>(-1)
  const propsRef = useRef(props)
  propsRef.current = props
  const [ready, setReady] = useState(false)

  // Create the map once per style.
  useEffect(() => {
    if (!containerRef.current) return
    const first = propsRef.current.command
    appliedRef.current = first.id
    const map = new maplibregl.Map({
      container: containerRef.current,
      style: props.styleUrl,
      ...(first.kind === 'fit'
        ? { bounds: [[first.bbox[0], first.bbox[1]], [first.bbox[2], first.bbox[3]]], fitBoundsOptions: { padding: PADDING } }
        : first.kind === 'center'
          ? { center: [first.lng, first.lat], zoom: first.zoom }
          : {}),
      attributionControl: { compact: true },
      dragRotate: false,
      pitchWithRotate: false,
    })
    map.touchZoomRotate.disableRotation()
    mapRef.current = map
    const markers = markersRef.current

    const emit = () => {
      const b = map.getBounds()
      propsRef.current.onViewport([b.getWest(), b.getSouth(), b.getEast(), b.getNorth()], map.getZoom())
    }
    // A bad style URL or key never fires `load`; without this the map and its list stay on "Loading".
    let loaded = false
    let failed = false
    const fail = () => {
      if (loaded || failed) return
      failed = true
      propsRef.current.onStyleError()
    }
    const styleTimer = setTimeout(fail, STYLE_TIMEOUT_MS)
    map.on('error', fail)
    map.on('moveend', emit)
    map.on('load', () => {
      loaded = true
      clearTimeout(styleTimer)
      addOverlayLayers(map)
      setReady(true)
      emit()
    })
    map.getCanvas().setAttribute('aria-label', propsRef.current.label)
    map.getCanvas().setAttribute('aria-describedby', propsRef.current.hintId)

    return () => {
      clearTimeout(styleTimer)
      markers.forEach(({ marker }) => marker.remove())
      markers.clear()
      map.remove()
      mapRef.current = null
      setReady(false)
    }
  }, [props.styleUrl])

  // Camera commands (country / city / place / zoom / my location).
  const { command, reducedMotion } = props
  useEffect(() => {
    const map = mapRef.current
    if (!map || command.id === appliedRef.current) return
    appliedRef.current = command.id
    const animate = !reducedMotion
    if (command.kind === 'fit') {
      map.fitBounds([[command.bbox[0], command.bbox[1]], [command.bbox[2], command.bbox[3]]], { padding: PADDING, animate })
    } else if (command.kind === 'center') {
      const opts = { center: [command.lng, command.lat] as [number, number], zoom: command.zoom }
      if (animate) map.flyTo(opts)
      else map.jumpTo(opts)
    } else {
      map.zoomTo(map.getZoom() + command.delta, { animate })
    }
  }, [command, reducedMotion])

  // Markers: clusters (zoom < 13) or individual places.
  const { clusters, pins } = props
  useEffect(() => {
    const map = mapRef.current
    if (!map) return
    const markers = markersRef.current
    markers.forEach(({ marker }) => marker.remove())
    markers.clear()
    const p = propsRef.current
    for (const c of clusters) {
      const el = clusterElement(c, p.clusterLabel(c), () => propsRef.current.onCluster(c))
      markers.set(`c:${c.city}:${c.neighbourhoodId ?? 'city'}`, {
        marker: new maplibregl.Marker({ element: el }).setLngLat([c.lng, c.lat]).addTo(map),
        shape: null,
      })
    }
    for (const pin of pins) {
      const el = pinElement(pin, p.pinLabel(pin), () => propsRef.current.onSelect(pin))
      markers.set(`p:${pin.slug}`, {
        marker: new maplibregl.Marker({ element: el }).setLngLat([pin.lng, pin.lat]).addTo(map),
        shape: el.firstElementChild as HTMLElement,
      })
    }
  }, [clusters, pins, ready])

  // Selected pin highlight.
  const { selected } = props
  useEffect(() => {
    markersRef.current.forEach(({ marker, shape }, key) => {
      if (!shape) return
      const on = key === `p:${selected}`
      for (const cls of SELECTED.split(' ')) shape.classList.toggle(cls, on)
      marker.getElement().style.zIndex = on ? '3' : ''
    })
  }, [selected, clusters, pins, ready])

  // GeoJSON overlays.
  const { walk, transit, user } = props
  useEffect(() => {
    const map = mapRef.current
    if (!map || !ready) return
    setData(map, 'transit-lines', transit?.lines ?? EMPTY)
    setData(map, 'transit-stations', transit?.stations ?? EMPTY)
  }, [transit, ready])

  useEffect(() => {
    const map = mapRef.current
    if (!map || !ready) return
    setData(map, 'walk-route', walk?.line ? { type: 'Feature', geometry: walk.line, properties: {} } : EMPTY)
    setData(map, 'walk-stop', walk ? { type: 'Feature', geometry: { type: 'Point', coordinates: walk.stop }, properties: {} } : EMPTY)
  }, [walk, ready])

  useEffect(() => {
    const map = mapRef.current
    if (!map || !ready) return
    setData(map, 'user-location', user ? { type: 'Feature', geometry: { type: 'Point', coordinates: user }, properties: {} } : EMPTY)
  }, [user, ready])

  // Inline style: maplibre's unlayered `.maplibregl-map { position: relative }` beats Tailwind's layered utilities.
  return <div ref={containerRef} style={{ position: 'absolute', inset: 0 }} />
}

'use client'

import maplibregl from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import { useEffect, useRef } from 'react'
import type { TripStop } from '@/lib/trip/model'

const PADDING = 48

/**
 * The day's route: numbered pins joined in visit order. Decorative for assistive tech: the stop list next to it
 * carries the same order and names (WCAG list view). Stops without coordinates are skipped.
 */
export default function DayMap({ styleUrl, stops, label }: { styleUrl: string; stops: TripStop[]; label: string }) {
  const ref = useRef<HTMLDivElement>(null)
  const points = stops.flatMap((s) => (s.place.lng !== null && s.place.lat !== null ? [[s.place.lng, s.place.lat] as [number, number]] : []))
  const key = JSON.stringify(points)

  useEffect(() => {
    const pts = JSON.parse(key) as [number, number][]
    if (!ref.current || pts.length === 0) return
    const bounds = pts.reduce((b, p) => b.extend(p), new maplibregl.LngLatBounds(pts[0], pts[0]))
    const map = new maplibregl.Map({
      container: ref.current,
      style: styleUrl,
      bounds,
      fitBoundsOptions: { padding: PADDING, maxZoom: 15 },
      attributionControl: { compact: true },
      dragRotate: false,
      pitchWithRotate: false,
    })
    map.getCanvas().setAttribute('aria-label', label)
    const markers = pts.map((p, i) => {
      const el = document.createElement('span')
      el.setAttribute('aria-hidden', 'true')
      el.className = 'flex size-7 items-center justify-center rounded-full border-[1.5px] border-ink bg-surface text-[13px] font-semibold text-ink'
      el.textContent = String(i + 1)
      return new maplibregl.Marker({ element: el }).setLngLat(p).addTo(map)
    })
    map.on('load', () => {
      const copper = getComputedStyle(document.documentElement).getPropertyValue('--copper').trim() || '#9E5229'
      map.addSource('day-route', { type: 'geojson', data: { type: 'Feature', geometry: { type: 'LineString', coordinates: pts }, properties: {} } })
      map.addLayer({ id: 'day-route', type: 'line', source: 'day-route', layout: { 'line-cap': 'round' }, paint: { 'line-color': copper, 'line-width': 3, 'line-dasharray': [1, 2] } })
    })
    return () => {
      markers.forEach((m) => m.remove())
      map.remove()
    }
  }, [key, styleUrl, label])

  return <div ref={ref} className="relative aspect-[4/3] overflow-hidden rounded-[10px] border border-line bg-ph-1" />
}

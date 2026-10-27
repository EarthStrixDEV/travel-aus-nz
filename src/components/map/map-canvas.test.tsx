// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render } from '@testing-library/react'

type Handler = (...args: unknown[]) => void

const maps = vi.hoisted(() => [] as { handlers: Record<string, Handler[]>; fire: (event: string) => void; removed: boolean }[])

vi.mock('maplibre-gl/dist/maplibre-gl.css', () => ({}))
vi.mock('maplibre-gl', () => {
  class FakeMap {
    handlers: Record<string, Handler[]> = {}
    removed = false
    touchZoomRotate = { disableRotation: () => {} }
    constructor() {
      maps.push(this as unknown as (typeof maps)[number])
    }
    on(event: string, fn: Handler) {
      ;(this.handlers[event] ??= []).push(fn)
      return this
    }
    fire(event: string) {
      for (const fn of this.handlers[event] ?? []) fn({ error: new Error(event) })
    }
    getCanvas() {
      return document.createElement('canvas')
    }
    getBounds() {
      return { getWest: () => 0, getSouth: () => 0, getEast: () => 1, getNorth: () => 1 }
    }
    getZoom() {
      return 5
    }
    addSource() {}
    addLayer() {}
    remove() {
      this.removed = true
    }
  }
  return { default: { Map: FakeMap, Marker: class {} } }
})

import MapCanvas, { STYLE_TIMEOUT_MS } from './map-canvas'

function renderCanvas(onStyleError = vi.fn()) {
  render(
    <MapCanvas
      styleUrl="https://tiles.example/style.json"
      label="Map"
      hintId="hint"
      command={{ id: 0, kind: 'fit', bbox: [150, -34, 151, -33] }}
      reducedMotion
      clusters={[]}
      pins={[]}
      selected={null}
      walk={null}
      transit={null}
      user={null}
      pinLabel={() => ''}
      clusterLabel={() => ''}
      onViewport={() => {}}
      onSelect={() => {}}
      onCluster={() => {}}
      onStyleError={onStyleError}
    />,
  )
  return { onStyleError, map: maps[maps.length - 1] }
}

beforeEach(() => {
  vi.useFakeTimers()
  maps.length = 0
})
afterEach(() => {
  cleanup()
  vi.useRealTimers()
})

describe('MapCanvas style failure', () => {
  it('an error before the style loads reports a style failure once', () => {
    const { onStyleError, map } = renderCanvas()
    map.fire('error')
    map.fire('error')
    expect(onStyleError).toHaveBeenCalledTimes(1)
  })

  it('no load within the timeout reports a style failure', () => {
    const { onStyleError } = renderCanvas()
    vi.advanceTimersByTime(STYLE_TIMEOUT_MS - 1)
    expect(onStyleError).not.toHaveBeenCalled()
    vi.advanceTimersByTime(1)
    expect(onStyleError).toHaveBeenCalledTimes(1)
  })

  it('a tile error after load does not switch to list view', () => {
    const { onStyleError, map } = renderCanvas()
    map.fire('load')
    map.fire('error')
    vi.advanceTimersByTime(STYLE_TIMEOUT_MS * 2)
    expect(onStyleError).not.toHaveBeenCalled()
  })
})

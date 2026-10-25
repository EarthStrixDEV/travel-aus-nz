import { describe, expect, it } from 'vitest'
import { ewkbToGeometry, geometryBbox } from './geo'

// Hex EWKB exactly as PostgREST returns geography columns (from the linked DB).
const SYDNEY_CENTER = '0101000020E6100000B1E1E995B2E66240E561A1D634EF40C0'
const SYDNEY_BBOX =
  '0103000020E61000000100000005000000713D0AD7A3D06240F6285C8FC21541C03333333333EB6240F6285C8FC21541C03333333333EB6240295C8FC2F5C840C0713D0AD7A3D06240295C8FC2F5C840C0713D0AD7A3D06240F6285C8FC21541C0'

/** Little-endian hex EWKB writer for fixtures (SRID 4326). */
function lineHex(type: 2 | 5, coords: number[][][] | number[][]): string {
  const u32 = (n: number) => {
    const b = new DataView(new ArrayBuffer(4))
    b.setUint32(0, n, true)
    return [...new Uint8Array(b.buffer)]
  }
  const f64 = (n: number) => {
    const b = new DataView(new ArrayBuffer(8))
    b.setFloat64(0, n, true)
    return [...new Uint8Array(b.buffer)]
  }
  const line = (pts: number[][], srid: boolean) => [
    1, ...u32(srid ? 0x20000002 : 2), ...(srid ? u32(4326) : []), ...u32(pts.length), ...pts.flatMap(([x, y]) => [...f64(x), ...f64(y)]),
  ]
  const bytes =
    type === 2
      ? line(coords as number[][], true)
      : [1, ...u32(0x20000005), ...u32(4326), ...u32(coords.length), ...(coords as number[][][]).flatMap((l) => line(l, false))]
  return bytes.map((b) => b.toString(16).padStart(2, '0')).join('').toUpperCase()
}

describe('ewkbToGeometry', () => {
  it('decodes a point', () => {
    const g = ewkbToGeometry(SYDNEY_CENTER)
    expect(g?.type).toBe('Point')
    const [lng, lat] = (g as { coordinates: number[] }).coordinates
    expect(lng).toBeCloseTo(151.2093, 6)
    expect(lat).toBeCloseTo(-33.8688, 6)
  })

  it('decodes a polygon and its bbox', () => {
    const g = ewkbToGeometry(SYDNEY_BBOX)
    expect(g?.type).toBe('Polygon')
    const box = geometryBbox(g!)!
    expect(box.map((n) => Number(n.toFixed(2)))).toEqual([150.52, -34.17, 151.35, -33.57])
  })

  it('decodes a linestring and a multilinestring', () => {
    expect(ewkbToGeometry(lineHex(2, [[151.2, -33.8], [151.21, -33.81]]))).toEqual({
      type: 'LineString', coordinates: [[151.2, -33.8], [151.21, -33.81]],
    })
    expect(ewkbToGeometry(lineHex(5, [[[1, 2], [3, 4]], [[5, 6], [7, 8]]]))).toEqual({
      type: 'MultiLineString', coordinates: [[[1, 2], [3, 4]], [[5, 6], [7, 8]]],
    })
  })

  it.each([null, undefined, '', 'zz', '0101000020E6'])('%s -> null (never throws)', (v) => {
    expect(ewkbToGeometry(v)).toBeNull()
  })
})

/**
 * Minimal GeoJSON types and a hex-EWKB decoder for PostGIS `geography` columns, which
 * PostgREST returns as hex EWKB (e.g. "0101000020E6100000..."). Pure; safe on client and server.
 */
export type Position = [number, number]
export type Point = { type: 'Point'; coordinates: Position }
export type LineString = { type: 'LineString'; coordinates: Position[] }
export type Polygon = { type: 'Polygon'; coordinates: Position[][] }
export type MultiLineString = { type: 'MultiLineString'; coordinates: Position[][] }
export type Geometry = Point | LineString | Polygon | MultiLineString

export type Feature<G extends Geometry, P> = { type: 'Feature'; geometry: G; properties: P }
export type FeatureCollection<G extends Geometry, P> = { type: 'FeatureCollection'; features: Feature<G, P>[] }

export type Bbox = [minLng: number, minLat: number, maxLng: number, maxLat: number]

const SRID_FLAG = 0x20000000
const Z_FLAG = 0x80000000
const M_FLAG = 0x40000000

/** Decode hex EWKB (Point, LineString, Polygon, MultiLineString; Z/M ordinates dropped). Never throws. */
export function ewkbToGeometry(hex: string | null | undefined): Geometry | null {
  if (!hex || hex.length % 2 !== 0 || !/^[0-9a-fA-F]+$/.test(hex)) return null
  try {
    const bytes = new Uint8Array(hex.length / 2)
    for (let i = 0; i < bytes.length; i++) bytes[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16)
    const view = new DataView(bytes.buffer)
    let off = 0

    const read = (): Geometry => {
      const le = view.getUint8(off) === 1
      off += 1
      const raw = view.getUint32(off, le)
      off += 4
      const dims = 2 + (raw & Z_FLAG ? 1 : 0) + (raw & M_FLAG ? 1 : 0)
      if (raw & SRID_FLAG) off += 4
      const type = raw & 0xff
      const u32 = () => {
        const n = view.getUint32(off, le)
        off += 4
        return n
      }
      const pos = (): Position => {
        const p: Position = [view.getFloat64(off, le), view.getFloat64(off + 8, le)]
        off += dims * 8
        return p
      }
      const ring = () => Array.from({ length: u32() }, pos)
      switch (type) {
        case 1:
          return { type: 'Point', coordinates: pos() }
        case 2:
          return { type: 'LineString', coordinates: ring() }
        case 3:
          return { type: 'Polygon', coordinates: Array.from({ length: u32() }, ring) }
        case 5:
          return {
            type: 'MultiLineString',
            coordinates: Array.from({ length: u32() }, () => {
              const part = read()
              if (part.type !== 'LineString') throw new Error('bad multilinestring part')
              return part.coordinates
            }),
          }
        default:
          throw new Error(`unsupported WKB type ${type}`)
      }
    }

    const g = read()
    return off === bytes.length ? g : null
  } catch {
    return null
  }
}

/** Bounding box of any geometry's coordinates; null when it has none. */
export function geometryBbox(g: Geometry): Bbox | null {
  const flat: Position[] =
    g.type === 'Point' ? [g.coordinates] : g.type === 'LineString' ? g.coordinates : g.coordinates.flat()
  if (flat.length === 0) return null
  const xs = flat.map((p) => p[0])
  const ys = flat.map((p) => p[1])
  return [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)]
}

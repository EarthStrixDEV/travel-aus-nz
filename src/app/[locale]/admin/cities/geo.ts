export type LngLat = { lng: number; lat: number }

const HEX = /^(?:[0-9a-fA-F]{2})+$/

/**
 * Reads a `cities.center` value as PostgREST returns it: hex-encoded EWKB (verified against
 * the dev DB; geography is not returned as GeoJSON). GeoJSON points are also accepted.
 */
export function parsePoint(value: unknown): LngLat | null {
  if (typeof value === 'string') return HEX.test(value) ? parseEwkbPoint(value) : null
  if (typeof value === 'object' && value !== null) {
    const { type, coordinates } = value as { type?: unknown; coordinates?: unknown }
    if (type === 'Point' && Array.isArray(coordinates) && coordinates.length >= 2) {
      const [lng, lat] = coordinates
      if (typeof lng === 'number' && typeof lat === 'number') return { lng, lat }
    }
  }
  return null
}

function parseEwkbPoint(hex: string): LngLat | null {
  const bytes = Uint8Array.from(hex.match(/../g)!, (h) => parseInt(h, 16))
  const view = new DataView(bytes.buffer)
  if (bytes.length < 21) return null
  const little = view.getUint8(0) === 1
  const type = view.getUint32(1, little)
  if ((type & 0xff) !== 1) return null // not a Point (flags are in the high bits)
  const hasSrid = (type & 0x20000000) !== 0
  const hasExtra = (type & 0xc0000000) !== 0 // Z or M: not used for cities
  if (hasExtra) return null
  const offset = 5 + (hasSrid ? 4 : 0)
  if (bytes.length < offset + 16) return null
  const lng = view.getFloat64(offset, little)
  const lat = view.getFloat64(offset + 8, little)
  return Number.isFinite(lng) && Number.isFinite(lat) ? { lng, lat } : null
}

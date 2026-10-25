import { describe, expect, it } from 'vitest'
import { citySchema, isIanaZone } from './schema'

const sydney = {
  region_id: '1',
  slug: 'sydney',
  name_th: 'ซิดนีย์',
  name_en: 'Sydney',
  timezone: 'Australia/Sydney',
  lng: '151.2093',
  lat: '-33.8688',
  status: 'published',
}

describe('isIanaZone', () => {
  it('accepts IANA zones', () => {
    expect(isIanaZone('Australia/Sydney')).toBe(true)
    expect(isIanaZone('Pacific/Auckland')).toBe(true)
  })
  it('rejects offsets and junk', () => {
    expect(isIanaZone('UTC+10')).toBe(false)
    expect(isIanaZone('')).toBe(false)
  })
})

describe('citySchema', () => {
  it('parses valid Sydney input, coercing numbers from form strings', () => {
    const r = citySchema.safeParse(sydney)
    expect(r.success).toBe(true)
    if (r.success) {
      expect(r.data.region_id).toBe(1)
      expect(r.data.lng).toBeCloseTo(151.2093)
      expect(r.data.lat).toBeCloseTo(-33.8688)
    }
  })
  it('rejects a slug with capitals or spaces', () => {
    expect(citySchema.safeParse({ ...sydney, slug: 'Sydney City' }).success).toBe(false)
  })
  it('rejects a non-IANA timezone', () => {
    expect(citySchema.safeParse({ ...sydney, timezone: 'UTC+10' }).success).toBe(false)
  })
  it('rejects latitude out of range', () => {
    expect(citySchema.safeParse({ ...sydney, lat: 91 }).success).toBe(false)
  })
  it('rejects longitude out of range', () => {
    expect(citySchema.safeParse({ ...sydney, lng: 181 }).success).toBe(false)
  })
  it('rejects an empty Thai name', () => {
    expect(citySchema.safeParse({ ...sydney, name_th: '' }).success).toBe(false)
  })
  it('rejects an unknown status', () => {
    expect(citySchema.safeParse({ ...sydney, status: 'live' }).success).toBe(false)
  })
})

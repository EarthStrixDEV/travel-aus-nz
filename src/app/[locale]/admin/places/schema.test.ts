import { describe, expect, it } from 'vitest'
import { placeSchema } from './schema'

const base = {
  city_id: '1',
  slug: 'kin-noodle-bar',
  type: 'restaurant',
  name_th: 'คิน นู้ดเดิล บาร์',
  name_en: 'Kin Noodle Bar',
  lng: '151.2093',
  lat: '-33.8688',
  price_level: '2',
  website: 'https://kin.example.com',
  status: 'published',
  tags: ['3', '5'],
  hours: [
    { weekday: '1', open_time: '11:00', close_time: '21:30' },
    { weekday: '5', open_time: '18:00', close_time: '02:00' },
  ],
  stops: [{ stop_id: '7', walk_min: '4' }],
  booking: 'walk_in',
  dietary: ['vegetarian'],
  drinks: ['beer'],
}

describe('placeSchema', () => {
  it('parses a valid venue with hours, tags and stops', () => {
    const r = placeSchema.safeParse(base)
    expect(r.success).toBe(true)
    if (r.success) {
      expect(r.data.tags).toEqual([3, 5])
      expect(r.data.hours).toEqual([
        { weekday: 1, open_time: '11:00', close_time: '21:30' },
        { weekday: 5, open_time: '18:00', close_time: '02:00' },
      ])
      expect(r.data.stops).toEqual([{ stop_id: 7, walk_min: 4 }])
    }
  })
  it('drops weekday rows left blank (closed that day)', () => {
    const r = placeSchema.safeParse({ ...base, hours: [{ weekday: '0' }, ...base.hours] })
    expect(r.success && r.data.hours.length).toBe(2)
  })
  it('rejects a missing English name', () => {
    expect(placeSchema.safeParse({ ...base, name_en: undefined }).success).toBe(false)
  })
  it('enforces the slug pattern', () => {
    expect(placeSchema.safeParse({ ...base, slug: 'Kin_Noodle' }).success).toBe(false)
  })
  it('blocks publishing a place whose media lacks a license', () => {
    const media = [{ credit: 'Jane Doe', license: '' }]
    const r = placeSchema.safeParse({ ...base, media })
    expect(r.success).toBe(false)
    if (!r.success) expect(r.error.issues.map((i) => i.message)).toContain('license')
    expect(placeSchema.safeParse({ ...base, media, status: 'draft' }).success).toBe(true)
  })
  it('allows publishing when every referenced asset is credited and licensed', () => {
    expect(placeSchema.safeParse({ ...base, media: [{ credit: 'Jane Doe', license: 'CC BY 4.0' }] }).success).toBe(true)
  })
  it('rejects an hours row with only one time', () => {
    const r = placeSchema.safeParse({ ...base, hours: [{ weekday: '1', open_time: '11:00' }] })
    expect(r.success).toBe(false)
    if (!r.success) expect(r.error.issues[0].path[0]).toBe('hours')
  })
  it('rejects a stop linked twice', () => {
    const stops = [
      { stop_id: '7', walk_min: '4' },
      { stop_id: '7', walk_min: '6' },
    ]
    expect(placeSchema.safeParse({ ...base, stops }).success).toBe(false)
  })
  it('rejects an unknown booking value and a non-http website', () => {
    expect(placeSchema.safeParse({ ...base, booking: 'phone' }).success).toBe(false)
    expect(placeSchema.safeParse({ ...base, website: 'javascript:alert(1)' }).success).toBe(false)
  })
})

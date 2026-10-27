import { describe, expect, it } from 'vitest'
import { dishSchema } from './schema'

const PLACE = '00000000-0000-0000-0000-00000000d001'
const dish = {
  slug: 'pavlova',
  country: 'AU',
  type: 'sweet',
  name_th: 'พาฟโลวา',
  name_en: 'Pavlova',
  status: 'draft',
  dietary: ['vegetarian', 'gluten_free'],
}

describe('dishSchema', () => {
  it('parses valid input with defaults', () => {
    const r = dishSchema.safeParse(dish)
    expect(r.success).toBe(true)
    if (r.success) expect(r.data).toMatchObject({ sort: 0, pairings: [], venues: [] })
  })
  it('rejects a missing English name, a bad slug, an unknown type or diet', () => {
    expect(dishSchema.safeParse({ ...dish, name_en: undefined }).success).toBe(false)
    expect(dishSchema.safeParse({ ...dish, slug: 'Pav lova' }).success).toBe(false)
    expect(dishSchema.safeParse({ ...dish, type: 'main' }).success).toBe(false)
    expect(dishSchema.safeParse({ ...dish, dietary: ['keto'] }).success).toBe(false)
  })
  it('must-try rank is 1–3', () => {
    expect(dishSchema.safeParse({ ...dish, must_try_rank: '4' }).success).toBe(false)
    expect(dishSchema.safeParse({ ...dish, must_try_rank: '2' }).success).toBe(true)
  })
  it('publishing with an unlicensed cover is refused', () => {
    const r = dishSchema.safeParse({ ...dish, status: 'published', media: [{ credit: 'Jane', license: null }] })
    expect(r.success).toBe(false)
    if (!r.success) expect(r.error.issues[0]).toMatchObject({ message: 'license', path: ['cover_media_id'] })
  })
  it('a venue listed twice is a duplicate row; venue rows need a region and rank', () => {
    const row = { place_id: PLACE, region_id: '1', rank: '1' }
    expect(dishSchema.safeParse({ ...dish, venues: [row, { ...row, rank: '2' }] }).success).toBe(false)
    expect(dishSchema.safeParse({ ...dish, venues: [{ place_id: PLACE, rank: '1' }] }).success).toBe(false)
    expect(dishSchema.safeParse({ ...dish, venues: [row] }).success).toBe(true)
  })
})

import { describe, expect, it } from 'vitest'
import { regionSchema } from './schema'

const sydney = {
  country: 'AU',
  slug: 'sydney',
  name_th: 'ซิดนีย์',
  name_en: 'Sydney',
  best_months: ['9', '10', '11'],
  featured_rank: '1',
  status: 'published',
  media: [{ credit: 'Jane Doe', license: 'CC BY 4.0' }],
}

describe('regionSchema', () => {
  it('parses valid input, coercing months and rank', () => {
    const r = regionSchema.safeParse(sydney)
    expect(r.success).toBe(true)
    if (r.success) {
      expect(r.data.best_months).toEqual([9, 10, 11])
      expect(r.data.featured_rank).toBe(1)
    }
  })
  it('rejects a missing English name', () => {
    expect(regionSchema.safeParse({ ...sydney, name_en: undefined }).success).toBe(false)
  })
  it('enforces the slug pattern', () => {
    expect(regionSchema.safeParse({ ...sydney, slug: 'New South Wales' }).success).toBe(false)
  })
  it('rejects a month outside 1-12', () => {
    expect(regionSchema.safeParse({ ...sydney, best_months: ['13'] }).success).toBe(false)
  })
  it('blocks publishing with a cover that lacks a license, but allows a draft', () => {
    const media = [{ credit: 'Jane Doe', license: ' ' }]
    const r = regionSchema.safeParse({ ...sydney, media })
    expect(r.success).toBe(false)
    if (!r.success) expect(r.error.issues[0]).toMatchObject({ message: 'license', path: ['cover_media_id'] })
    expect(regionSchema.safeParse({ ...sydney, media, status: 'draft' }).success).toBe(true)
  })
})

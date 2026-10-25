import { describe, expect, it } from 'vitest'
import { journeySchema } from './schema'

const base = {
  slug: 'great-ocean-road',
  kind: 'itinerary',
  country: 'AU',
  title_th: 'เกรทโอเชียนโรด',
  title_en: 'Great Ocean Road',
  from_name: 'Melbourne',
  to_name: 'Apollo Bay',
  days: '3',
  price_from: '89.50',
  currency: 'AUD',
  modes: ['train', 'coach'],
  status: 'published',
  legs: [
    { mode: 'train', from_name: 'Southern Cross', to_name: 'Geelong', duration_min: '60', day: '1' },
    { mode: 'coach', from_name: 'Geelong', to_name: 'Apollo Bay', duration_min: '150', day: '1' },
  ],
  media: [{ credit: 'Jane Doe', license: 'CC BY 4.0' }],
}

describe('journeySchema', () => {
  it('parses valid input with legs', () => {
    const r = journeySchema.safeParse(base)
    expect(r.success).toBe(true)
    if (r.success) {
      expect(r.data.price_from).toBe(89.5)
      expect(r.data.legs[1]).toMatchObject({ mode: 'coach', duration_min: 150, day: 1 })
    }
  })
  it('rejects a missing English title', () => {
    expect(journeySchema.safeParse({ ...base, title_en: undefined }).success).toBe(false)
  })
  it('enforces the slug pattern', () => {
    expect(journeySchema.safeParse({ ...base, slug: 'great ocean road' }).success).toBe(false)
  })
  it('rejects an unknown mode, a lowercase currency and a leg without a mode', () => {
    expect(journeySchema.safeParse({ ...base, modes: ['jetpack'] }).success).toBe(false)
    expect(journeySchema.safeParse({ ...base, currency: 'aud' }).success).toBe(false)
    expect(journeySchema.safeParse({ ...base, legs: [{ from_name: 'A', to_name: 'B' }] }).success).toBe(false)
  })
  it('blocks publishing with an unlicensed cover', () => {
    const r = journeySchema.safeParse({ ...base, media: [{ credit: 'Jane', license: '' }] })
    expect(r.success).toBe(false)
    if (!r.success) expect(r.error.issues[0]).toMatchObject({ message: 'license', path: ['cover_media_id'] })
  })
})

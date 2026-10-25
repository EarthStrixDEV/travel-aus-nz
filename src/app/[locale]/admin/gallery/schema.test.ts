import { describe, expect, it } from 'vitest'
import { galleryPhotoSchema } from './schema'

const MEDIA = 'a0000000-0000-4000-8000-000000000011'
const PLACE = 'b0000000-0000-4000-8000-000000000001'
const base = {
  media_id: MEDIA,
  place_id: PLACE,
  region_id: '1',
  season: 'summer',
  title_th: 'บอนได',
  title_en: 'Bondi to Coogee',
  sort: '2',
  status: 'published',
  media: [{ credit: 'Jane Doe', license: 'CC BY 4.0' }],
}

describe('galleryPhotoSchema', () => {
  it('parses valid input', () => {
    const r = galleryPhotoSchema.safeParse(base)
    expect(r.success).toBe(true)
    if (r.success) expect(r.data.sort).toBe(2)
  })
  it('rejects a missing English title', () => {
    expect(galleryPhotoSchema.safeParse({ ...base, title_en: undefined }).success).toBe(false)
  })
  it('requires a photo and a place', () => {
    expect(galleryPhotoSchema.safeParse({ ...base, media_id: undefined }).success).toBe(false)
    expect(galleryPhotoSchema.safeParse({ ...base, place_id: 'nope' }).success).toBe(false)
  })
  it('blocks publishing a photo whose asset lacks a license or credit', () => {
    for (const media of [[{ credit: 'Jane', license: '' }], [{ credit: '', license: 'CC BY 4.0' }]]) {
      const r = galleryPhotoSchema.safeParse({ ...base, media })
      expect(r.success).toBe(false)
      if (!r.success) expect(r.error.issues[0]).toMatchObject({ message: 'license', path: ['media_id'] })
    }
    expect(galleryPhotoSchema.safeParse({ ...base, status: 'draft', media: [{ credit: '', license: '' }] }).success).toBe(true)
  })
})

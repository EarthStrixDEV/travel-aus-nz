import { describe, expect, it } from 'vitest'
import { collectionSchema } from './schema'

const A = 'b0000000-0000-4000-8000-000000000001'
const B = 'b0000000-0000-4000-8000-000000000002'
const base = {
  slug: 'sydney-dining-edit',
  kind: 'venue',
  placement: 'home_dining',
  title_th: 'ร้านอาหารคัดสรร',
  title_en: 'The dining edit',
  status: 'published',
  items: [A, B],
}

describe('collectionSchema', () => {
  it('parses valid input', () => {
    const r = collectionSchema.safeParse(base)
    expect(r.success).toBe(true)
    if (r.success) expect(r.data.items).toEqual([A, B])
  })
  it('rejects a missing English title', () => {
    expect(collectionSchema.safeParse({ ...base, title_en: undefined }).success).toBe(false)
  })
  it('enforces the slug pattern', () => {
    expect(collectionSchema.safeParse({ ...base, slug: 'Dining Edit' }).success).toBe(false)
  })
  it('rejects duplicate items and an unknown kind', () => {
    expect(collectionSchema.safeParse({ ...base, items: [A, A] }).success).toBe(false)
    expect(collectionSchema.safeParse({ ...base, kind: 'journey' }).success).toBe(false)
  })
})

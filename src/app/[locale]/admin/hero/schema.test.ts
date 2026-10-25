import { describe, expect, it } from 'vitest'
import { heroSlideSchema } from './schema'

const base = {
  media_id: 'a0000000-0000-4000-8000-000000000002',
  caption_th: 'อ่าวซิดนีย์',
  caption_en: 'Sydney Harbour at first light',
  sort: '1',
  active: 'on',
  media: [{ credit: 'Jane Doe', license: 'CC BY 4.0' }],
}

describe('heroSlideSchema', () => {
  it('parses valid input; a ticked checkbox is active', () => {
    const r = heroSlideSchema.safeParse(base)
    expect(r.success).toBe(true)
    if (r.success) expect(r.data.active).toBe(true)
  })
  it('an unticked checkbox (absent field) is inactive', () => {
    const r = heroSlideSchema.safeParse({ ...base, active: undefined })
    expect(r.success && r.data.active).toBe(false)
  })
  it('rejects a missing English caption', () => {
    expect(heroSlideSchema.safeParse({ ...base, caption_en: undefined }).success).toBe(false)
  })
  it('blocks an active slide whose image lacks a license; inactive is fine', () => {
    const media = [{ credit: 'Jane Doe', license: '' }]
    const r = heroSlideSchema.safeParse({ ...base, media })
    expect(r.success).toBe(false)
    if (!r.success) expect(r.error.issues[0]).toMatchObject({ message: 'license', path: ['media_id'] })
    expect(heroSlideSchema.safeParse({ ...base, active: undefined, media }).success).toBe(true)
  })
})

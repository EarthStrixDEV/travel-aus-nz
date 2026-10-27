import { describe, expect, it } from 'vitest'
import { checklistSchema, itemsBlockSchema, monthsSchema, packingSchema, textBlockSchema } from './schema'

describe('prepare schemas', () => {
  it('checklist needs a moment, an English title and at least one country', () => {
    const ok = { moment: '3m', title_th: 'วีซ่า', title_en: 'Entry permission', applies_to: ['AU', 'NZ'] }
    expect(checklistSchema.safeParse(ok).success).toBe(true)
    expect(checklistSchema.safeParse({ ...ok, title_en: undefined }).success).toBe(false)
    expect(checklistSchema.safeParse({ ...ok, moment: '2w' }).success).toBe(false)
    expect(checklistSchema.safeParse({ ...ok, applies_to: [] }).success).toBe(false)
  })

  it('packing needs a season', () => {
    expect(packingSchema.safeParse({ title_th: 'หมวก', title_en: 'Hat' }).success).toBe(false)
    expect(packingSchema.safeParse({ season: 'summer', title_th: 'หมวก', title_en: 'Hat' }).success).toBe(true)
  })

  it('months: exactly 12, levels 0–3', () => {
    const month = { comfort: '3', crowds: '1', recommended: true }
    expect(monthsSchema.safeParse({ months: Array(12).fill(month) }).success).toBe(true)
    expect(monthsSchema.safeParse({ months: Array(11).fill(month) }).success).toBe(false)
    expect(monthsSchema.safeParse({ months: Array(12).fill({ ...month, comfort: '4' }) }).success).toBe(false)
  })

  it('facts become the per-locale item lists the page reads', () => {
    const r = itemsBlockSchema.safeParse({ items: [{ title_th: 'ทิป', title_en: 'Tipping', text_th: 'ไม่จำเป็น', text_en: 'Not expected.', icon: 'coin' }] })
    expect(r.success && r.data.body_i18n).toEqual({
      en: [{ title: 'Tipping', text: 'Not expected.', icon: 'coin' }],
      th: [{ title: 'ทิป', text: 'ไม่จำเป็น', icon: 'coin' }],
    })
  })

  it('transport tips need both languages', () => {
    expect(textBlockSchema.safeParse({ body_en: 'Caps apply daily.' }).success).toBe(false)
    expect(textBlockSchema.safeParse({ body_en: 'Caps apply daily.', body_th: 'มีเพดานรายวัน' }).success).toBe(true)
  })
})

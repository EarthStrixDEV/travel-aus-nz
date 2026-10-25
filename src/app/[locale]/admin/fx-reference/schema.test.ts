import { describe, expect, it } from 'vitest'
import { budgetPresetSchema, costItemSchema, parsePresetKey } from './schema'

const coffee = { item_th: 'กาแฟ', item_en: 'Flat white', aud: '5.50', nzd: '5.80', verified_at: '2026-10-01', sort: '1' }

describe('costItemSchema', () => {
  it('parses valid input', () => {
    const r = costItemSchema.safeParse(coffee)
    expect(r.success && r.data).toMatchObject({ aud: 5.5, nzd: 5.8, sort: 1 })
  })
  it('rejects a missing English item name', () => {
    expect(costItemSchema.safeParse({ ...coffee, item_en: undefined }).success).toBe(false)
  })
  it('requires a verified date and non-negative prices', () => {
    expect(costItemSchema.safeParse({ ...coffee, verified_at: undefined }).success).toBe(false)
    expect(costItemSchema.safeParse({ ...coffee, aud: '-1' }).success).toBe(false)
  })
})

describe('budgetPresetSchema', () => {
  const preset = { country: 'NZ', style: 'comfortable', per_day: '220', note_th: 'ห้องพักคู่', note_en: 'Double room, two meals out' }
  it('parses valid input', () => {
    expect(budgetPresetSchema.safeParse(preset).success).toBe(true)
  })
  it('rejects a missing English note, a missing amount and an unknown style', () => {
    expect(budgetPresetSchema.safeParse({ ...preset, note_en: undefined }).success).toBe(false)
    expect(budgetPresetSchema.safeParse({ ...preset, per_day: undefined }).success).toBe(false)
    expect(budgetPresetSchema.safeParse({ ...preset, style: 'backpacker' }).success).toBe(false)
  })
  it('parses the preset key used in edit URLs', () => {
    expect(parsePresetKey('AU-luxury')).toEqual({ country: 'AU', style: 'luxury' })
    expect(parsePresetKey('AU-cheap')).toBeNull()
  })
})

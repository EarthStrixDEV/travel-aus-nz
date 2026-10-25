import { describe, expect, it } from 'vitest'
import { convert, crossRate, parseAmount } from './convert'

const RATES = { AUD: 1, NZD: 1.127, THB: 21.48, USD: 0.6582, JPY: 98.62 }

describe('convert', () => {
  it('goes through AUD: 1000 THB -> NZD to 2 dp', () => {
    // 1000 / 21.48 = 46.5549 AUD; x 1.127 = 52.4674 NZD
    expect(convert(1000, 'THB', 'NZD', RATES)).toBeCloseTo(52.47, 2)
  })

  it('AUD is the pivot with rate 1, even when absent from the map', () => {
    expect(convert(100, 'AUD', 'THB', RATES)).toBeCloseTo(2148, 6)
    expect(convert(21.48, 'THB', 'AUD', { THB: 21.48 })).toBeCloseTo(1, 8)
  })

  it('round-trips', () => {
    expect(convert(convert(250, 'USD', 'JPY', RATES), 'JPY', 'USD', RATES)).toBeCloseTo(250, 8)
  })

  it('returns NaN for an unknown currency instead of guessing', () => {
    expect(convert(1, 'XXX', 'AUD', RATES)).toBeNaN()
  })
})

describe('crossRate', () => {
  it('is rates.NZD', () => expect(crossRate(RATES)).toBe(1.127))
})

describe('parseAmount', () => {
  it('strips thousands separators', () => expect(parseAmount('10,000')).toBe(10000))
  it('treats junk and empty as 0', () => {
    expect(parseAmount('')).toBe(0)
    expect(parseAmount('.')).toBe(0)
  })
})

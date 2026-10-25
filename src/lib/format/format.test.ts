import { describe, expect, it } from 'vitest'
import { formatBestMonths } from './months'
import { formatDuration, formatMoney } from './money'

describe('formatBestMonths', () => {
  it('collapses a contiguous run to first–last', () => {
    expect(formatBestMonths([9, 10, 11], 'en')).toBe('Sep–Nov')
  })
  it('handles a run that wraps the year end', () => {
    expect(formatBestMonths([12, 1, 2, 3], 'en')).toBe('Dec–Mar')
    expect(formatBestMonths([3, 12, 1, 2], 'en')).toBe('Dec–Mar')
  })
  it('lists separate runs and single months', () => {
    expect(formatBestMonths([2, 7, 8], 'en')).toBe('Feb, Jul–Aug')
    expect(formatBestMonths([5], 'en')).toBe('May')
  })
  it('ignores junk and returns empty for no months', () => {
    expect(formatBestMonths([], 'en')).toBe('')
    expect(formatBestMonths(null, 'en')).toBe('')
    expect(formatBestMonths([0, 13, 4], 'en')).toBe('Apr')
  })
  it('uses the locale month names', () => {
    expect(formatBestMonths([9, 10, 11], 'th')).toBe('ก.ย.–พ.ย.')
  })
})

describe('formatMoney', () => {
  it('uses A$ and NZ$ symbols with grouping', () => {
    expect(formatMoney(6480, 'AUD')).toBe('A$6,480')
    expect(formatMoney(5920, 'NZD')).toBe('NZ$5,920')
  })
  it('keeps cents only when present', () => {
    expect(formatMoney(18.5, 'AUD')).toBe('A$18.50')
  })
  it('falls back to the ISO code for other currencies', () => {
    expect(formatMoney(100, 'THB')).toBe('THB 100')
  })
})

describe('formatDuration', () => {
  it('splits minutes into h and min', () => {
    expect(formatDuration(65)).toEqual({ h: 1, m: 5 })
    expect(formatDuration(40)).toEqual({ h: 0, m: 40 })
    expect(formatDuration(120)).toEqual({ h: 2, m: 0 })
  })
})

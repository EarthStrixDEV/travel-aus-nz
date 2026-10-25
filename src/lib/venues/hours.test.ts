import { describe, expect, it } from 'vitest'
import { summariseHours } from './hours'

const days = (ds: number[], open: string, close: string) => ds.map((weekday) => ({ weekday, open, close }))

describe('summariseHours', () => {
  it('groups consecutive days with the same range (week runs Mon to Sun)', () => {
    expect(summariseHours(days([2, 3, 4, 5, 6], '17:30', '23:00'), 'en')).toBe('Tue–Sat 17:30–23:00')
  })

  it('lists several groups, a single day on its own, and open daily', () => {
    expect(summariseHours([...days([2, 3, 4, 5, 6], '17:30', '23:00'), ...days([0], '12:00', '16:00')], 'en')).toBe(
      'Tue–Sat 17:30–23:00 · Sun 12:00–16:00',
    )
    expect(summariseHours(days([0, 1, 2, 3, 4, 5, 6], '07:00', '15:00'), 'en')).toBe('Daily 07:00–15:00')
  })

  it('joins split service on one day and keeps after-midnight closes', () => {
    const h = [...days([5], '12:00', '15:00'), ...days([5], '18:00', '01:00')]
    expect(summariseHours(h, 'en')).toBe('Fri 12:00–15:00, 18:00–01:00')
  })

  it('lists non-consecutive days of one group in Mon-first order, and runs through Sunday', () => {
    expect(summariseHours(days([0, 1, 3], '10:00', '17:00'), 'en')).toBe('Mon, Wed, Sun 10:00–17:00')
    expect(summariseHours(days([5, 6, 0], '10:00', '17:00'), 'en')).toBe('Fri–Sun 10:00–17:00')
  })

  it('returns an empty string without hours and localises weekday names', () => {
    expect(summariseHours([], 'en')).toBe('')
    expect(summariseHours(days([1], '09:00', '10:00'), 'th')).toMatch(/^จันทร์ /)
  })
})

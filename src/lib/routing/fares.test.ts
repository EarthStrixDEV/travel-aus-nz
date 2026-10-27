import { describe, expect, it } from 'vitest'
import { applyFares, isOffpeak, type AgencyRow, type CardRow, type FareRuleRow } from './fares'
import type { RouteLeg, RouteOption } from './types'

const leg = (over: Partial<RouteLeg>): RouteLeg => ({
  mode: 'train',
  from: 'A',
  to: 'B',
  depart: '2026-11-02T09:00:00.000Z',
  arrive: '2026-11-02T09:20:00.000Z',
  duration_min: 20,
  detail: '',
  distance_m: 12000,
  ...over,
})

const option = (legs: RouteLeg[]): RouteOption => ({
  depart: legs[0].depart,
  arrive: legs[legs.length - 1].arrive,
  duration_min: 20,
  summary: '',
  fare_min: null,
  fare_max: null,
  currency: 'AUD',
  card: null,
  legs,
})

const agencies: AgencyRow[] = [
  { id: 1, name: 'Sydney Trains', country: 'AU', card_id: 10 },
  { id: 2, name: 'Transdev John Holland', country: 'AU', card_id: 10 },
  { id: 3, name: 'Auckland Transport', country: 'NZ', card_id: 20 },
]
const cards: CardRow[] = [
  { id: 10, name: 'Opal', contactless: true },
  { id: 20, name: 'AT HOP', contactless: false },
]
const bands = [
  { upto_km: 10, peak: 4.2, offpeak: 2.94 },
  { upto_km: 20, peak: 5.2, offpeak: 3.64 },
  { upto_km: 35, peak: 6, offpeak: 4.2 },
]
const rules: FareRuleRow[] = [
  { agency_id: 1, mode: 'train', rule: { kind: 'distance', bands } },
  { agency_id: 2, mode: null, rule: { kind: 'flat', peak: 3.2, offpeak: 2.24 } },
  { agency_id: 3, mode: null, rule: { kind: 'flat', peak: 4, offpeak: 3, offpeak_windows: [{ days: [0, 6], from: '00:00', to: '24:00' }] } },
]

describe('applyFares', () => {
  it('distance rule, 12 km, off-peak departure -> fare_min/max from the 10-20 km band', () => {
    const [out] = applyFares([option([leg({ agency: 'sydney trains' })])], rules, agencies, cards, '2026-11-02T20:00')
    expect(out).toMatchObject({ fare_min: 3.64, fare_max: 5.2, currency: 'AUD', card: 'Opal or contactless · off-peak' })
  })

  it('peak departure -> card without the off-peak note', () => {
    const [out] = applyFares([option([leg({ agency: 'Sydney Trains' })])], rules, agencies, cards, '2026-11-02T08:30')
    expect(out.card).toBe('Opal or contactless')
  })

  it('sums transit legs, ignores walk legs, beyond the last band uses the last band', () => {
    const legs = [
      leg({ mode: 'walk', distance_m: 400 }),
      leg({ agency: 'Sydney Trains', distance_m: 50000 }),
      leg({ mode: 'bus', agency: 'Transdev John Holland', distance_m: 3000 }),
    ]
    const [out] = applyFares([option(legs)], rules, agencies, cards, '2026-11-02T09:00')
    expect(out).toMatchObject({ fare_min: 6.44, fare_max: 9.2 })
  })

  it('daily cap clamps the agency subtotal', () => {
    const capped: FareRuleRow[] = [{ agency_id: 1, mode: null, rule: { kind: 'distance', bands, daily_cap: 5 } }]
    const legs = [leg({ agency: 'Sydney Trains' }), leg({ agency: 'Sydney Trains' })]
    const [out] = applyFares([option(legs)], capped, agencies, cards, '2026-11-02T09:00')
    expect(out).toMatchObject({ fare_min: 5, fare_max: 5 })
  })

  it('a mode-specific rule wins over the agency-wide rule', () => {
    const both: FareRuleRow[] = [
      { agency_id: 1, mode: null, rule: { kind: 'flat', peak: 9, offpeak: 9 } },
      { agency_id: 1, mode: 'train', rule: { kind: 'flat', peak: 2, offpeak: 1 } },
    ]
    const [out] = applyFares([option([leg({ agency: 'Sydney Trains' })])], both, agencies, cards, '2026-11-02T09:00')
    expect(out).toMatchObject({ fare_min: 1, fare_max: 2 })
  })

  it('unknown agency -> fares null, card from the known leg kept', () => {
    const legs = [leg({ agency: 'Sydney Trains' }), leg({ mode: 'ferry', agency: 'Manly Fast Ferry' })]
    const [out] = applyFares([option(legs)], rules, agencies, cards, '2026-11-02T09:00')
    expect(out).toMatchObject({ fare_min: null, fare_max: null, card: 'Opal or contactless' })
  })

  it('agency without a rule or a malformed rule -> fares null', () => {
    const bad: FareRuleRow[] = [{ agency_id: 1, mode: null, rule: { kind: 'zone', zones: 3 } }]
    const [out] = applyFares([option([leg({ agency: 'Sydney Trains' })])], bad, agencies, cards, '2026-11-02T09:00')
    expect(out).toMatchObject({ fare_min: null, fare_max: null })
  })

  it('NZ agency -> NZD, card without contactless, rule-specific off-peak window', () => {
    const [weekday] = applyFares([option([leg({ mode: 'bus', agency: 'Auckland Transport' })])], rules, agencies, cards, '2026-11-02T21:00')
    expect(weekday).toMatchObject({ fare_min: 3, fare_max: 4, currency: 'NZD', card: 'AT HOP' })
    const [saturday] = applyFares([option([leg({ mode: 'bus', agency: 'Auckland Transport' })])], rules, agencies, cards, '2026-11-07T09:00')
    expect(saturday.card).toBe('AT HOP · off-peak')
  })

  it('walk-only option costs 0 with no card', () => {
    const [out] = applyFares([option([leg({ mode: 'walk' })])], rules, agencies, cards, '2026-11-02T09:00')
    expect(out).toMatchObject({ fare_min: 0, fare_max: 0, card: null })
  })
})

describe('isOffpeak (default window)', () => {
  it.each([
    ['2026-11-02T06:59', true], // Monday early
    ['2026-11-02T07:00', false],
    ['2026-11-02T18:59', false],
    ['2026-11-02T19:00', true],
    ['2026-11-07T12:00', true], // Saturday
    ['2026-11-08T08:00', true], // Sunday
  ])('%s -> %s', (local, expected) => {
    expect(isOffpeak(local)).toBe(expected)
  })
})

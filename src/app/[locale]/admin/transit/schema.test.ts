import { describe, expect, it } from 'vitest'
import { agencySchema, airportSchema, fareRuleSchema, lineSchema, scenicSchema } from './schema'

describe('fareRuleSchema', () => {
  const base = { agency_id: '1', currency: 'AUD' }

  it('flat needs both prices and becomes the router shape', () => {
    expect(fareRuleSchema.safeParse({ ...base, kind: 'flat', peak: '5.10' }).success).toBe(false)
    const r = fareRuleSchema.safeParse({ ...base, kind: 'flat', peak: '5.10', offpeak: '3.57', mode: 'train' })
    expect(r.success && r.data).toEqual({ agency_id: 1, mode: 'train', currency: 'AUD', verified_at: null, rule: { kind: 'flat', peak: 5.1, offpeak: 3.57 } })
  })

  it('distance bands must ascend and exist', () => {
    const bands = [{ upto_km: '10', peak: '4', offpeak: '2.8' }, { upto_km: '20', peak: '5', offpeak: '3.5' }]
    expect(fareRuleSchema.safeParse({ ...base, kind: 'distance', bands: [] }).success).toBe(false)
    expect(fareRuleSchema.safeParse({ ...base, kind: 'distance', bands: [bands[1], bands[0]] }).success).toBe(false)
    const r = fareRuleSchema.safeParse({ ...base, kind: 'distance', bands, daily_cap: '18.70' })
    expect(r.success && r.data.rule).toEqual({ kind: 'distance', bands: [{ upto_km: 10, peak: 4, offpeak: 2.8 }, { upto_km: 20, peak: 5, offpeak: 3.5 }], daily_cap: 18.7 })
  })

  it('an unknown kind or a missing agency fails', () => {
    expect(fareRuleSchema.safeParse({ ...base, kind: 'zones' }).success).toBe(false)
    expect(fareRuleSchema.safeParse({ currency: 'AUD', kind: 'flat', peak: '1', offpeak: '1' }).success).toBe(false)
  })
})

describe('other transit schemas', () => {
  it('agency needs a name; urls must be http(s)', () => {
    expect(agencySchema.safeParse({ country: 'AU' }).success).toBe(false)
    expect(agencySchema.safeParse({ country: 'AU', name: 'Sydney Trains', website: 'ftp://x' }).success).toBe(false)
  })
  it('line stops are serial ids; mode is required', () => {
    expect(lineSchema.safeParse({ stops: ['1', '2'] }).success).toBe(false)
    expect(lineSchema.safeParse({ mode: 'train', stops: ['1', '2'] }).success && true).toBe(true)
  })
  it('scenic route needs an English name and a slug', () => {
    expect(scenicSchema.safeParse({ slug: 'ghan', name_th: 'เดอะกาน', status: 'draft' }).success).toBe(false)
    expect(scenicSchema.safeParse({ slug: 'the-ghan', name_th: 'เดอะกาน', name_en: 'The Ghan', status: 'draft' }).success).toBe(true)
  })
  it('airport code is three letters, upper-cased', () => {
    expect(airportSchema.safeParse({ airport_code: 'SYDN', option_name: 'Train' }).success).toBe(false)
    const r = airportSchema.safeParse({ airport_code: 'syd', option_name: 'Airport Link' })
    expect(r.success && r.data.airport_code).toBe('SYD')
  })
})

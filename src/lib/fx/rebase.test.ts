import { describe, expect, it } from 'vitest'
import { rebaseToAud } from './rebase'

describe('rebaseToAud', () => {
  it('divides every USD rate by USD->AUD, including NZD', () => {
    const out = rebaseToAud({ AUD: 0.65, THB: 23.4, NZD: 0.59 })
    expect(out.THB).toBeCloseTo(36, 6)
    expect(out.NZD).toBeCloseTo(0.9077, 4)
  })

  it('pins AUD to 1 and derives USD from the AUD rate', () => {
    const out = rebaseToAud({ AUD: 1.5, THB: 33, NZD: 1.65 })
    expect(out.AUD).toBe(1)
    expect(out.USD).toBeCloseTo(1 / 1.5, 8)
  })

  it('rejects a missing or non-positive AUD rate', () => {
    expect(() => rebaseToAud({ THB: 33 })).toThrow()
    expect(() => rebaseToAud({ AUD: 0, THB: 33 })).toThrow()
  })
})

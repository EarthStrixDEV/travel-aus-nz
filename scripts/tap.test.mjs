import { describe, expect, it } from 'vitest'
import { evaluateTap } from './tap.mjs'

describe('evaluateTap', () => {
  it('all ok', () => {
    expect(evaluateTap(['1..2', 'ok 1 - a', 'ok 2 - b'])).toEqual({ passed: 2, failed: 0, planOk: true })
  })
  it('one not ok', () => {
    expect(evaluateTap(['1..2', 'ok 1 - a', 'not ok 2 - b'])).toEqual({ passed: 1, failed: 1, planOk: true })
  })
  it('plan 1..3 with only 2 results', () => {
    expect(evaluateTap(['1..3', 'ok 1 - a', 'ok 2 - b'])).toEqual({ passed: 2, failed: 0, planOk: false })
  })
  it('no plan line', () => {
    expect(evaluateTap(['ok 1 - a'])).toEqual({ passed: 1, failed: 0, planOk: false })
  })
})

import { describe, expect, it } from 'vitest'
import { forCountry, progress, southernSeason, type ChecklistTemplate, type PrepareData } from './data'

const tpl = (id: number, moment: ChecklistTemplate['moment'], appliesTo: ('au' | 'nz')[] = ['au', 'nz']): ChecklistTemplate => ({
  id,
  moment,
  title: `t${id}`,
  note: '',
  appliesTo,
})

const data: PrepareData = {
  templates: [tpl(1, '3m'), tpl(2, '3m', ['au']), tpl(3, '1w', ['nz']), tpl(4, 'day0')],
  regions: [
    { slug: 'sydney', name: 'Sydney', country: 'au', bestMonths: [], months: [] },
    { slug: 'queenstown', name: 'Queenstown', country: 'nz', bestMonths: [], months: [] },
  ],
  packing: [],
  facts: [],
  health: [],
  connectivity: [],
  transfers: [
    { airport: 'SYD', country: 'au', city: null, options: [] },
    { airport: 'AKL', country: 'nz', city: null, options: [] },
  ],
}

describe('forCountry', () => {
  it('NZ tab drops AU-only templates, AU regions and AU airports', () => {
    const nz = forCountry(data, 'nz')
    expect(nz.templates.map((t) => t.id)).toEqual([1, 3, 4])
    expect(nz.regions.map((r) => r.slug)).toEqual(['queenstown'])
    expect(nz.transfers.map((a) => a.airport)).toEqual(['AKL'])
  })
  it('Both keeps everything', () => {
    expect(forCountry(data, 'both').templates).toHaveLength(4)
  })
})

describe('progress', () => {
  it('counts done items and names the first open one in moment order', () => {
    const p = progress([tpl(4, 'day0'), tpl(3, '1w'), tpl(1, '3m')], new Set([1]))
    expect(p).toMatchObject({ done: 1, total: 3, pct: 33 })
    expect(p.next?.id).toBe(3)
  })
  it('all done -> no next item; empty list -> 0%', () => {
    expect(progress([tpl(1, '3m')], new Set([1])).next).toBeNull()
    expect(progress([], new Set()).pct).toBe(0)
  })
})

describe('southernSeason', () => {
  it('maps months to reversed seasons', () => {
    expect([12, 1, 2].map(southernSeason)).toEqual(['summer', 'summer', 'summer'])
    expect([3, 6, 9].map(southernSeason)).toEqual(['autumn', 'winter', 'spring'])
  })
})

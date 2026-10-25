import { describe, expect, it } from 'vitest'
import { nationalityCodes, resolveEntry, type EntryLink, type EntryPermission, type EntryRule } from './helper'

const TODAY = new Date('2026-10-25T12:00:00Z')

const AU_LINK: EntryLink = { id: 1, country: 'AU', agency: 'Department of Home Affairs', title: 'Home Affairs', url: 'https://immi.homeaffairs.gov.au', domain: 'immi.homeaffairs.gov.au' }
const NZ_LINK: EntryLink = { id: 2, country: 'NZ', agency: 'Immigration New Zealand', title: 'INZ', url: 'https://www.immigration.govt.nz', domain: 'www.immigration.govt.nz' }
const NZETA_LINK: EntryLink = { id: 3, country: 'NZ', agency: 'Immigration New Zealand', title: 'NZeTA', url: 'https://www.immigration.govt.nz/new-zealand-visas/visas/visa/nzeta', domain: 'www.immigration.govt.nz' }

const perm = (over: Partial<EntryPermission> & Pick<EntryPermission, 'id' | 'slug' | 'country' | 'link'>): EntryPermission => ({
  name: over.slug,
  plain: '',
  who: '',
  how: '',
  processing: '',
  fee: '',
  validity: '',
  good: '',
  verifiedAt: '2026-10-20',
  needsReview: false,
  ...over,
})

const PERMISSIONS: EntryPermission[] = [
  perm({ id: 10, slug: 'au-visitor-visa', country: 'AU', link: AU_LINK }),
  perm({ id: 20, slug: 'nz-visitor-visa', country: 'NZ', link: NZ_LINK }),
]

const rule = (over: Partial<EntryRule> = {}): EntryRule => ({
  nationality: 'TH',
  country: 'AU',
  purpose: 'tourism',
  stay: 'lt1',
  permissionId: 10,
  verifiedAt: '2026-10-20', // 5 days before TODAY
  needsReview: false,
  ...over,
})

const answers = { nationality: 'TH', purpose: 'tourism', stay: 'lt1' } as const

describe('resolveEntry', () => {
  it('TH / tourism / lt1 verified 5 days ago -> permission', () => {
    const r = resolveEntry([rule()], PERMISSIONS, answers, 'AU', TODAY)
    expect(r.kind).toBe('permission')
    if (r.kind === 'permission') expect(r.permission.slug).toBe('au-visitor-visa')
  })

  it('the same rule verified 31 days ago -> official_only with the permission link (Review Focus 3)', () => {
    const r = resolveEntry([rule({ verifiedAt: '2026-09-24' })], PERMISSIONS, answers, 'AU', TODAY)
    expect(r).toEqual({ kind: 'official_only', link: AU_LINK })
  })

  it('exactly 30 days old is still fresh', () => {
    expect(resolveEntry([rule({ verifiedAt: '2026-09-25' })], PERMISSIONS, answers, 'AU', TODAY).kind).toBe('permission')
  })

  it.each([
    ['rule verified_at null', [rule({ verifiedAt: null })], PERMISSIONS],
    ['rule needs_review', [rule({ needsReview: true })], PERMISSIONS],
    ['permission verified_at null', [rule()], [perm({ id: 10, slug: 'au-visitor-visa', country: 'AU', link: AU_LINK, verifiedAt: null }), PERMISSIONS[1]]],
    ['permission older than 30 days', [rule()], [perm({ id: 10, slug: 'au-visitor-visa', country: 'AU', link: AU_LINK, verifiedAt: '2026-09-01' }), PERMISSIONS[1]]],
    ['permission needs_review', [rule()], [perm({ id: 10, slug: 'au-visitor-visa', country: 'AU', link: AU_LINK, needsReview: true }), PERMISSIONS[1]]],
    ['rule points at a missing permission', [rule({ permissionId: 99 })], PERMISSIONS],
    ['rule has no permission', [rule({ permissionId: null })], PERMISSIONS],
  ])('%s -> official_only', (_name, rules, permissions) => {
    const r = resolveEntry(rules, permissions, answers, 'AU', TODAY)
    expect(r.kind).toBe('official_only')
  })

  it('no rule for this stay (gt3) -> official_only', () => {
    expect(resolveEntry([rule()], PERMISSIONS, { ...answers, stay: 'gt3' }, 'AU', TODAY).kind).toBe('official_only')
  })

  it('work_study -> work_study with the country link, whatever the nationality', () => {
    const r = resolveEntry([rule()], PERMISSIONS, { ...answers, purpose: 'work_study' }, 'NZ', TODAY, [NZETA_LINK, NZ_LINK, AU_LINK])
    expect(r).toEqual({ kind: 'work_study', link: NZ_LINK }) // the country root, not the deep NZeTA page
  })

  it('not_listed -> not_listed with the country link', () => {
    const r = resolveEntry([rule()], PERMISSIONS, { ...answers, nationality: 'not_listed' }, 'AU', TODAY)
    expect(r).toEqual({ kind: 'not_listed', link: AU_LINK })
  })

  it('derives the country link from the permissions when no links are passed', () => {
    const r = resolveEntry([], PERMISSIONS, { ...answers, nationality: 'not_listed' }, 'NZ', TODAY)
    expect(r).toEqual({ kind: 'not_listed', link: NZ_LINK })
  })

  it('falls back to the official country site when nothing is loaded', () => {
    const r = resolveEntry([], [], { ...answers, purpose: 'work_study' }, 'NZ', TODAY)
    expect(r.kind).toBe('work_study')
    if (r.kind === 'work_study') expect(r.link.url).toBe('https://www.immigration.govt.nz')
  })

  it('matches on country: an AU rule never answers for NZ', () => {
    expect(resolveEntry([rule()], PERMISSIONS, answers, 'NZ', TODAY).kind).toBe('official_only')
  })
})

describe('nationalityCodes', () => {
  it('returns each tourism-listed nationality once, upper-case, sorted', () => {
    const rules = [rule({ nationality: 'th' }), rule({ nationality: 'TH', country: 'NZ' }), rule({ nationality: 'JP' }), rule({ nationality: 'GB' })]
    expect(nationalityCodes(rules)).toEqual(['GB', 'JP', 'TH'])
  })
})

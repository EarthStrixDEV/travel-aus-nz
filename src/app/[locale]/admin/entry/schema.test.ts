import { describe, expect, it } from 'vitest'
import { entryRuleSchema, officialLinkSchema, parseRuleKey, permissionTypeSchema, ruleKey } from './schema'

const eta = {
  country: 'AU',
  slug: 'eta-601',
  name_th: 'อีทีเอ',
  name_en: 'ETA (subclass 601)',
  fee_text: 'A$20',
  official_link_id: '1',
  verified_at: '2026-10-20',
  needs_review: 'on',
}

describe('permissionTypeSchema', () => {
  it('parses valid input', () => {
    const r = permissionTypeSchema.safeParse(eta)
    expect(r.success).toBe(true)
    if (r.success) expect(r.data).toMatchObject({ official_link_id: 1, needs_review: true })
  })
  it('rejects a missing English name', () => {
    expect(permissionTypeSchema.safeParse({ ...eta, name_en: undefined }).success).toBe(false)
  })
  it('enforces the slug pattern and a real date', () => {
    expect(permissionTypeSchema.safeParse({ ...eta, slug: 'ETA 601' }).success).toBe(false)
    expect(permissionTypeSchema.safeParse({ ...eta, verified_at: '20/10/2026' }).success).toBe(false)
  })
})

describe('entryRuleSchema', () => {
  const rule = { nationality: 'th', country: 'AU', purpose: 'tourism', stay: 'lt1', permission_id: '2' }
  it('upper-cases the nationality and coerces the permission', () => {
    const r = entryRuleSchema.safeParse(rule)
    expect(r.success && r.data).toMatchObject({ nationality: 'TH', permission_id: 2, needs_review: false })
  })
  it('rejects a non-ISO nationality and an unknown stay', () => {
    expect(entryRuleSchema.safeParse({ ...rule, nationality: 'THA' }).success).toBe(false)
    expect(entryRuleSchema.safeParse({ ...rule, stay: 'forever' }).success).toBe(false)
  })
  it('round-trips the composite key used in edit URLs', () => {
    const key = ruleKey({ nationality: 'TH', country: 'AU', purpose: 'work_study', stay: '1to3' })
    expect(key).toBe('TH-AU-work_study-1to3')
    expect(parseRuleKey(key)).toEqual({ nationality: 'TH', country: 'AU', purpose: 'work_study', stay: '1to3' })
    expect(parseRuleKey('TH-AU-party-1to3')).toBeNull()
  })
})

describe('officialLinkSchema', () => {
  const link = { country: 'AU', agency: 'Home Affairs', title_th: 'กระทรวง', title_en: 'Home Affairs', url: 'https://immi.homeaffairs.gov.au/' }
  it('parses valid input', () => {
    expect(officialLinkSchema.safeParse(link).success).toBe(true)
  })
  it('rejects a missing English title and a non-https URL', () => {
    expect(officialLinkSchema.safeParse({ ...link, title_en: undefined }).success).toBe(false)
    expect(officialLinkSchema.safeParse({ ...link, url: 'http://immi.homeaffairs.gov.au/' }).success).toBe(false)
  })
})

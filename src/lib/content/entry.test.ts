import { describe, expect, it, vi } from 'vitest'
import type { Client } from './shared'

vi.mock('@/lib/supabase/public', () => ({ createPublicClient: () => ({}) }))
vi.mock('@/lib/content/cache', () => ({ cachedContent: (_k: string[], _t: string, fn: () => unknown) => fn }))

import { getEntryPageData, loadEntry } from './entry'

type Row = Record<string, unknown>

/** Thenable stand-in for a PostgREST query: ignores filters/order, resolves to the table's rows (or an error). */
function fakeClient(tables: Record<string, Row[]>, failOn?: string) {
  return {
    from(table: string) {
      const result = () => (table === failOn ? { data: null, error: { message: 'boom' } } : { data: tables[table] ?? [], error: null })
      const b = {
        select: () => b,
        order: () => b,
        in: () => b,
        eq: () => b,
        maybeSingle: () => Promise.resolve({ data: (result().data as Row[] | null)?.[0] ?? null, error: result().error }),
        then: (res: (v: unknown) => unknown, rej?: (e: unknown) => unknown) => Promise.resolve(result()).then(res, rej),
      }
      return b
    },
  } as unknown as Client
}

const tables = (): Record<string, Row[]> => ({
  official_links: [
    { id: 1, country: 'AU', agency: 'Department of Home Affairs', title_i18n: { en: 'Home Affairs' }, url: 'https://immi.homeaffairs.gov.au' },
    { id: 2, country: 'NZ', agency: 'Immigration New Zealand', title_i18n: { en: 'INZ', th: 'ตม.นิวซีแลนด์' }, url: 'https://www.immigration.govt.nz/new-zealand-visas' },
  ],
  permission_types: [
    {
      id: 10, country: 'AU', slug: 'au-eta', name_i18n: { en: 'ETA', th: 'อีทีเอ' }, plain_i18n: { en: 'Digital permission' }, who_i18n: { en: 'Eligible passports' },
      how_i18n: { en: 'App' }, processing_text: '1–2 days', fee_text: 'A$20', validity_text: '12 months', good_i18n: { en: 'Apply on your phone' },
      official_link_id: 1, verified_at: '2026-10-01', needs_review: false,
    },
    {
      id: 20, country: 'NZ', slug: 'nzeta', name_i18n: { en: 'NZeTA' }, plain_i18n: null, who_i18n: null, how_i18n: null, processing_text: null, fee_text: null,
      validity_text: null, good_i18n: null, official_link_id: null, verified_at: null, needs_review: true,
    },
  ],
  entry_rules: [
    { nationality: 'th', country: 'AU', purpose: 'tourism', stay: 'lt1', permission_id: 10, verified_at: '2026-10-20', needs_review: false },
    { nationality: 'TH', country: 'NZ', purpose: 'tourism', stay: 'lt1', permission_id: 20, verified_at: null, needs_review: null },
    { nationality: 'TH', country: 'FR', purpose: 'tourism', stay: 'lt1', permission_id: 20, verified_at: null, needs_review: false },
  ],
  entry_documents: [
    { id: 1, slug: 'passport', title_i18n: { en: 'Passport validity' }, note_i18n: { en: 'Check it' }, applies_to: ['AU', 'NZ'], sort: 1 },
    { id: 2, slug: 'photo', title_i18n: { en: 'Photo' }, note_i18n: null, applies_to: null, sort: 2 },
  ],
  faqs: [{ id: 1, scope: 'entry', q_i18n: { en: 'Can I work?' }, a_i18n: { en: 'No.' }, sort: 1 }],
  content_blocks: [],
})

describe('loadEntry', () => {
  it('maps rows to the client payload, localised with an English fallback', async () => {
    const e = await loadEntry(fakeClient(tables()), 'th')

    expect(e.permissions[0]).toMatchObject({ slug: 'au-eta', country: 'AU', name: 'อีทีเอ', plain: 'Digital permission', processing: '1–2 days', verifiedAt: '2026-10-01', needsReview: false })
    expect(e.permissions[0].link).toMatchObject({ id: 1, url: 'https://immi.homeaffairs.gov.au', domain: 'immi.homeaffairs.gov.au', title: 'Home Affairs' })
    expect(e.links[1].title).toBe('ตม.นิวซีแลนด์')
    expect(e.documents).toEqual([
      { id: 1, slug: 'passport', title: 'Passport validity', note: 'Check it', appliesTo: ['AU', 'NZ'] },
      { id: 2, slug: 'photo', title: 'Photo', note: '', appliesTo: ['AU', 'NZ'] }, // null applies_to = both countries
    ])
    expect(e.faqs).toEqual([{ id: 1, q: 'Can I work?', a: 'No.' }])
  })

  it('normalises rules (upper-case nationality, null flags) and drops unknown countries', async () => {
    const e = await loadEntry(fakeClient(tables()), 'en')
    expect(e.rules).toEqual([
      { nationality: 'TH', country: 'AU', purpose: 'tourism', stay: 'lt1', permissionId: 10, verifiedAt: '2026-10-20', needsReview: false },
      { nationality: 'TH', country: 'NZ', purpose: 'tourism', stay: 'lt1', permissionId: 20, verifiedAt: null, needsReview: false },
    ])
  })

  it('a permission without a link gets its country official site', async () => {
    const e = await loadEntry(fakeClient(tables()), 'en')
    expect(e.permissions[1].link.url).toBe('https://www.immigration.govt.nz')
    expect(e.permissions[1].needsReview).toBe(true)
  })

  it('last_verified_at is the newest verified_at across permissions and rules; null when nothing is verified', async () => {
    expect((await loadEntry(fakeClient(tables()), 'en')).last_verified_at).toBe('2026-10-20')
    const t = tables()
    for (const r of [...t.permission_types, ...t.entry_rules]) r.verified_at = null
    expect((await loadEntry(fakeClient(t), 'en')).last_verified_at).toBeNull()
  })

  it('timeline: an empty content block (the shipped {}) means "use the bundled copy"', async () => {
    const t = tables()
    t.content_blocks = [{ body_i18n: {}, verified_at: null }]
    expect((await loadEntry(fakeClient(t), 'en')).timeline).toBeNull()
  })

  it('timeline: parses steps and per-permission lead times for the locale, skipping malformed entries', async () => {
    const t = tables()
    t.content_blocks = [
      {
        verified_at: '2026-10-02',
        body_i18n: {
          en: {
            steps: [{ title: 'Check', text: 'Use the helper' }, { title: 5 }],
            lead: [
              { name: 'ETA', note: '2+ weeks', weeksFrom: 6, weeksTo: 2, riskWeeks: 1, permissions: ['au-eta'] },
              { name: 'bad', weeksFrom: 'x' },
            ],
          },
        },
      },
    ]
    const e = await loadEntry(fakeClient(t), 'th') // th missing -> en
    expect(e.timeline).toEqual({
      steps: [{ title: 'Check', text: 'Use the helper' }],
      lead: [{ name: 'ETA', note: '2+ weeks', weeksFrom: 6, weeksTo: 2, riskWeeks: 1, permissions: ['au-eta'] }],
      verifiedAt: '2026-10-02',
    })
  })

  it('throws when a query fails, so the caller can render its fallback', async () => {
    await expect(loadEntry(fakeClient(tables(), 'entry_rules'), 'en')).rejects.toThrow(/entry_rules/)
  })
})

describe('getEntryPageData', () => {
  it('never throws: a failing database gives an empty payload flagged as failed', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const { data, failed } = await getEntryPageData('th') // the mocked public client has no `from`
    expect(failed).toBe(true)
    expect(data).toMatchObject({ rules: [], permissions: [], links: [], documents: [], faqs: [], timeline: null, last_verified_at: null })
  })
})

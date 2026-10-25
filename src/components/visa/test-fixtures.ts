import type { EntryPayload } from '@/lib/entry/helper'

export const daysAgo = (n: number): string => new Date(Date.now() - n * 86_400_000).toISOString().slice(0, 10)

const AU_LINK = { id: 1, country: 'AU', agency: 'Department of Home Affairs', title: 'Department of Home Affairs', url: 'https://immi.homeaffairs.gov.au', domain: 'immi.homeaffairs.gov.au' } as const
const NZ_LINK = { id: 2, country: 'NZ', agency: 'Immigration New Zealand', title: 'Immigration New Zealand', url: 'https://www.immigration.govt.nz', domain: 'www.immigration.govt.nz' } as const

const permission = (over: Partial<EntryPayload['permissions'][number]> & Pick<EntryPayload['permissions'][number], 'id' | 'slug' | 'country' | 'name' | 'link'>) => ({
  plain: `${over.name} explained`,
  who: 'Eligible passport holders',
  how: 'Online',
  processing: '1–2 days',
  fee: 'A$20',
  validity: '12 months',
  good: 'Apply on your phone',
  verifiedAt: daysAgo(3) as string | null,
  needsReview: false,
  ...over,
})

/** A small but complete payload: TH is fresh for AU and stale for NZ, JP is fresh for both. */
export function entryFixture(): EntryPayload {
  return {
    rules: [
      { nationality: 'TH', country: 'AU', purpose: 'tourism', stay: 'lt1', permissionId: 10, verifiedAt: daysAgo(5), needsReview: false },
      { nationality: 'TH', country: 'NZ', purpose: 'tourism', stay: 'lt1', permissionId: 20, verifiedAt: daysAgo(45), needsReview: false },
      { nationality: 'JP', country: 'AU', purpose: 'tourism', stay: 'lt1', permissionId: 10, verifiedAt: daysAgo(5), needsReview: false },
    ],
    permissions: [
      permission({ id: 10, slug: 'au-eta', country: 'AU', name: 'Electronic Travel Authority (ETA)', link: AU_LINK }),
      permission({ id: 20, slug: 'nzeta', country: 'NZ', name: 'NZeTA', link: NZ_LINK, verifiedAt: null }),
    ],
    links: [AU_LINK, NZ_LINK],
    documents: [
      { id: 1, slug: 'passport', title: 'Passport validity', note: 'Check the minimum validity.', appliesTo: ['AU', 'NZ'] },
      { id: 2, slug: 'ivl', title: 'Tourism levy receipt', note: 'Keep the receipt.', appliesTo: ['NZ'] },
    ],
    faqs: [
      { id: 1, q: 'Can I work or study on this?', a: 'Visitor permissions are generally for tourism.' },
      { id: 2, q: 'What if my passport is renewed?', a: 'Check whether you need to apply again.' },
    ],
    timeline: null,
    last_verified_at: daysAgo(3),
  }
}

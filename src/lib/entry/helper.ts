/**
 * Entry helper (spec §11). Pure and browser-safe: the user's answers are resolved against the rule table that
 * shipped with the page and never leave the device. No I/O, no clock of its own (`today` is passed in).
 */

export type Country = 'AU' | 'NZ'
export type Purpose = 'tourism' | 'work_study'
export type Stay = 'lt1' | '1to3' | 'gt3'

export type EntryLink = {
  id: number | null
  country: Country | null
  agency: string
  title: string
  url: string
  /** Hostname shown next to "Opens … in a new tab". */
  domain: string
}

export type EntryPermission = {
  id: number
  country: Country
  slug: string
  name: string
  plain: string
  who: string
  how: string
  processing: string
  fee: string
  validity: string
  good: string
  link: EntryLink
  /** Null = never verified: its fields show the Placeholder tag and the helper will not name it. */
  verifiedAt: string | null
  needsReview: boolean
}

export type EntryRule = {
  nationality: string
  country: Country
  purpose: Purpose
  stay: Stay
  permissionId: number | null
  verifiedAt: string | null
  needsReview: boolean
}

export type EntryDocument = { id: number; slug: string; title: string; note: string; appliesTo: Country[] }
export type EntryFaq = { id: number; q: string; a: string }
export type TimelineStep = { title: string; text: string }
/** A bar on the lead-time chart: the ideal window runs from `weeksFrom` to `weeksTo` weeks before departure. */
export type LeadTime = { name: string; note: string; weeksFrom: number; weeksTo: number; riskWeeks: number; permissions: string[] }
export type EntryTimeline = { steps: TimelineStep[]; lead: LeadTime[]; verifiedAt: string | null }

/** What `GET /api/v1/entry` returns and what the page ships to the helper. */
export type EntryPayload = {
  rules: EntryRule[]
  permissions: EntryPermission[]
  links: EntryLink[]
  documents: EntryDocument[]
  faqs: EntryFaq[]
  /** Null while the `entry_timeline` content block is empty: the page then uses its bundled copy. */
  timeline: EntryTimeline | null
  last_verified_at: string | null
}

export type EntryAnswers = { nationality: string | 'not_listed'; purpose: Purpose; stay: Stay }

export type EntryResult =
  | { kind: 'permission'; permission: EntryPermission }
  | { kind: 'official_only'; link: EntryLink }
  | { kind: 'work_study'; link: EntryLink }
  | { kind: 'not_listed'; link: EntryLink }

/** A rule or permission verified longer ago than this is not shown by name (spec §11 Freshness). */
export const FRESH_DAYS = 30
const DAY_MS = 86_400_000

/** The countries' own immigration sites: the last resort when the database has no link. */
export const OFFICIAL_FALLBACK: Record<Country, EntryLink> = {
  AU: { id: null, country: 'AU', agency: 'Department of Home Affairs', title: 'Department of Home Affairs', url: 'https://immi.homeaffairs.gov.au', domain: 'immi.homeaffairs.gov.au' },
  NZ: { id: null, country: 'NZ', agency: 'Immigration New Zealand', title: 'Immigration New Zealand', url: 'https://www.immigration.govt.nz', domain: 'www.immigration.govt.nz' },
}

/** True when `verifiedAt` (a `YYYY-MM-DD` date) is set and at most {@link FRESH_DAYS} days before `today`. */
export function isFresh(verifiedAt: string | null, today: Date): boolean {
  if (!verifiedAt) return false
  const verified = Date.parse(verifiedAt.slice(0, 10))
  if (Number.isNaN(verified)) return false
  const todayUtc = Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate())
  return (todayUtc - verified) / DAY_MS <= FRESH_DAYS
}

/** The country's landing page: the shallowest link we know for it, else the built-in official site. */
function countryLink(country: Country, links: EntryLink[], permissions: EntryPermission[]): EntryLink {
  const depth = (l: EntryLink) => {
    try {
      return new URL(l.url).pathname.split('/').filter(Boolean).length
    } catch {
      return Infinity
    }
  }
  const candidates = [...links, ...permissions.map((p) => p.link)].filter((l) => l.country === country)
  const best = candidates.reduce<EntryLink | null>((a, l) => (!a || depth(l) < depth(a) ? l : a), null)
  return best ?? OFFICIAL_FALLBACK[country]
}

/**
 * Resolve the three answers for one country. Order matters: work/study and "not listed" never name a
 * permission; a stale, unverified or flagged rule/permission falls back to the official site.
 */
export function resolveEntry(
  rules: EntryRule[],
  permissions: EntryPermission[],
  answers: EntryAnswers,
  country: Country,
  today: Date,
  links: EntryLink[] = [],
): EntryResult {
  const fallback = countryLink(country, links, permissions)
  if (answers.purpose === 'work_study') return { kind: 'work_study', link: fallback }
  if (answers.nationality === 'not_listed') return { kind: 'not_listed', link: fallback }

  const nationality = answers.nationality.toUpperCase()
  const rule = rules.find(
    (r) => r.nationality.toUpperCase() === nationality && r.country === country && r.purpose === answers.purpose && r.stay === answers.stay,
  )
  const permission = rule?.permissionId != null ? permissions.find((p) => p.id === rule.permissionId) : undefined
  if (!rule || !permission) return { kind: 'official_only', link: fallback }

  const trusted =
    !rule.needsReview && !permission.needsReview && isFresh(rule.verifiedAt, today) && isFresh(permission.verifiedAt, today)
  return trusted ? { kind: 'permission', permission } : { kind: 'official_only', link: permission.link ?? fallback }
}

/** Distinct nationalities in the rule table, upper-case and sorted. */
export function nationalityCodes(rules: EntryRule[]): string[] {
  return [...new Set(rules.map((r) => r.nationality.toUpperCase()))].sort()
}

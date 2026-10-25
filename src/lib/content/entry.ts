import { cachedContent } from '@/lib/content/cache'
import {
  OFFICIAL_FALLBACK,
  type Country,
  type EntryLink,
  type EntryPayload,
  type EntryRule,
  type EntryTimeline,
  type LeadTime,
  type Purpose,
  type Stay,
  type TimelineStep,
} from '@/lib/entry/helper'
import type { Locale } from '@/lib/i18n/t'
import type { Json } from '@/lib/supabase/database.types'
import { createPublicClient } from '@/lib/supabase/public'
import { text, type Client } from './shared'

const asCountry = (c: string | null | undefined): Country | null => (c === 'AU' || c === 'NZ' ? c : null)
const asPurpose = (p: string): Purpose | null => (p === 'tourism' || p === 'work_study' ? p : null)
const asStay = (s: string): Stay | null => (s === 'lt1' || s === '1to3' || s === 'gt3' ? s : null)

function hostname(url: string): string {
  try {
    return new URL(url).hostname
  } catch {
    return url
  }
}

const isObject = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v)

/**
 * `content_blocks.entry_timeline.body_i18n` is `{ en: { steps: [{ title, text }], lead: [{ name, note, weeksFrom,
 * weeksTo, riskWeeks?, permissions?: [slug] }] }, th: { ... } }`. The shipped `{}` (or anything unreadable) yields
 * null and the page uses its bundled copy. Malformed entries are skipped, not fatal.
 */
function parseTimeline(body: unknown, locale: Locale, verifiedAt: string | null): EntryTimeline | null {
  const map = isObject(body) ? body : {}
  const raw = map[locale] ?? map.en
  if (!isObject(raw)) return null

  const steps = (Array.isArray(raw.steps) ? raw.steps : []).flatMap((s): TimelineStep[] =>
    isObject(s) && typeof s.title === 'string' && typeof s.text === 'string' ? [{ title: s.title, text: s.text }] : [],
  )
  const lead = (Array.isArray(raw.lead) ? raw.lead : []).flatMap((l): LeadTime[] => {
    if (!isObject(l) || typeof l.name !== 'string' || typeof l.weeksFrom !== 'number' || typeof l.weeksTo !== 'number') return []
    return [
      {
        name: l.name,
        note: typeof l.note === 'string' ? l.note : '',
        weeksFrom: l.weeksFrom,
        weeksTo: l.weeksTo,
        riskWeeks: typeof l.riskWeeks === 'number' ? l.riskWeeks : 0,
        permissions: Array.isArray(l.permissions) ? l.permissions.filter((p): p is string => typeof p === 'string') : [],
      },
    ]
  })
  return steps.length || lead.length ? { steps, lead, verifiedAt } : null
}

/** Everything the page and `GET /api/v1/entry` ship: the whole rule table plus the content around it. */
export async function loadEntry(client: Client, locale: Locale): Promise<EntryPayload> {
  const [links, permissions, rules, documents, faqs, timeline] = await Promise.all([
    client.from('official_links').select('id, country, agency, title_i18n, url').order('id'),
    client
      .from('permission_types')
      .select('id, country, slug, name_i18n, plain_i18n, who_i18n, how_i18n, processing_text, fee_text, validity_text, good_i18n, official_link_id, verified_at, needs_review')
      .order('id'),
    client.from('entry_rules').select('nationality, country, purpose, stay, permission_id, verified_at, needs_review'),
    client.from('entry_documents').select('id, slug, title_i18n, note_i18n, applies_to').order('sort').order('id'),
    // Spec says scope=entry; the dev seed uses 'visa'. Accept both so neither breaks the page.
    client.from('faqs').select('id, q_i18n, a_i18n').in('scope', ['entry', 'visa']).order('sort').order('id'),
    client.from('content_blocks').select('body_i18n, verified_at').eq('key', 'entry_timeline').maybeSingle(),
  ])
  for (const [name, r] of [
    ['official_links', links],
    ['permission_types', permissions],
    ['entry_rules', rules],
    ['entry_documents', documents],
    ['faqs', faqs],
    ['content_blocks', timeline],
  ] as const) {
    if (r.error) throw new Error(`${name} read failed: ${r.error.message}`)
  }

  const toLink = (r: { id: number; country: string | null; agency: string | null; title_i18n: Json | null; url: string }): EntryLink => ({
    id: r.id,
    country: asCountry(r.country),
    agency: r.agency ?? '',
    title: text(r.title_i18n, locale) || r.agency || hostname(r.url),
    url: r.url,
    domain: hostname(r.url),
  })
  const linkRows = (links.data ?? []).map(toLink)
  const linkById = new Map(linkRows.map((l) => [l.id, l]))

  const permissionRows = (permissions.data ?? []).flatMap((p) => {
    const country = asCountry(p.country)
    if (!country) return []
    return [
      {
        id: p.id,
        country,
        slug: p.slug ?? String(p.id),
        name: text(p.name_i18n, locale),
        plain: text(p.plain_i18n, locale),
        who: text(p.who_i18n, locale),
        how: text(p.how_i18n, locale),
        processing: p.processing_text ?? '',
        fee: p.fee_text ?? '',
        validity: p.validity_text ?? '',
        good: text(p.good_i18n, locale),
        link: (p.official_link_id != null && linkById.get(p.official_link_id)) || OFFICIAL_FALLBACK[country],
        verifiedAt: p.verified_at,
        needsReview: p.needs_review === true,
      },
    ]
  })

  const ruleRows = (rules.data ?? []).flatMap((r): EntryRule[] => {
    const country = asCountry(r.country)
    const purpose = asPurpose(r.purpose)
    const stay = asStay(r.stay)
    if (!country || !purpose || !stay) return []
    return [
      { nationality: r.nationality.trim().toUpperCase(), country, purpose, stay, permissionId: r.permission_id, verifiedAt: r.verified_at, needsReview: r.needs_review === true },
    ]
  })

  const verified = [...permissionRows.map((p) => p.verifiedAt), ...ruleRows.map((r) => r.verifiedAt)].filter((d): d is string => !!d).sort()

  return {
    rules: ruleRows,
    permissions: permissionRows,
    links: linkRows,
    documents: (documents.data ?? []).map((d) => ({
      id: d.id,
      slug: d.slug ?? String(d.id),
      title: text(d.title_i18n, locale),
      note: text(d.note_i18n, locale),
      appliesTo: d.applies_to?.length ? d.applies_to.flatMap((c) => asCountry(c) ?? []) : (['AU', 'NZ'] as Country[]),
    })),
    faqs: (faqs.data ?? []).map((f) => ({ id: f.id, q: text(f.q_i18n, locale), a: text(f.a_i18n, locale) })),
    timeline: parseTimeline(timeline.data?.body_i18n, locale, timeline.data?.verified_at ?? null),
    last_verified_at: verified.at(-1) ?? null,
  }
}

/** The ISR payload for `/visa` and `GET /api/v1/entry`, under the `entry` tag. */
export function getEntry(locale: Locale): Promise<EntryPayload> {
  return cachedContent(['entry', locale], 'entry', () => loadEntry(createPublicClient(), locale))()
}

export const EMPTY_ENTRY: EntryPayload = { rules: [], permissions: [], links: [], documents: [], faqs: [], timeline: null, last_verified_at: null }

/**
 * Page loader that cannot crash the render: a database error yields an empty payload and `failed: true`, and
 * the page shows a notice plus the built-in official sites instead of an error page.
 */
export async function getEntryPageData(locale: Locale): Promise<{ data: EntryPayload; failed: boolean }> {
  try {
    return { data: await getEntry(locale), failed: false }
  } catch (err) {
    console.error('[visa] entry load failed', err)
    return { data: EMPTY_ENTRY, failed: true }
  }
}

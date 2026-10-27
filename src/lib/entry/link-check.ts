import { createHash } from 'node:crypto'
import type { Client } from '@/lib/content/shared'
import { isAllowedOfficialUrl } from './official-host'

const TIMEOUT_MS = 10_000
const MAX_REDIRECTS = 5
const MAX_BODY_BYTES = 1024 * 1024
const TITLE_RE = /<title[^>]*>([\s\S]*?)<\/title>/i

/** sha-256 of the page `<title>` (trimmed, whitespace collapsed), or null when the page has none. */
export function pageTitleHash(html: string): string | null {
  const title = TITLE_RE.exec(html)?.[1]?.replace(/\s+/g, ' ').trim()
  return title ? createHash('sha256').update(title).digest('hex') : null
}

type Probe = { status: number | null; finalUrl: string | null; hash: string | null }

const failed = (status: number | null) => status === null || status >= 400

/** Reads the body as text, stopping after `MAX_BODY_BYTES` (the title is near the top; pages can be huge). */
async function readCapped(res: Response): Promise<string> {
  if (!res.body) return ''
  const reader = res.body.getReader()
  const decoder = new TextDecoder()
  let text = ''
  let read = 0
  while (read < MAX_BODY_BYTES) {
    const { done, value } = await reader.read()
    if (done) break
    read += value.byteLength
    text += decoder.decode(value, { stream: true })
  }
  await reader.cancel().catch(() => {})
  return text
}

/**
 * One GET with redirects followed by hand (at most `MAX_REDIRECTS`), each hop re-checked against the official
 * host allowlist; gives up after 10 s overall. An off-list URL or redirect is never fetched and, like a network
 * error, timeout or too many redirects, is a failed check (status null).
 */
async function probe(url: string, fetchImpl: typeof fetch): Promise<Probe> {
  const ctl = new AbortController()
  const timer = setTimeout(() => ctl.abort(), TIMEOUT_MS)
  let current = url
  try {
    for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
      if (!isAllowedOfficialUrl(current)) return { status: null, finalUrl: current, hash: null }
      const res = await fetchImpl(current, {
        method: 'GET',
        redirect: 'manual',
        signal: ctl.signal,
        headers: { accept: 'text/html,application/xhtml+xml', 'user-agent': 'TravelAusNZ-link-check/1.0' },
      })
      const location = res.headers.get('location')
      if (res.status >= 300 && res.status < 400 && location) {
        await res.body?.cancel().catch(() => {})
        current = new URL(location, current).toString()
        continue
      }
      const hash = failed(res.status) ? null : pageTitleHash(await readCapped(res))
      return { status: res.status, finalUrl: current, hash }
    }
    return { status: null, finalUrl: current, hash: null }
  } catch {
    return { status: null, finalUrl: null, hash: null }
  } finally {
    clearTimeout(timer)
  }
}

export type LinkCheckSummary = { checked: number; flagged: number; errors: number }

/**
 * Daily freshness check of `official_links` (spec §11/§15 `link-check`).
 *
 * Each link gets one real GET, stored as a `link_checks` row. "Two consecutive checks" is judged against the
 * latest row stored before this one:
 * - broken: this check failed (status >= 400, network error or timeout) and so did the previous one;
 * - changed: this page title hash differs from the link's baseline (`official_links.content_hash`) and so did
 *   the previous check's. The baseline is the first hash ever seen; it only moves when an editor accepts a
 *   change (clear `content_hash` and the next run adopts the new title).
 * Either one sets `health_status` and `needs_review = true` on the permissions that reference the link and on
 * the rules that reference those permissions, which makes the helper fall back to the official site.
 *
 * `fetchImpl` is injected so tests never touch the network.
 */
export async function checkLinks(db: Client, fetchImpl: typeof fetch = fetch, now: Date = new Date()): Promise<LinkCheckSummary> {
  const { data: links, error } = await db.from('official_links').select('id, url, content_hash').order('id')
  if (error) throw new Error(`official_links read failed: ${error.message}`)

  const summary: LinkCheckSummary = { checked: 0, flagged: 0, errors: 0 }
  for (const link of links ?? []) {
    try {
      if (await checkOne(db, fetchImpl, link, now)) summary.flagged++
      summary.checked++
    } catch (err) {
      summary.errors++
      console.error(`[link-check] link ${link.id} failed`, err)
    }
  }
  return summary
}

/** Returns true when the link was flagged for review. */
async function checkOne(
  db: Client,
  fetchImpl: typeof fetch,
  link: { id: number; url: string; content_hash: string | null },
  now: Date,
): Promise<boolean> {
  const { data: prev, error: prevError } = await db
    .from('link_checks')
    .select('status_code, content_hash')
    .eq('link_id', link.id)
    .order('checked_at', { ascending: false })
    .order('id', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (prevError) throw new Error(`link_checks read failed: ${prevError.message}`)

  const { status, finalUrl, hash } = await probe(link.url, fetchImpl)
  const checkedAt = now.toISOString()
  const { error: insertError } = await db
    .from('link_checks')
    .insert({ link_id: link.id, status_code: status, final_url: finalUrl, content_hash: hash, checked_at: checkedAt })
  if (insertError) throw new Error(`link_checks insert failed: ${insertError.message}`)

  const baseline = link.content_hash
  let health: 'ok' | 'broken' | 'changed' | null = null // null = leave as is (first bad day)
  let adopt = false
  let flag = false

  if (failed(status)) {
    if (prev && failed(prev.status_code)) {
      health = 'broken'
      flag = true
    }
  } else if (hash === null || hash === baseline) {
    health = 'ok'
  } else if (baseline === null) {
    health = 'ok'
    adopt = true
  } else if (prev && !failed(prev.status_code) && prev.content_hash !== null && prev.content_hash !== baseline) {
    health = 'changed'
    flag = true
  }

  const { error: updateError } = await db
    .from('official_links')
    .update({
      last_checked_at: checkedAt,
      ...(health ? { health_status: health } : {}),
      ...(adopt ? { content_hash: hash } : {}),
    })
    .eq('id', link.id)
  if (updateError) throw new Error(`official_links update failed: ${updateError.message}`)

  if (flag) await flagForReview(db, link.id)
  return flag
}

async function flagForReview(db: Client, linkId: number): Promise<void> {
  const { data: permissions, error } = await db
    .from('permission_types')
    .update({ needs_review: true })
    .eq('official_link_id', linkId)
    .select('id')
  if (error) throw new Error(`permission_types update failed: ${error.message}`)

  const ids = (permissions ?? []).map((p) => p.id)
  if (ids.length) {
    const { error: ruleError } = await db.from('entry_rules').update({ needs_review: true }).in('permission_id', ids)
    if (ruleError) throw new Error(`entry_rules update failed: ${ruleError.message}`)
  }
  console.warn(`[link-check] official link ${linkId} flagged; needs_review set on ${ids.length} permission(s)`)
}
